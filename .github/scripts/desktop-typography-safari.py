#!/usr/bin/env python3
"""Capture and measure the published personal header in actual desktop Safari."""

from __future__ import annotations

import base64
import datetime as dt
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


ORIGIN = os.environ.get("PORTFOLIO_ORIGIN", "https://digitalshamans.co.uk").rstrip("/")
ENDPOINT = os.environ.get("SAFARI_WEBDRIVER_URL", "http://127.0.0.1:4444").rstrip("/")
OUTPUT = Path(os.environ.get("SAFARI_OUTPUT_DIR", "artifacts"))
SOURCE_SHA = os.environ.get("PORTFOLIO_SOURCE_SHA", "7cb8f87feac62e6a7abf31643f41f32c919dcad9")
DIAGNOSTIC_ONLY = os.environ.get("SAFARI_DIAGNOSTIC_ONLY") == "1"
REQUIRE_NORMAL_MOTION = os.environ.get("SAFARI_REQUIRE_NORMAL_MOTION") == "1"
ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"
START = time.monotonic()
DEADLINE = START + float(os.environ.get("SAFARI_TEST_BUDGET_SECONDS", "300"))


class WebDriverError(RuntimeError):
    def __init__(self, code, message, command):
        super().__init__(f"{code}: {message} [{command}]")
        self.code = code
        self.command = command


