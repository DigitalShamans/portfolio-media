#!/usr/bin/env python3
"""Capture the published Digital Shamans homepage in native Safari or Google Chrome."""

from __future__ import annotations

import base64
import datetime as dt
import io
import json
import os
from pathlib import Path
import platform
import re
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image


ORIGIN = os.environ.get("PORTFOLIO_ORIGIN", "https://digitalshamans.co.uk").rstrip("/")
BROWSER = os.environ.get("CAPTURE_BROWSER", "safari").lower()
if BROWSER not in {"safari", "chrome"}:
    raise ValueError("CAPTURE_BROWSER must be safari or chrome.")
BROWSER_LABEL = "Safari" if BROWSER == "safari" else "Google Chrome"
CHROME_HEADLESS = BROWSER == "chrome" and os.environ.get("CAPTURE_CHROME_HEADLESS") == "1"
BROWSER_MODE = "headless" if CHROME_HEADLESS else "headed"
ENDPOINT = os.environ.get("CAPTURE_WEBDRIVER_URL", "http://127.0.0.1:4444").rstrip("/")
OUTPUT = Path(os.environ.get("CAPTURE_OUTPUT_DIR", "artifacts/" + BROWSER))
SOURCE_SHA = os.environ["PORTFOLIO_SOURCE_SHA"]
if not re.fullmatch(r"[0-9a-f]{40}", SOURCE_SHA):
    raise ValueError("PORTFOLIO_SOURCE_SHA must identify the published production commit.")
