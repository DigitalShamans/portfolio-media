(() => {
  'use strict';

  const key = 'portfolio-about-entry-v1';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const diagnostics = window.PortfolioDiagnostics;
  const feature = 'about-entry';
  const reporting = () => diagnostics && window.PortfolioDiagnostics === diagnostics;
  const report = (activity, details) => { if (reporting()) diagnostics.event(feature, activity, details); };
  const state = (mode, reason) => { if (reporting()) diagnostics.state(feature, mode, reason); };

  function makeSheet(departure = false) {
    const sheet = document.createElement('div');
    sheet.className = 'about-entry-sheet' + (departure ? ' about-entry-sheet--departure' : '');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.inert = true;
    document.body.append(sheet);
    return sheet;
  }

  if (!document.body.classList.contains('about-page')) {
    let departure;
    const reset = (clearMarker = true) => {
      if (departure) {
        clearTimeout(departure.navigate);
        clearTimeout(departure.guard);
        departure.sheet.remove();
        departure = undefined;
      }
      if (clearMarker) {
        try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
      }
    };
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey || reducedMotion.matches || departure) return;
      const link = event.target.closest?.('.site-nav a[data-about-entry-link]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      const sheet = makeSheet(true);
      if (getComputedStyle(sheet).position !== 'fixed') { sheet.remove(); return; }
      try {
        sessionStorage.setItem(key, JSON.stringify({ to: destination.pathname, from: location.pathname, at: Date.now() }));
      } catch { sheet.remove(); return; }
      // A native fullscreen element can hide a body-level overlay. The arrival still plays.
      if (document.fullscreenElement) { sheet.remove(); return; }
      event.preventDefault();
      departure = { sheet };
      report('navigation started', { destination: destination.pathname });
      departure.navigate = setTimeout(() => { location.assign(destination.href); }, 180);
      departure.guard = setTimeout(() => reset(), 2500);
    });
    // Keep the marker through pagehide so the next document can consume it.
    window.addEventListener('pagehide', () => reset(false));
    window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
    const ready = () => state(reducedMotion.matches ? 'Reduced motion' : 'Gallery → About Us',
      reducedMotion.matches ? 'The About Us link opens the readable page immediately.' :
        'The About Us link opens a diagonal wipe and a GSAP content reveal.');
    reducedMotion.addEventListener('change', ready);
    ready();
    return;
  }

  const gate = window.PortfolioAboutArrival;
  if (!gate || gate.expired || root.getAttribute('data-about-entry') !== 'pending') {
    state(reducedMotion.matches ? 'Reduced motion' : 'Direct visit', 'The page is immediately readable. Gallery About Us links trigger the entry sequence.');
    return;
  }

  const gsap = window.gsap;
  const header = document.querySelector('.site-header');
  const content = document.querySelector('.about-content');
  const footer = document.querySelector('body > footer');
  const headings = [...document.querySelectorAll('.about-title, .about-motto, .about-details h2')];
  const copy = [...document.querySelectorAll('.about-location, .about-intro > p, .about-links, .about-details p, .about-details ul, .about-footer')];
  const targets = [header, content, footer, ...headings, ...copy].filter(Boolean);
  const originalStyles = new Map(targets.map(element => [element, element.getAttribute('style')]));
  const labels = [];
  const events = new AbortController();
  let sheet, context, finished = false;

  function finish(reason = 'completed') {
    if (finished) return;
    finished = true;
    gate.expired = true;
    clearTimeout(gate.timer);
    events.abort();
    context?.revert();
    for (const { heading, label, text } of labels) {
      while (text.firstChild) heading.insertBefore(text.firstChild, label);
      label.remove();
    }
    for (const [element, style] of originalStyles) {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }
    sheet?.remove();
    root.removeAttribute('data-about-entry');
    if (window.PortfolioAboutArrival === gate) delete window.PortfolioAboutArrival;
    report(reason === 'completed' ? 'reveal completed' : 'reveal skipped', { reason });
    state(reason === 'completed' ? 'GSAP page reveal' : 'Page ready',
      reason === 'completed' ? 'Completed the diagonal wipe and staggered white/orange text reveals.' : 'The page is fully readable.');
  }
  gate.release = finish;

  if (!gsap || !header || !content || reducedMotion.matches) { finish('fallback'); return; }
  sheet = makeSheet();
  if (getComputedStyle(sheet).position !== 'fixed') { finish('stylesheet unavailable'); return; }

  try {
    for (const heading of headings) {
      const label = document.createElement('span');
      label.className = 'about-entry-label';
      const text = document.createElement('span');
      text.className = 'about-entry-copy';
      while (heading.firstChild) text.append(heading.firstChild);
      const mask = document.createElement('span');
      mask.className = 'about-entry-mask';
      mask.setAttribute('aria-hidden', 'true');
      const white = document.createElement('span');
      white.className = 'about-entry-white';
      const accent = document.createElement('span');
      accent.className = 'about-entry-accent';
      mask.append(white, accent);
      label.append(text, mask);
      heading.append(label);
      labels.push({ heading, label, text, white, accent });
    }

    context = gsap.context(() => {
      gsap.set(targets, { autoAlpha: 0 });
      gsap.set([header, ...copy, footer].filter(Boolean), { y: 12 });
      for (const { text, white, accent } of labels) {
        gsap.set(text, { opacity: 0 });
        gsap.set(white, { clipPath: 'inset(0 100% 0 0)' });
        gsap.set(accent, { xPercent: -100 });
      }
      root.setAttribute('data-about-entry', 'revealing');
      const timeline = gsap.timeline({ onComplete: () => finish() });
      report('reveal started');
      state('GSAP page reveal', 'Revealing the orange cover, navigation and About Us content.');
      timeline.to(sheet, {
        clipPath: 'polygon(100% 0%, 100% 0%, 100% 100%, 0% 100%)',
        duration: .35, ease: 'power2.in'
      }, 0).to(sheet, {
        clipPath: 'polygon(100% 100%, 100% 100%, 100% 100%, 0% 100%)',
        duration: .45, ease: 'power2.out', onComplete: () => report('wipe completed')
      }, .35).to(header, {
        autoAlpha: 1, y: 0, duration: .3, ease: 'power2.out',
        onUpdate: () => { if (reporting()) diagnostics.sample(feature, header.getBoundingClientRect().top); }
      }, .88).set(content, { autoAlpha: 1 }, .98);

      labels.forEach(({ heading, label, text, white, accent }, index) => {
        const start = 1.02 + index * .16;
        const width = label.getBoundingClientRect().width;
        const bar = accent.getBoundingClientRect().width;
        timeline.set(heading, { autoAlpha: 1 }, start)
          .to(white, { clipPath: 'inset(0 0% 0 0)', duration: .24, ease: 'power2.inOut' }, start)
          .fromTo(accent, { xPercent: 0, x: -bar }, { x: width, duration: .24, ease: 'power2.inOut', immediateRender: false }, start)
          .set(text, { opacity: 1 }, start + .3)
          .to(white, { clipPath: 'inset(0 0 0 100%)', duration: .34, ease: 'power2.inOut', onComplete: () => report('text reveals') }, start + .3)
          .fromTo(accent, { x: -bar }, { x: width, duration: .34, ease: 'power2.inOut', immediateRender: false }, start + .3);
      });
      timeline.to(copy, { autoAlpha: 1, y: 0, duration: .4, stagger: .08, ease: 'power2.out' }, 1.28);
      if (footer) timeline.to(footer, { autoAlpha: 1, y: 0, duration: .3 }, 2.02);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Tab') finish('keyboard input');
    }, { signal: events.signal });
    for (const type of ['wheel', 'touchstart']) {
      window.addEventListener(type, () => finish('viewer input'), { passive: true, signal: events.signal });
    }
    window.addEventListener('resize', () => finish('viewport changed'), { signal: events.signal });
    window.addEventListener('pagehide', () => finish('navigation'), { signal: events.signal });
    reducedMotion.addEventListener('change', () => finish('motion preference changed'), { signal: events.signal });
  } catch { finish('fallback'); }
})();