class Safari:
    def __init__(self):
        self.session_id = None
        self.capabilities = {}
        self.wheel_sequence = 0
        self.click_waits = []

    def request(self, method, path, payload=None, session=True):
        remaining = DEADLINE - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("The 300-second test budget was exhausted.")
        if session:
            if not self.session_id:
                raise RuntimeError("No native Safari WebDriver session exists.")
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
        value = self.request("POST", "/session", {
            "capabilities": {"alwaysMatch": {
                "browserName": "safari", "pageLoadStrategy": "normal",
                "timeouts": {"pageLoad": 30000, "script": 15000, "implicit": 0},
            }},
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

    def screenshot(self, name):
        data = self.request("GET", "/screenshot")
        path = OUTPUT / f"{name}.png"
        path.write_bytes(base64.b64decode(data))
        return path.name

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
const brand = document.querySelector('.site-brand--personal');
const nav = document.querySelector('.site-header--personal .site-nav');
const header = document.querySelector('.site-header--personal');
const style = element => {
  const s = getComputedStyle(element);
  return {fontSize:parseFloat(s.fontSize),fontFamily:s.fontFamily,lineHeight:s.lineHeight,rect:rect(element)};
};
return {
  url:location.href,innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,
  screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight},
  pointerFine:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,
  rootFontSize:parseFloat(getComputedStyle(document.documentElement).fontSize),
  fontStatus:document.fonts.status,
  fontFaces:[...document.fonts].map(f=>({family:f.family,status:f.status})),
  stylesheet:document.querySelector('link[href*="/assets/personal-typography.css"]')?.href,
  brand:style(brand),nav:rect(nav),links:[...nav.querySelectorAll('a')].map(style),
  header:rect(header),scrollWidth:document.documentElement.scrollWidth,
  clientWidth:document.documentElement.clientWidth,
  images:[...document.querySelectorAll('.recent-gallery img')].filter(image=>{
    const r=image.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;
  }).map(image=>({loaded:image.complete&&image.naturalWidth>0,source:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight}))
};
"""


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
    width, root = metrics["innerWidth"], metrics["rootFontSize"]
    expected_name = min(4.6 * root, max(1.25 * root, 1.9166667 * width / 100))
    expected_nav = min(2.25 * root, max(.875 * root, .9375 * width / 100))
    if not metrics["pointerFine"] or not metrics["hover"]:
        errors.append("The session is not a desktop fine-pointer hover viewport.")
    if abs(metrics["brand"]["fontSize"] - expected_name) > .15:
        errors.append(f"Name size {metrics['brand']['fontSize']} differs from expected {expected_name:.3f}px.")
    if any(abs(link["fontSize"] - expected_nav) > .15 for link in metrics["links"]):
        errors.append(f"Navigation size differs from expected {expected_nav:.3f}px.")
    if "Conifers Breeze" not in metrics["brand"]["fontFamily"]:
        errors.append("The expected personal font family is missing.")
    if not any(face["family"].strip('"') == "Conifers Breeze" and face["status"] == "loaded" for face in metrics["fontFaces"]):
        errors.append("The actual Conifers Breeze font file has not loaded.")
    if metrics["brand"]["rect"]["right"] >= metrics["nav"]["x"]:
        errors.append("The name overlaps the navigation.")
    if metrics["brand"]["rect"]["bottom"] > metrics["header"]["bottom"] + 1:
        errors.append("The name extends below the header.")
    if any(link["rect"]["bottom"] > metrics["header"]["bottom"] + 1 for link in metrics["links"]):
        errors.append("Navigation extends below the header.")
    if metrics["scrollWidth"] > metrics["clientWidth"] + 2:
        errors.append("The page has horizontal overflow.")
    if not metrics["images"] or not all(image["loaded"] for image in metrics["images"]):
        errors.append("A visible gallery banner has not loaded.")
    return errors


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {
        "sourceCommit": SOURCE_SHA, "testCommit": os.environ.get("GITHUB_SHA"),
        "githubRunId": os.environ.get("GITHUB_RUN_ID"),
        "startedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "scope": "Actual desktop Safari on macOS. Unmodified live page and native window resizing; no CSS zoom, browser emulation, image upscaling or fabricated viewport sizes.",
        "macOS": platform.mac_ver()[0], "cases": [], "cleanup": {},
    }
    driver = Safari()
    try:
        driver.start()
        report["capabilities"] = driver.capabilities
        if driver.capabilities.get("browserName", "").lower() != "safari":
            raise AssertionError("Native Safari session was not created.")
        report["userAgent"] = driver.js("return navigator.userAgent")
        for width, height in TARGETS:
            case = {"requestedViewport": {"width": width, "height": height}}
            report["cases"].append(case)
            try:
                case["resizeAttempts"] = resize_viewport(driver, width, height)
                driver.navigate("/artur/?typography-check=" + SOURCE_SHA[:12])
                driver.wait("return document.querySelector('link[href*=\"/assets/personal-typography.css\"]')?.href.includes('?v=3')", timeout=8, label="published typography v3")
                driver.wait("return document.fonts.status==='loaded'&&[...document.fonts].some(f=>f.family.replaceAll('\"','')==='Conifers Breeze'&&f.status==='loaded')", timeout=12, label="loaded personal font")
                driver.wait("return [...document.querySelectorAll('.recent-gallery img')].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).every(i=>i.complete&&i.naturalWidth>0)", timeout=12, label="visible gallery banners")
                time.sleep(.6)
                metrics = driver.js(METRICS)
                case["metrics"] = metrics
                actual_width, actual_height = metrics["innerWidth"], metrics["innerHeight"]
                case["exactViewport"] = abs(actual_width - width) <= 1 and abs(actual_height - height) <= 1
                filename = f"safari-{actual_width}x{actual_height}-requested-{width}x{height}"
                case["screenshot"] = driver.screenshot(filename)
                png = (OUTPUT / case["screenshot"]).read_bytes()
                case["screenshotPixels"] = {"width": int.from_bytes(png[16:20], "big"), "height": int.from_bytes(png[20:24], "big")}
                case["errors"] = check_metrics(metrics)
                case["status"] = "fail" if case["errors"] else "pass"
                if not case["exactViewport"]:
                    case["viewportNote"] = "Safari/macOS constrained the native window; the image is labelled with its actual viewport."
                print("CAPTURE", json.dumps({key:case.get(key) for key in ("requestedViewport","exactViewport","screenshot","screenshotPixels","status","errors")}), flush=True)
            except Exception as error:
                case["status"] = "fail"
                case["errors"] = [str(error)]
                case["traceback"] = traceback.format_exc(limit=4)
                print("CAPTURE_ERROR", json.dumps(case), flush=True)
    except Exception as error:
        report["fatalError"] = str(error)
        report["fatalTraceback"] = traceback.format_exc(limit=5)
    finally:
        try:
            driver.close()
            report["cleanup"]["safariSession"] = "closed"
        except Exception as error:
            report["cleanup"]["error"] = str(error)
        report["finishedUtc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        report["counts"] = {status: sum(case.get("status") == status for case in report["cases"]) for status in ("pass", "fail")}
        (OUTPUT / "measurements.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        lines = ["# Safari desktop typography comparison", "", report["scope"], "",
                 f"- Safari: {report.get('capabilities', {}).get('browserVersion', 'unavailable')}",
                 f"- macOS: {report['macOS']}", f"- Published change: {SOURCE_SHA}",
                 "", "| Requested viewport | Actual viewport | PNG pixels | Name | Navigation | Result |",
                 "|---|---|---|---:|---:|---|"]
        for case in report["cases"]:
            requested = case["requestedViewport"]; metrics = case.get("metrics", {})
            pixels = case.get("screenshotPixels", {})
            lines.append(f"| {requested['width']} x {requested['height']} | {metrics.get('innerWidth','?')} x {metrics.get('innerHeight','?')} | {pixels.get('width','?')} x {pixels.get('height','?')} | {metrics.get('brand',{}).get('fontSize','?')} px | {(metrics.get('links') or [{}])[0].get('fontSize','?')} px | {case['status']} |")
        lines.extend(["", "Screenshot files retain their native pixels. Any constrained viewport is recorded in measurements.json.",
                      "This verifies desktop Safari, not iOS Safari or real touch hardware.",
                      f"Safari session cleanup: {report['cleanup']}", ""])
        if report.get("fatalError"):
            lines.extend(["## Error", "", report["fatalError"], ""])
        for case in report["cases"]:
            if case.get("errors"):
                lines.extend(["- " + error for error in case["errors"]])
        (OUTPUT / "report.md").write_text("\n".join(lines), encoding="utf-8")
        print("SAFARI_TYPOGRAPHY_SUMMARY", json.dumps({"counts":report["counts"],"fatalError":report.get("fatalError"),"cleanup":report["cleanup"]}), flush=True)
    return 1 if report.get("fatalError") or report["counts"]["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())

