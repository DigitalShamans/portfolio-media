"""Temporary browser-only font-weight previews; this module never changes the live site."""

import base64
import datetime as dt
import io
import json
from pathlib import Path
import time

from PIL import Image


STYLE_ID = "personal-font-weight-probe"
SELECTOR = "html[data-desktop-safari] .site-header--personal .site-brand--personal, html[data-desktop-safari] .site-header--personal .site-nav a"
METRICS = r"""
const rect = el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
const style = el => {
  const s=getComputedStyle(el);
  return {text:el.textContent.trim(),rect:rect(el),fontFamily:s.fontFamily,fontSize:parseFloat(s.fontSize),
    fontWeight:s.fontWeight,fontStyle:s.fontStyle,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,
    fontSynthesis:s.fontSynthesis,fontSynthesisWeight:s.getPropertyValue('font-synthesis-weight'),
    fontVariationSettings:s.fontVariationSettings,webkitFontSmoothing:s.webkitFontSmoothing,textRendering:s.textRendering};
};
const brand=document.querySelector('.site-brand--personal');
const header=document.querySelector('.site-header--personal');
const inner=header.querySelector('.site-header__inner');
const accent=getComputedStyle(inner,'::after');
const accentTop=rect(inner).bottom-parseFloat(getComputedStyle(inner).borderBottomWidth)
  -(parseFloat(accent.bottom)||0)-parseFloat(accent.height);
return {url:location.href,innerWidth,innerHeight,devicePixelRatio,brand:style(brand),
  links:[...header.querySelectorAll('.site-nav a')].map(style),header:rect(header),headerInner:rect(inner),
  accentTop,nameAccentGap:accentTop-rect(brand).bottom,
  safariMarker:document.documentElement.hasAttribute('data-desktop-safari'),
  synthesisWeightSupported:CSS.supports('font-synthesis-weight','none'),
  fontFaces:[...document.fonts].map(f=>({family:f.family,weight:f.weight,style:f.style,stretch:f.stretch,status:f.status})),
  loadedFontResources:performance.getEntriesByType('resource').filter(r=>/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(r.name)).map(r=>r.name),
  stylesheets:[...document.styleSheets].map(s=>s.href).filter(Boolean),
  probeStyle:document.getElementById('personal-font-weight-probe')?.textContent||null};
"""


def run_probe(driver, browser, output_directory):
    output = Path(output_directory)
    output.mkdir(parents=True, exist_ok=True)
    report = {"browser": browser, "status": "fail", "scope": "Diagnostic preview, not deployed. Candidate CSS exists only in this automated browser session.",
              "viewport": {"width": 1440, "height": 900}, "startedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
              "variants": [], "errors": []}
    try:
        outer_width, outer_height = 1440, 900
        for _ in range(3):
            driver.request("POST", "/window/rect", {"x": 0, "y": 0, "width": outer_width, "height": outer_height})
            time.sleep(.2)
            actual = driver.js("return {innerWidth,innerHeight}")
            if (actual["innerWidth"], actual["innerHeight"]) == (1440, 900):
                break
            outer_width += 1440 - actual["innerWidth"]
            outer_height += 900 - actual["innerHeight"]
        driver.navigate("/artur/?font-weight-diagnostic=20261126")
        driver.wait("return document.fonts.status==='loaded'&&[...document.fonts].some(f=>f.family.replaceAll('\"','')==='Conifers Breeze'&&f.status==='loaded')",
                    timeout=12, label="personal font for weight diagnostic")
        driver.wait("return [...document.querySelectorAll('.recent-gallery img')].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).every(i=>i.complete&&i.naturalWidth>0)",
                    timeout=12, label="visible personal banners")
        variants = [("original", "")]
        if browser == "safari":
            variants += [("preview-no-synthetic-weight", "font-synthesis-weight:none;"),
                         ("preview-weight-400", "font-weight:400;")]
        for name, declaration in variants:
            entry = {"variant": name, "deployed": not bool(declaration), "status": "fail",
                     "candidateCss": SELECTOR + " { " + declaration + " }" if declaration else None}
            report["variants"].append(entry)
            try:
                driver.js("document.getElementById(arguments[0])?.remove(); if(arguments[1]) {const s=document.createElement('style');s.id=arguments[0];s.textContent=arguments[1];document.head.append(s);}",
                          STYLE_ID, entry["candidateCss"])
                time.sleep(.4)
                metrics = driver.js(METRICS)
                entry["metrics"] = metrics
                if (metrics["innerWidth"], metrics["innerHeight"]) != (1440, 900):
                    raise AssertionError("The diagnostic did not reach the exact 1440x900 viewport.")
                if browser == "safari" and not metrics["safariMarker"]:
                    raise AssertionError("Native desktop Safari marker is absent.")
                if browser == "safari" and abs(metrics["nameAccentGap"] - 8) > .15:
                    raise AssertionError("The existing Safari bottom anchor changed.")
                if name == "preview-no-synthetic-weight" and not metrics["synthesisWeightSupported"]:
                    raise AssertionError("font-synthesis-weight is not supported in this browser.")
                if any(abs(item["fontSize"] - 18) > .1 for item in metrics["links"]) or abs(metrics["brand"]["fontSize"] - 36.8) > .1:
                    raise AssertionError("The diagnostic changed the matched font sizes.")
                png = base64.b64decode(driver.request("GET", "/screenshot"))
                path = output / f"{browser}-1440x900-{name}.png"
                path.write_bytes(png)
                with Image.open(io.BytesIO(png)) as image:
                    image = image.convert("RGB")
                    sx, sy = image.width / 1440, image.height / 900
                    r = metrics["brand"]["rect"]
                    crop = image.crop((int(r["x"]*sx), int(r["y"]*sy), int(r["right"]*sx)+1, int(r["bottom"]*sy)+1))
                    light_pixels = sum(min(rgb)>=170 and max(rgb)-min(rgb)<=35 for rgb in crop.getdata())
                    if not image.getbbox() or light_pixels < 20:
                        raise AssertionError("Diagnostic screenshot is blank or lacks the rendered name.")
                    entry.update(screenshot=path.name, screenshotPixels={"width": image.width, "height": image.height},
                                 nameLightPixels=light_pixels, status="pass")
            except Exception as error:
                entry["error"] = str(error)
                report["errors"].append(f"{name}: {error}")
    except Exception as error:
        report["errors"].append(str(error))
    finally:
        try:
            driver.js("document.getElementById(arguments[0])?.remove()", STYLE_ID)
        except Exception as error:
            report["cleanupError"] = str(error)
        report["finishedUtc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        if report["variants"] and not report["errors"] and all(v["status"] == "pass" for v in report["variants"]):
            report["status"] = "pass"
        (output / "font-weight-probe.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report