STYLESHEET_VERSION = "15"
CHROME_BINARY = os.environ.get("CHROME_BINARY", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
START = time.monotonic()
TEST_BUDGET = float(os.environ.get("CAPTURE_BUDGET_SECONDS", "180"))
DEADLINE = START + TEST_BUDGET


class WebDriverError(RuntimeError):
    def __init__(self, code, message, command):
        super().__init__(f"{code}: {message} [{command}]")
        self.code = code
        self.command = command


class DesktopBrowser:
    def __init__(self):
        self.session_id = None
        self.capabilities = {}

    def request(self, method, path, payload=None, session=True):
        remaining = DEADLINE - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"The {TEST_BUDGET:g}-second test budget was exhausted.")
        if session:
            if not self.session_id:
                raise RuntimeError("No desktop WebDriver session exists.")
            path = f"/session/{self.session_id}" + path
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            ENDPOINT + path, data=body, method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=min(36, max(1, remaining))) as response:
                content = response.read()
        except urllib.error.HTTPError as error:
            content = error.read()
            try:
                value = json.loads(content).get("value", {})
            except (ValueError, AttributeError):
                value = {}
            raise WebDriverError(value.get("error", str(error.code)), value.get("message", content.decode("utf-8", "replace")[:1500]), f"{method} {path}") from error
        value = json.loads(content).get("value") if content else None
        if isinstance(value, dict) and value.get("error"):
            raise WebDriverError(value["error"], value.get("message", ""), f"{method} {path}")
        return value

    def start(self):
        capabilities = {
            "browserName": BROWSER, "pageLoadStrategy": "normal",
            "timeouts": {"pageLoad": 30000, "script": 15000, "implicit": 0},
        }
        if BROWSER == "chrome":
            chrome_args = ["--no-first-run", "--no-default-browser-check"]
            if CHROME_HEADLESS:
                chrome_args.append("--headless=new")
            capabilities["goog:chromeOptions"] = {
                "binary": CHROME_BINARY,
                "args": chrome_args,
            }
        value = self.request("POST", "/session", {
            "capabilities": {"alwaysMatch": capabilities},
        }, session=False)
        self.session_id = value["sessionId"]
        self.capabilities = value.get("capabilities", {})

    def js(self, script, *args):
        return self.request("POST", "/execute/sync", {"script": script, "args": list(args)})

    def navigate(self, path):
        url = path if path.startswith("https://") else ORIGIN + path
        self.request("POST", "/url", {"url": url})
        self.wait("return document.readyState === 'complete'", timeout=8)

    def wait(self, expression, timeout=12, label=None):
        end = min(DEADLINE, time.monotonic() + timeout)
        last_value = None
        while time.monotonic() < end:
            last_value = self.js(expression)
            if last_value:
                return last_value
            time.sleep(0.2)
        raise AssertionError(f"Timed out waiting for {label or expression}; last value={last_value!r}")

    def screenshot(self, name, metrics):
        def save_verified(encoded, path, region, kind, attempts):
            data = base64.b64decode(encoded)
            path.write_bytes(data)
            with Image.open(io.BytesIO(data)) as original:
                image = original.convert("RGB")
                scale_x = image.width / region["width"]
                scale_y = image.height / region["height"]
                def visible_pixels(rect):
                    crop = image.crop((int((rect["x"] - region["x"]) * scale_x),
                                       int((rect["y"] - region["y"]) * scale_y),
                                       int((rect["right"] - region["x"]) * scale_x) + 1,
                                       int((rect["bottom"] - region["y"]) * scale_y) + 1))
                    return sum(max(rgb) >= 160 and sum(rgb) >= 300 for rgb in crop.getdata())
                logo_pixels = visible_pixels(metrics["brand"]["rect"])
                navigation_pixels = visible_pixels(metrics["nav"])
                if image.getbbox() is not None and logo_pixels >= 20 and navigation_pixels >= 20:
                    self.last_capture_validation = {"attempts": attempts,
                                                    "logoVisiblePixels": logo_pixels,
                                                    "navigationVisiblePixels": navigation_pixels,
                                                    "nonblank": True}
                    self.last_capture_region = region
                    self.last_capture_kind = kind
                    return path.name
            return None

        region = {"x": 0, "y": 0, "width": metrics["innerWidth"], "height": metrics["innerHeight"]}
        for attempt in range(2):
            saved = save_verified(self.request("GET", "/screenshot"), OUTPUT / f"{name}.png",
                                  region, "viewport", attempt + 1)
            if saved:
                return saved
            if attempt == 0:
                self.request("POST", "/refresh", {})
                wait_page_ready(self)

        if BROWSER == "safari":
            # Native element snapshots use Safari's renderer. Unlike viewport
            # snapshots they can provide real header pixels beyond this runner's
            # 1920px desktop. Keep the actual viewport and label the region.
            element = self.request("POST", "/element", {
                "using": "css selector", "value": ".site-header"})
            element_id = element["element-6066-11e4-a52e-4f735466cecf"]
            header = metrics["header"]
            region = {key: header[key] for key in ("x", "y", "width", "height")}
            saved = save_verified(self.request("GET", f"/element/{element_id}/screenshot"),
                                  OUTPUT / f"{name}-header.png", region, "header-element", 3)
            if saved:
                return saved
        raise AssertionError("Safari/Chrome returned a blank screenshot or the rendered logo/navigation is missing; computed layout alone is not a visual pass.")

    def close(self):
        if self.session_id:
            try:
                self.request("DELETE", "")
            finally:
                self.session_id = None



