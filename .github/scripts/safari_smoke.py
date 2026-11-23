#!/usr/bin/env python3
"""Read-only live portfolio checks through Apple's native Safari WebDriver.

Uses only Python's standard library. Desktop Safari is never represented as
iOS Safari: requested narrow window sizes, actual viewport sizes, pointer
capabilities, and any unsupported native-wheel fallback are all recorded.
"""

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
SOURCE_SHA = os.environ.get("PORTFOLIO_SOURCE_SHA", "7489099be6212f8417976a629d34e4ae7de269c1")
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

    def click(self, selector):
        self.wait("return !!document.querySelector(" + json.dumps(selector) + ")", label=selector)
        element = self.request("POST", "/element", {"using": "css selector", "value": selector})
        self.request("POST", f"/element/{element[ELEMENT_KEY]}/click", {})

    def key(self, key):
        self.request("POST", "/actions", {"actions": [{
            "type": "key", "id": "keyboard",
            "actions": [{"type": "keyDown", "value": key}, {"type": "keyUp", "value": key}],
        }]})

    def wheel(self, delta_y):
        size = self.js("return {width:innerWidth,height:innerHeight}")
        self.request("POST", "/actions", {"actions": [{
            "type": "wheel", "id": "native-wheel",
            "actions": [{"type": "scroll", "x": int(size["width"] * .5), "y": int(size["height"] * .65),
                         "deltaX": 0, "deltaY": int(delta_y), "duration": 350, "origin": "viewport"}],
        }]})

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


PAGE_STATE = r"""
const rect = n => { if (!n) return null; const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
const isVisible = n => {
  if (!n) return false;
  for(let p=n;p;p=p.parentElement){ const s=getComputedStyle(p); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false; }
  const r=n.getBoundingClientRect(); return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
};
const header=document.querySelector('.site-header');
return {
  url:location.href,title:document.title,readyState:document.readyState,
  innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,
  scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
  scrollY,bodyOverflow:getComputedStyle(document.body).overflow,rootOverflow:getComputedStyle(document.documentElement).overflow,
  pointerCoarse:matchMedia('(pointer:coarse)').matches,hoverNone:matchMedia('(hover:none)').matches,maxTouchPoints:navigator.maxTouchPoints,
  header:{visible:isVisible(header),rect:rect(header),font:header?getComputedStyle(header).fontFamily:null},
  mainVisible:isVisible(document.querySelector('main')),
  fontStatus:document.fonts?document.fonts.status:null,
  fontFaces:document.fonts?[...document.fonts].map(f=>({family:f.family,status:f.status})):[],
  rootFont:getComputedStyle(document.documentElement).fontFamily,
  images:[...document.images].filter(isVisible).map(i=>({src:i.currentSrc||i.src,complete:i.complete,width:i.naturalWidth,height:i.naturalHeight,rect:rect(i)})).slice(0,20),
  buildRevision:document.body.dataset.galleryRevision||null,
  assets:[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(n=>n.src||n.href),
  openDialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),
  fullscreen:!!document.fullscreenElement,
};
"""

SCROLL_STATE = r"""
const local=document.documentElement.classList.contains('career-local-scroll');
const scroller=local?document.querySelector('.career-native-scroll'):document.scrollingElement;
return {local,top:local?scroller.scrollTop:scrollY,max:Math.max(0,scroller.scrollHeight-(local?scroller.clientHeight:innerHeight))};
"""

TIMELINE_STATE = r"""
const track=document.querySelector('[data-career-timeline]');
if(!track)return null;
function readable(n){
 const r=n.getBoundingClientRect();
 if(r.width<=0||r.height<=0||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;
 for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.01)return false;}
 return true;
}
const entries=[...track.querySelectorAll('.career-milestone')];
return {
 state:track.dataset.timelineState,initializing:document.documentElement.classList.contains('career-initializing'),
 classes:track.className,start:Number(track.dataset.scrollStart||0),end:Number(track.dataset.scrollEnd||0),
 pathLength:track.querySelector('[data-career-path]')?.getTotalLength()||0,
 scrollY,entryCount:entries.length,
 shown:entries.filter(e=>!e.classList.contains('career-milestone--awaiting-reveal')).map(e=>e.id),
 readable:entries.filter(e=>[...e.querySelectorAll('.career-year,.career-description h2,.career-project-link')].some(readable)).map(e=>e.id),
 lastId:entries.at(-1)?.id,
 canvasTransform:getComputedStyle(track.querySelector('.career-canvas')).transform,
};
"""

