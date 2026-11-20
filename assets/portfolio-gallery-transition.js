'use strict';

(() => {
  const key = 'portfolio-gallery-arrival';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const galleryPath = /^\/artur\/galleries\/(hb-[a-z0-9-]+)\/$/;
  const coverColor = '#121212';

  function bannerURL(pathname, source) {
    const folder = galleryPath.exec(pathname)?.[1];
    if (!folder || typeof source !== 'string' || !source) return null;
    try {
      const url = new URL(source, window.location.href);
      if (url.origin === window.location.origin && !url.hash &&
          url.pathname.startsWith('/projects/' + folder + '/') &&
          /\.(?:jpe?g|webp)$/i.test(url.pathname)) return url.href;
    } catch { /* A bad marker should be treated like a direct gallery visit. */ }
    return null;
  }

  function createCover(url) {
    const cover = document.createElement('div');
    cover.className = 'portfolio-gallery-transition';
    cover.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('div');
    frame.className = 'portfolio-gallery-transition__frame';
    const image = document.createElement('img');
    image.alt = '';
    image.src = url;
    frame.append(image);
    cover.append(frame);
    return { cover, frame };
  }

  function handoffBox() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(viewportWidth * .90, viewportHeight * 1.32, 1680);
    const height = width * 9 / 16;
    return { left: (viewportWidth - width) / 2, top: (viewportHeight - height) / 2, width, height };
  }

  function place(frame, { left, top, width, height }) {
    Object.assign(frame.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
  }

  function arrive() {
    let marker;
    try {
      marker = JSON.parse(window.sessionStorage.getItem(key) || 'null');
      window.sessionStorage.removeItem(key);
    } catch { return; }

    const now = Date.now();
    if (!marker || marker.pathname !== window.location.pathname || reducedMotion.matches ||
        !Number.isFinite(marker.at) || now < marker.at || now - marker.at > 10000) return;
    const url = bannerURL(marker.pathname, marker.banner);
    if (!url) return;

    // The gallery already uses this signal to prioritise its first image
    // and avoid triggering an edge slide under the pointer on arrival.
    window.__galleryDesktopEdgeArrived = true;
    try { window.sessionStorage.removeItem('gallery-desktop-edge-arrival'); } catch {}
    const { cover, frame } = createCover(url);
    place(frame, handoffBox());
    document.body.append(cover);

    let leaving = false;
    const deadline = window.setTimeout(reveal, 2200);
    function reveal(image) {
      if (leaving) return;
      leaving = true;
      window.clearTimeout(deadline);
      const box = image?.getBoundingClientRect();
      cover.classList.add('portfolio-gallery-transition--leaving');
      if (box?.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight) place(frame, box);
      cover.addEventListener('transitionend', event => {
        if (event.target === cover && event.propertyName === 'opacity') cover.remove();
      });
      window.setTimeout(() => cover.remove(), 360);
    }

    window.addEventListener('pagehide', () => cover.remove(), { once: true });
    document.addEventListener('DOMContentLoaded', async () => {
      let image;
      try {
        if (!document.querySelector('#gallery-access')) {
          const gallery = await window.GalleryViewer?.ready;
          await gallery?.firstReady;
          const first = gallery?.items?.[0]?.image;
          if (first?.naturalWidth) {
            await first.decode?.().catch(() => {});
            image = first;
          }
        }
      } catch { /* Reveal the destination even if gallery loading fails. */ }
      // Let the incoming cover paint even when the first image is cached.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => reveal(image)));
    }, { once: true });
  }

  function depart() {
    const region = document.querySelector('#recent-work .recent-galleries');
    if (!region) return;
    let active;

    function clear() {
      if (!active) return;
      window.clearTimeout(active.timer);
      active.animation?.kill();
      active.cover.remove();
      active.source.classList.remove('portfolio-gallery-transition-source');
      try {
        if (active.marker && window.sessionStorage.getItem(key) === active.marker) {
          window.sessionStorage.removeItem(key);
        }
      } catch {}
      active = null;
    }

    window.addEventListener('pageshow', event => {
      if (event.persisted) clear();
    });
    window.addEventListener('pagehide', () => {
      if (!active?.navigating) clear();
    });
    region.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey || reducedMotion.matches || !window.gsap?.timeline ||
          Math.abs((window.visualViewport?.scale ?? 1) - 1) > .01) return;
      const link = event.target.closest?.('a.recent-gallery');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (destination.origin !== window.location.origin || destination.search || destination.hash) return;

      const source = link.querySelector('img');
      const url = bannerURL(destination.pathname, source?.currentSrc || source?.src);
      if (!url || !source.complete || !source.naturalWidth) return;
      const box = source.getBoundingClientRect();
      const bounds = region.getBoundingClientRect();
      const top = Math.max(box.top, bounds.top, 0);
      const right = Math.min(box.right, bounds.right, document.documentElement.clientWidth);
      const bottom = Math.min(box.bottom, bounds.bottom, window.innerHeight);
      const left = Math.max(box.left, bounds.left, 0);
      if (bottom - top < 2 || right - left < 2) return;

      event.preventDefault();
      if (active) return;
      const { cover, frame } = createCover(url);
      const target = handoffBox();
      const inset = [top - box.top, box.right - right, box.bottom - bottom, left - box.left];
      frame.style.clipPath = 'inset(' + inset.map(value => value + 'px').join(' ') + ')';
      cover.style.backgroundColor = 'transparent';
      place(frame, box);
      document.body.append(cover);
      source.classList.add('portfolio-gallery-transition-source');
      const transition = { cover, source, navigating: false };
      active = transition;

      function navigate() {
        if (active !== transition || transition.navigating) return;
        transition.navigating = true;
        window.clearTimeout(transition.timer);
        transition.animation?.kill();
        place(frame, target);
        frame.style.clipPath = '';
        cover.style.backgroundColor = coverColor;
        const marker = JSON.stringify({ pathname: destination.pathname, banner: url, at: Date.now() });
        try {
          window.sessionStorage.setItem(key, marker);
          transition.marker = marker;
        } catch { /* Links still navigate when storage is unavailable. */ }
        transition.timer = window.setTimeout(clear, 4000);
        window.location.assign(destination.href);
      }

      transition.timer = window.setTimeout(navigate, 500);
      transition.animation = window.gsap.timeline({ onComplete: navigate });
      transition.animation.to(cover, { backgroundColor: coverColor, duration: .34, ease: 'power1.out' }, 0)
        .to(frame, { ...target, clipPath: 'inset(0px 0px 0px 0px)', duration: .34, ease: 'power2.inOut' }, 0);
    });
  }

  if (document.currentScript?.hasAttribute('data-gallery-arrival')) arrive();
  else depart();
})();