TARGETS = [(1024, 768), (1280, 800), (1440, 900), (1920, 1080), (2560, 1440), (3840, 2160)]
METRICS = r"""
const rect = element => {
  const r = element.getBoundingClientRect();
  return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
};
const brand = document.querySelector('.site-brand--studio');
const logo = brand.querySelector('img');
const nav = document.querySelector('.site-header .site-nav');
const header = document.querySelector('.site-header');
const headerInner = header.querySelector('.site-header__inner');
const innerStyle = getComputedStyle(headerInner);
const accentStyle = getComputedStyle(headerInner, '::after');
const accentHeight = parseFloat(accentStyle.height);
const accentBottomInset = parseFloat(accentStyle.bottom) || 0;
const accentTop = headerInner.getBoundingClientRect().bottom
  - parseFloat(innerStyle.borderBottomWidth) - accentBottomInset - accentHeight;
const style = element => {
  if (!element) return null;
  const s = getComputedStyle(element);
  return {label:element.textContent.trim(),fontSize:parseFloat(s.fontSize),fontFamily:s.fontFamily,
    fontWeight:s.fontWeight,fontStyle:s.fontStyle,fontSynthesis:s.fontSynthesis,
    fontSynthesisWeight:s.fontSynthesisWeight,fontSynthesisStyle:s.fontSynthesisStyle,
    fontVariationSettings:s.fontVariationSettings,fontFeatureSettings:s.fontFeatureSettings,
    webkitFontSmoothing:s.webkitFontSmoothing,textRendering:s.textRendering,letterSpacing:s.letterSpacing,
    lineHeight:s.lineHeight,color:s.color,opacity:s.opacity,visibility:s.visibility,display:s.display,rect:rect(element)};
};
const visibleImages = [...document.querySelectorAll('.recent-gallery img,.portfolio-card img')].filter(image=>{
  const r=image.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;
});
return {
  url:location.href,title:document.title,innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,
  screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight},
  pointerFine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,
  reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,
  rootFontSize:parseFloat(getComputedStyle(document.documentElement).fontSize),
  rootScrollbarGutter:getComputedStyle(document.documentElement).scrollbarGutter,
  rootClasses:[...document.documentElement.classList],
  headerInner:rect(headerInner),header:rect(header),nav:rect(nav),brand:style(brand),
  logo:{loaded:logo.complete&&logo.naturalWidth>0,source:logo.currentSrc,
    naturalWidth:logo.naturalWidth,naturalHeight:logo.naturalHeight,rect:rect(logo)},
  links:[...nav.querySelectorAll('a')].map(style),body:style(document.body),
  sampleHeading:style(document.querySelector('.portfolio-heading')),
  headerPaddingBottom:parseFloat(innerStyle.paddingBottom),accentHeight,accentBottomInset,accentTop,
  fontStatus:document.fonts.status,
  fontFaces:[...document.fonts].map(f=>({family:f.family,weight:f.weight,style:f.style,
    stretch:f.stretch,status:f.status,variationSettings:f.variationSettings})),
  loadedFontResources:performance.getEntriesByType('resource').filter(r=>/\.(woff2?|ttf|otf)(\?|$)/i.test(r.name)).map(r=>({url:r.name,duration:r.duration,transferSize:r.transferSize})),
  stylesheet:document.querySelector('link[href*="/assets/site.css"]')?.href,
  stylesheets:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href),
  scripts:[...document.scripts].filter(x=>x.src).map(x=>x.src),
  scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
  scrollPosition:{x:scrollX,y:scrollY,recentGalleries:document.querySelector('.recent-galleries')?.scrollTop},
  images:visibleImages.map(image=>({loaded:image.complete&&image.naturalWidth>0,
    source:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight,rect:rect(image)}))
};
"""


def wait_page_ready(driver):
    driver.wait("return document.querySelector('.site-brand--studio img')?.complete && document.querySelector('.site-brand--studio img')?.naturalWidth>0", timeout=12, label="loaded studio logo")
    driver.wait("return document.querySelector('link[href*=\"/assets/site.css\"]')?.href.includes('?v=" + STYLESHEET_VERSION + "')", timeout=8, label="published site stylesheet")
    driver.wait("return new URL(document.querySelector('.site-brand--studio img').currentSrc).searchParams.get('v') === arguments[0]".replace("arguments[0]", json.dumps(SOURCE_SHA)), timeout=8, label="published source revision on logo URL")
    driver.wait("return document.fonts.status==='loaded'", timeout=12, label="loaded fonts")
    driver.wait("return [...document.querySelectorAll('.recent-gallery img,.portfolio-card img')].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).every(i=>i.complete&&i.naturalWidth>0)", timeout=12, label="visible portfolio images")
    driver.wait("return document.getAnimations().every(a=>a.playState!=='running') && (!window.gsap || !window.gsap.getTweensOf(document.querySelectorAll('.portfolio-grid > li')).some(t=>t.isActive()))", timeout=6, label="naturally settled reveal animations")
    time.sleep(.6)



def resize_viewport(driver, width, height):
    attempts = []
    outer_width, outer_height = width, height
    for attempt in range(3):
        driver.request("POST", "/window/rect", {"x": 0, "y": 0, "width": outer_width, "height": outer_height})
        time.sleep(.25)
        actual = driver.js("return {innerWidth,innerHeight,outerWidth,outerHeight}")
        attempts.append({"requestedOuter": [outer_width, outer_height], "actual": actual})
        if abs(actual["innerWidth"] - width) <= 1 and abs(actual["innerHeight"] - height) <= 1:
            break
        next_width = outer_width + width - actual["innerWidth"]
        next_height = outer_height + height - actual["innerHeight"]
        if attempt and attempts[-1]["actual"] == attempts[-2]["actual"]:
            break
        outer_width, outer_height = next_width, next_height
    return attempts