VIEWER_STATE = r"""
const d=document.querySelector('#viewer'),i=document.querySelector('#original'),s=document.querySelector('#status');
return {open:!!d?.open,counter:document.querySelector('#counter')?.textContent.trim(),
 src:i?.currentSrc||i?.src||'',alt:i?.alt||'',loaded:!!(i?.complete&&i?.naturalWidth),width:i?.naturalWidth||0,
 status:s?.textContent||'',statusHidden:!s||s.hidden,fullscreen:!!document.fullscreenElement,
 bodyOverflow:getComputedStyle(document.body).overflow};
"""


def require(condition, message, detail=None):
    if not condition:
        raise AssertionError(message + (": " + json.dumps(detail, ensure_ascii=False) if detail is not None else ""))


class Suite:
    def __init__(self, driver):
        self.driver = driver
        self.report = {
            "startedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "origin": ORIGIN, "sourceCommit": SOURCE_SHA,
            "testCommit": os.environ.get("GITHUB_SHA"), "githubRunId": os.environ.get("GITHUB_RUN_ID"),
            "scope": "Actual desktop Safari on macOS; narrow windows are responsive desktop tests, never iOS or touch emulation.",
            "limitations": [
                "No real iPhone/iPad, touch gestures, browser toolbar collapse, or mobile momentum scrolling were tested.",
                "Safari's standard WebDriver interface does not expose browser-console logs; no claim of zero JavaScript errors is made.",
                "This is a live smoke test of selected paths, not exhaustive browser or visual certification.",
            ],
            "environment": {}, "tests": [],
        }
        self.case = None
        self.gallery_routes = {}

    def detail(self, key, value):
        self.case["details"][key] = value
        return value

    def limited(self, reason):
        self.case["status"] = "limited"
        self.case.setdefault("limitations", []).append(reason)

    def shot(self, suffix):
        filename = self.driver.screenshot(self.case["name"] + "-" + suffix)
        self.case["screenshots"].append(filename)

    def run(self, name, callback):
        start = time.monotonic()
        self.case = {"name": name, "status": "pass", "details": {}, "screenshots": []}
        self.report["tests"].append(self.case)
        try:
            callback()
        except Exception as error:
            self.case["status"] = "fail"
            self.case["error"] = str(error)
            self.case["traceback"] = traceback.format_exc(limit=6)
            try:
                self.case["failurePage"] = self.driver.js(PAGE_STATE)
                self.shot("failure")
            except Exception as capture_error:
                self.case["captureError"] = str(capture_error)
        self.case["durationSeconds"] = round(time.monotonic() - start, 2)
        log_case = {k: self.case[k] for k in ("status", "durationSeconds", "screenshots", "error", "limitations") if k in self.case}
        log_case["evidence"] = {k: v for k, v in self.case["details"].items() if k not in ("page", "gallery")}
        for page_key in ("page", "gallery"):
            page = self.case["details"].get(page_key)
            if page:
                log_case[page_key] = {k: page[k] for k in ("url", "innerWidth", "innerHeight", "buildRevision", "fontStatus", "fontFaces", "rootFont", "pointerCoarse", "maxTouchPoints")}
        print(self.case["status"].upper(), name, json.dumps(log_case, ensure_ascii=False), flush=True)
        self.write()

    def dimensions(self, width, height):
        d = self.driver
        requested = {"width": width, "height": height}
        adjustment = {"width": width, "height": height}
        for _ in range(2):
            d.request("POST", "/window/rect", {"x": 0, "y": 0, **adjustment})
            time.sleep(.3)
            actual = d.js("return {innerWidth,innerHeight,outerWidth,outerHeight}")
            adjustment = {"width": max(200, width + actual["outerWidth"] - actual["innerWidth"]),
                          "height": max(200, height + actual["outerHeight"] - actual["innerHeight"])}
        self.detail("requestedViewport", requested)
        self.detail("actualViewport", actual)
        self.report["environment"].setdefault("viewports", []).append({"requested": requested, "actual": actual})
        if abs(actual["innerWidth"] - width) > 2 or abs(actual["innerHeight"] - height) > 2:
            self.limited("Safari/macOS clamped the requested viewport; all layout results use the recorded actual inner dimensions.")

    def loaded_home(self, path, personal=False):
        d = self.driver
        d.navigate(path)
        d.wait("return document.querySelectorAll('.recent-gallery[href]').length > 0", label="homepage gallery links")
        d.wait("const i=document.querySelector('.recent-gallery img');return i&&i.complete&&i.naturalWidth>0", timeout=18, label="first visible banner image")
        d.wait("return !document.fonts || document.fonts.status==='loaded'", label="font loading")
        state = self.detail("page", d.js(PAGE_STATE))
        require(state["header"]["visible"] and state["mainVisible"], "Header/main was not visibly rendered", state)
        require(state["scrollWidth"] <= state["clientWidth"] + 2, "Horizontal page overflow", state)
        if personal:
            loaded = [f for f in state["fontFaces"] if f["status"] == "loaded" and f["family"].strip('"\'') in state["rootFont"]]
            require(loaded, "The declared personal font has no loaded matching font face", state["fontFaces"])
        self.shot("loaded")

    def gallery_navigation(self, prefix):
        d = self.driver
        home = "/artur/" if prefix == "artur" else "/"
        d.navigate(home)
        d.wait("return document.querySelectorAll('.recent-gallery[href]').length>0")
        links = d.js("return [...document.querySelectorAll('.recent-gallery[href]')].filter(a=>!a.querySelector('.recent-gallery__locked')).map(a=>({href:a.getAttribute('href'),url:a.href}))")
        require(links, "No unlocked homepage gallery links were found")
        target = next((a for a in links if "/hb-atrium/" in a["href"]), links[0])
        target_path = urllib.parse.urlparse(target["url"]).path
        require(target["url"].startswith(ORIGIN + "/"), "Gallery link unexpectedly leaves the portfolio origin", target)
        self.gallery_routes[prefix] = target_path
        d.click('.recent-gallery[href=' + json.dumps(target["href"]) + ']')
        d.wait("return location.pathname===" + json.dumps(target_path), label="native link navigation")
        d.wait("return document.querySelectorAll('.gallery .shot').length>1", timeout=18, label="populated gallery")
        self.detail("gallery", d.js(PAGE_STATE))
        self.shot("gallery")
        d.request("POST", "/back", {})
        d.wait("return location.pathname===" + json.dumps(home), label="browser Back to homepage")
        require(d.js("return !!document.querySelector('.recent-gallery')"), "Back navigation did not restore the homepage")
        d.request("POST", "/forward", {})
        d.wait("return location.pathname===" + json.dumps(target_path), label="browser Forward to gallery")
        d.wait("return document.querySelectorAll('.gallery .shot').length>1", timeout=18)
        self.detail("history", {"home": home, "gallery": target_path, "back": True, "forward": True})

    def ensure_gallery(self, prefix):
        d = self.driver
        target = self.gallery_routes.get(prefix, ("/artur" if prefix == "artur" else "") + "/galleries/hb-atrium/")
        current = d.js("return location.pathname")
        if current != target:
            d.navigate(target)
        d.wait("return document.querySelectorAll('.gallery .shot').length>1", timeout=18)
        d.wait("const i=document.querySelector('.gallery .shot img.shot-primary');return i&&i.complete&&i.naturalWidth>0", timeout=18)
        return target

    def wheel_check(self):
        d = self.driver
        before = self.detail("wheelBefore", d.js(SCROLL_STATE))
        require(before["max"] > 30, "No scrollable document range exists")
        direction = -1 if before["top"] >= before["max"] - 100 else 1
        method = "native W3C wheel action"
        try:
            d.wheel(direction * 650)
        except WebDriverError as error:
            unsupported = error.code in ("unsupported operation", "unknown command", "unknown method") or (error.code == "invalid argument" and "wheel" in str(error).lower())
            if not unsupported:
                raise
            method = "programmatic scroll fallback; native wheel unsupported"
            self.detail("nativeWheelError", str(error))
            self.limited("The driver rejected native wheel actions. The separately labelled fallback verifies programmatic scrolling only.")
            d.js("const s=document.documentElement.classList.contains('career-local-scroll')?document.querySelector('.career-native-scroll'):window;s.scrollBy(0,arguments[0]);", direction * 650)
        time.sleep(1.2)
        after = self.detail("wheelAfter", d.js(SCROLL_STATE))
        self.detail("scrollInputMethod", method)
        require((after["top"] - before["top"]) * direction > 5, "Scrolling did not move in the requested direction", {"before": before, "after": after, "method": method})

    def viewer(self, prefix):
        d = self.driver
        self.detail("galleryPath", self.ensure_gallery(prefix))
        primary = self.detail("primaryImage", d.js("const i=document.querySelector('.gallery .shot img.shot-primary');return {src:i.currentSrc||i.src,width:i.naturalWidth,height:i.naturalHeight}"))
        self.detail("webpRendered", bool(re.search(r"\.webp(?:[?#]|$)", primary["src"], re.I)))
        d.click(".gallery .shot")
        d.wait("return document.querySelector('#viewer')?.open===true", label="native click opens viewer")
        d.wait("const i=document.querySelector('#original'),s=document.querySelector('#status');return i?.complete&&i.naturalWidth>0&&(!s||s.hidden)", timeout=18, label="viewer image loaded")
        first = self.detail("first", d.js(VIEWER_STATE))
        require(first["open"] and first["loaded"], "Viewer did not show a loaded image", first)
        self.shot("viewer-first")
        d.click("#next-side")
        d.wait("return document.querySelector('#counter').textContent.trim()!==" + json.dumps(first["counter"]), label="next image counter")
        d.wait("const i=document.querySelector('#original'),s=document.querySelector('#status');return i?.complete&&i.naturalWidth>0&&(!s||s.hidden)", timeout=18)
        second = self.detail("next", d.js(VIEWER_STATE))
        require(second["src"] != first["src"], "Next changed the counter but did not change the displayed image", second)
        self.shot("viewer-next")
        d.click("#previous-side")
        d.wait("return document.querySelector('#counter').textContent.trim()===" + json.dumps(first["counter"]), label="previous image counter")
        d.wait("const i=document.querySelector('#original'),s=document.querySelector('#status');return i?.complete&&i.naturalWidth>0&&(!s||s.hidden)", timeout=18)
        previous = self.detail("previous", d.js(VIEWER_STATE))
        # A mouse click may open a hovered comparison variant. Previous returns
        # to that screenshot's primary variant, so compare shot identity, not
        # the variant URL that happened to be open on the initial click.
        require(previous["alt"] == first["alt"] and previous["src"] == primary["src"], "Previous did not restore the first screenshot's primary image", previous)
        d.key("\ue014")
        d.wait("return document.querySelector('#counter').textContent.trim()!==" + json.dumps(first["counter"]), label="native ArrowRight keyboard navigation")
        self.detail("keyboardRight", d.js(VIEWER_STATE))
        d.click("#fullscreen")
        d.wait("return !document.querySelector('#viewer')?.open&&!document.fullscreenElement", label="viewer closes and exits fullscreen")
        closed = self.detail("closed", d.js(VIEWER_STATE))
        require(closed["bodyOverflow"] not in ("hidden", "clip"), "Body scrolling remained locked after closing viewer", closed)
        self.wheel_check()
        self.shot("closed-and-scrolled")

    def resume(self):
        d = self.driver
        d.navigate("/artur/resume/")
        d.wait("return document.querySelector('[data-career-timeline]')?.dataset.timelineState==='animated'&&!document.documentElement.classList.contains('career-initializing')", timeout=12, label="visible initialized animated timeline")
        d.wait("return (()=>{" + TIMELINE_STATE + "})()?.readable?.length>0", timeout=6, label="first readable milestone after initial animation frame")
        d.wait("const i=document.querySelector('.career-cellular');return i&&i.complete&&i.naturalWidth>0", timeout=15, label="rendered WebP timeline background")
        page = self.detail("page", d.js(PAGE_STATE))
        start = self.detail("initialTimeline", d.js(TIMELINE_STATE))
        require(page["mainVisible"] and start["entryCount"] > 5 and start["pathLength"] > 100 and start["readable"], "Timeline did not visibly initialize", start)
        require(page["scrollWidth"] <= page["clientWidth"] + 2, "Timeline caused horizontal page overflow", page)
        self.shot("start")
        self.wheel_check()
        samples = []
        self.detail("programmaticScrollSamples", samples)
        self.detail("sampleMethod", "Explicit programmatic scrollTo of the native document scroller; no site timeline APIs are invoked.")
        for index, fraction in enumerate((.33, .66, 1.0)):
            bounds = d.js(TIMELINE_STATE)
            scroll = d.js(SCROLL_STATE)
            target = min(scroll["max"], bounds["start"] + (bounds["end"] - bounds["start"]) * fraction)
            d.js("const s=document.documentElement.classList.contains('career-local-scroll')?document.querySelector('.career-native-scroll'):window;s.scrollTo(0,arguments[0]);", target)
            time.sleep(1.2)
            sample = d.js(TIMELINE_STATE)
            sample.update({"requestedFraction": fraction, "requestedScrollTop": target, "actualScroll": d.js(SCROLL_STATE)})
            samples.append(sample)
            require(abs(sample["actualScroll"]["top"] - target) < 10, "Programmatic scroll did not settle at its requested position", sample)
            require(not sample["initializing"] and sample["state"] == "animated", "Timeline stopped being initialized while scrolling", sample)
            if fraction < 1:
                require(sample["readable"], "No readable milestone remained in the viewport at a middle scroll sample", sample)
            if index in (0, 2):
                self.shot("sample-" + str(index + 1))
        require(samples[-1]["lastId"] in samples[-1]["shown"], "The final milestone did not reveal at the end of the timeline", samples[-1])
        require(len(samples[-1]["shown"]) > len(start["shown"]), "Timeline reveal state never progressed", {"start": start, "last": samples[-1]})
        require(any(s["canvasTransform"] != start["canvasTransform"] or s["shown"] != start["shown"] for s in samples[:2]), "Neither timeline camera nor reveal progress changed at the middle samples", {"start": start, "samples": samples[:2]})

    def write(self):
        self.report["durationSeconds"] = round(time.monotonic() - START, 2)
        self.report["counts"] = {status: sum(t["status"] == status for t in self.report["tests"]) for status in ("pass", "fail", "limited")}
        (OUTPUT / "report.json").write_text(json.dumps(self.report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        caps = self.report["environment"].get("capabilities", {})
        lines = ["# Native Safari portfolio smoke test", "", self.report["scope"], "",
                 f"- Started: {self.report['startedUtc']}", f"- Origin: {ORIGIN}",
                 f"- Safari: {caps.get('browserVersion', 'session not created')}",
                 f"- Source commit inspected for selectors: `{SOURCE_SHA}`",
                 f"- Test commit: `{self.report.get('testCommit')}`",
                 f"- Runtime: {self.report['durationSeconds']} seconds", "",
                 "| Test | Result | Seconds |", "|---|---|---|"]
        for item in self.report["tests"]:
            lines.append(f"| {item['name']} | {item['status'].upper()} | {item.get('durationSeconds', 0)} |")
        lines.extend(["", "## Failures and scope limits", ""])
        if self.report.get("fatalError"):
            lines.extend(["### Fatal runner error", "", self.report["fatalError"], ""])
        for item in self.report["tests"]:
            if item.get("error"):
                lines.extend([f"### {item['name']}", "", item["error"], ""])
            for limit in item.get("limitations", []):
                lines.extend([f"- **{item['name']}:** {limit}"])
        lines.extend(["", *[f"- {limit}" for limit in self.report["limitations"]], "",
                      "The JSON report contains actual viewports, Safari capabilities, observed deployed gallery revisions, asset URLs, image/font evidence, native wheel results, and explicit programmatic-scroll samples.", ""])
        (OUTPUT / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    driver = Safari()
    suite = Suite(driver)
    suite.report["environment"]["python"] = sys.version
    suite.report["environment"]["platform"] = platform.platform()
    suite.report["environment"]["macOS"] = platform.mac_ver()[0]
    try:
        driver.start()
        suite.report["environment"]["capabilities"] = driver.capabilities
        suite.report["environment"]["userAgent"] = driver.js("return navigator.userAgent")
        require(driver.capabilities.get("browserName", "").lower() == "safari", "The driver did not create a native Safari session", driver.capabilities)
        suite.run("desktop-viewport", lambda: suite.dimensions(1440, 900))
        for prefix in ("studio", "artur"):
            suite.run(prefix + "-homepage", lambda p=prefix: suite.loaded_home("/artur/" if p == "artur" else "/", personal=p == "artur"))
            suite.run(prefix + "-gallery-navigation-history", lambda p=prefix: suite.gallery_navigation(p))
            suite.run(prefix + "-viewer-controls-scroll", lambda p=prefix: suite.viewer(p))
        suite.run("resume-desktop-scroll", suite.resume)
        suite.run("narrow-viewport-request-390x844", lambda: suite.dimensions(390, 844))
        suite.run("artur-homepage-narrow-desktop", lambda: suite.loaded_home("/artur/", personal=True))
        suite.run("artur-viewer-narrow-desktop", lambda: suite.viewer("artur"))
        suite.run("resume-narrow-desktop-scroll", suite.resume)
    except Exception as error:
        suite.report["fatalError"] = str(error)
        suite.report["fatalTraceback"] = traceback.format_exc(limit=8)
        print("FATAL", str(error), flush=True)
    finally:
        try:
            driver.close()
        except Exception as error:
            suite.report["cleanupError"] = str(error)
        suite.report["finishedUtc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        suite.write()
        print("SAFARI_SUMMARY", json.dumps({"counts": suite.report["counts"], "capabilities": suite.report["environment"].get("capabilities"), "viewports": suite.report["environment"].get("viewports"), "fatalError": suite.report.get("fatalError"), "durationSeconds": suite.report["durationSeconds"], "output": str(OUTPUT)}, ensure_ascii=False), flush=True)
    return 1 if suite.report.get("fatalError") or suite.report["counts"]["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