def check_metrics(metrics):
    errors = []
    if not metrics["pointerFine"] or not metrics["hover"]:
        errors.append("The session is not a desktop fine-pointer hover viewport.")
    if not metrics["logo"]["loaded"]:
        errors.append("The studio logo has not loaded.")
    if not metrics["links"] or any(link["fontSize"] <= 0 for link in metrics["links"]):
        errors.append("Navigation fonts are unavailable.")
    if [link["label"] for link in metrics["links"]] != ["Portfolio", "About Us", "Contact", "Jobs"]:
        errors.append("The expected studio homepage navigation is missing.")
    if metrics["brand"]["rect"]["right"] >= metrics["nav"]["x"]:
        errors.append("The logo frame overlaps the navigation.")
    for label, rectangle in [("Logo frame", metrics["brand"]["rect"]), ("Navigation", metrics["nav"])]:
        if rectangle["y"] < metrics["header"]["y"] - 1 or rectangle["bottom"] > metrics["header"]["bottom"] + 1:
            errors.append(label + " extends outside the header vertically.")
        if rectangle["x"] < -1 or rectangle["right"] > metrics["clientWidth"] + 1:
            errors.append(label + " extends outside the usable viewport width.")
    if any(link["display"] == "none" or link["visibility"] != "visible" or float(link["opacity"]) < .99 for link in metrics["links"]):
        errors.append("A navigation link is hidden.")
    if metrics["scrollWidth"] > metrics["clientWidth"] + 2:
        errors.append("The page has horizontal overflow.")
    if not metrics["images"] or not all(image["loaded"] for image in metrics["images"]):
        errors.append("A visible portfolio image has not loaded.")
    if abs(metrics["scrollPosition"]["y"]) > 1 or abs(metrics["scrollPosition"]["recentGalleries"] or 0) > 1:
        errors.append("The homepage did not remain at its initial top position.")
    return errors


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {
        "sourceCommit": SOURCE_SHA, "testCommit": os.environ.get("GITHUB_SHA"),
        "githubRunId": os.environ.get("GITHUB_RUN_ID"),
        "startedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "browser": BROWSER_LABEL,
        "browserMode": BROWSER_MODE,
        "scope": f"Installed {BROWSER_LABEL} capturing https://digitalshamans.co.uk/ on macOS in {BROWSER_MODE} mode. Unmodified live page and WebDriver window resizing; no CSS zoom, browser substitution, image upscaling or fabricated viewport sizes. If a native Safari viewport screenshot is blank beyond the runner display, a clearly labelled native header-element screenshot records the actual header at that viewport.",
        "macOS": platform.mac_ver()[0], "cases": [], "cleanup": {},
    }
    driver = DesktopBrowser()
    try:
        driver.start()
        report["capabilities"] = driver.capabilities
        if driver.capabilities.get("browserName", "").lower() != BROWSER:
            raise AssertionError(f"Native {BROWSER_LABEL} session was not created.")
        report["userAgent"] = driver.js("return navigator.userAgent")
        for width, height in TARGETS:
            case = {"requestedViewport": {"width": width, "height": height}}
            report["cases"].append(case)
            try:
                case["resizeAttempts"] = resize_viewport(driver, width, height)
                driver.navigate("/?studio-capture=" + SOURCE_SHA[:12])
                wait_page_ready(driver)
                metrics = driver.js(METRICS)
                case["metrics"] = metrics
                actual_width, actual_height = metrics["innerWidth"], metrics["innerHeight"]
                case["exactViewport"] = abs(actual_width - width) <= 1 and abs(actual_height - height) <= 1
                filename = f"{BROWSER}-{actual_width}x{actual_height}-requested-{width}x{height}"
                case["screenshot"] = driver.screenshot(filename, metrics)
                case["screenshotContentCheck"] = driver.last_capture_validation
                case["screenshotKind"] = driver.last_capture_kind
                case["screenshotRegion"] = driver.last_capture_region
                png = (OUTPUT / case["screenshot"]).read_bytes()
                case["screenshotPixels"] = {"width": int.from_bytes(png[16:20], "big"), "height": int.from_bytes(png[20:24], "big")}
                case["errors"] = check_metrics(metrics)
                if not case["exactViewport"]:
                    case["viewportNote"] = f"{BROWSER_LABEL} returned a constrained viewport; the image is labelled with its actual dimensions."
                    case["errors"].append("The native/rendered viewport did not reach the requested capture dimensions.")
                case["status"] = "fail" if case["errors"] else "pass"
                summary = {key:case.get(key) for key in ("requestedViewport","exactViewport","screenshot","screenshotPixels","screenshotKind","status","errors")}
                summary.update(browser=BROWSER_LABEL, logoFrameWidthPx=metrics["brand"]["rect"]["width"],
                               navigationPx=metrics["links"][0]["fontSize"])
                print("CAPTURE", json.dumps(summary), flush=True)
            except Exception as error:
                case["status"] = "fail"
                case["errors"] = [str(error)]
                case["traceback"] = traceback.format_exc(limit=4)
                print("CAPTURE_ERROR", json.dumps(case), flush=True)
        if os.environ.get("CAPTURE_PERSONAL_WEIGHT_PROBE") == "1":
            try:
                from personal_font_weight_probe import run_probe
                probe = run_probe(driver, BROWSER, OUTPUT / "personal-weight-probe")
                report["personalFontWeightProbe"] = {"status": probe.get("status"),
                                                     "scope": "Separate temporary personal-header diagnostic after the unmodified studio captures."}
            except Exception as error:
                report["personalFontWeightProbe"] = {"status": "error", "error": str(error)}
                print("PERSONAL_FONT_WEIGHT_PROBE_ERROR", str(error), flush=True)
    except Exception as error:
        report["fatalError"] = str(error)
        report["fatalTraceback"] = traceback.format_exc(limit=5)
    finally:
        try:
            driver.close()
            report["cleanup"]["browserSession"] = "closed"
        except Exception as error:
            report["cleanup"]["error"] = str(error)
        report["finishedUtc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        report["counts"] = {status: sum(case.get("status") == status for case in report["cases"]) for status in ("pass", "fail")}
        (OUTPUT / "measurements.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        lines = [f"# {BROWSER_LABEL} Digital Shamans homepage comparison", "", report["scope"], "",
                 f"- {BROWSER_LABEL}: {report.get('capabilities', {}).get('browserVersion', 'unavailable')} ({BROWSER_MODE})",
                 f"- macOS: {report['macOS']}", f"- Live source revision: {SOURCE_SHA}",
                 "", "| Requested viewport | Actual viewport | Capture | PNG pixels | Logo frame | Navigation | Result |",
                 "|---|---|---|---|---:|---:|---|"]
        for case in report["cases"]:
            requested = case["requestedViewport"]; metrics = case.get("metrics", {})
            pixels = case.get("screenshotPixels", {})
            lines.append(f"| {requested['width']} x {requested['height']} | {metrics.get('innerWidth','?')} x {metrics.get('innerHeight','?')} | {case.get('screenshotKind','unavailable')} | {pixels.get('width','?')} x {pixels.get('height','?')} | {metrics.get('brand',{}).get('rect',{}).get('width','?')} x {metrics.get('brand',{}).get('rect',{}).get('height','?')} px | {(metrics.get('links') or [{}])[0].get('fontSize','?')} px | {case['status']} |")
        lines.extend(["", "Screenshot files retain their native pixels. Any constrained viewport is recorded in measurements.json.",
                      "This verifies desktop browsers, not iOS Safari or real touch hardware.",
                      f"Browser session cleanup: {report['cleanup']}", ""])
        if report.get("fatalError"):
            lines.extend(["## Error", "", report["fatalError"], ""])
        for case in report["cases"]:
            if case.get("errors"):
                lines.extend(["- " + error for error in case["errors"]])
        (OUTPUT / "report.md").write_text("\n".join(lines), encoding="utf-8")
        print("STUDIO_CAPTURE_SUMMARY", json.dumps({"browser":BROWSER_LABEL,"counts":report["counts"],"fatalError":report.get("fatalError"),"cleanup":report["cleanup"]}), flush=True)
    return 1 if report.get("fatalError") or report["counts"]["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())


