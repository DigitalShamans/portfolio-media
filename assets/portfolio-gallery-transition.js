'use strict';

(() => {
  const key = 'portfolio-gallery-arrival';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const galleryPath = /^\/artur\/galleries\/(hb-[a-z0-9-]+)\/$/;

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
    const backdrop = document.createElement('div');
    backdrop.className = 'portfolio-gallery-transition__backdrop';
    const frame = document.createElement('div');
    frame.className = 'portfolio-gallery-transition__frame';
    const image = document.createElement('img');
    image.alt = '';
    image.src = url;
    frame.append(image);
    cover.append(backdrop, frame);
    return { cover, backdrop, frame };
  }

  function place(frame, { left, top, width, height }) {
    Object.assign(frame.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
  }

  function hasBannerPosition(box, inset) {
    return box && [box.left, box.top, box.width, box.height].every(Number.isFinite) &&
      Array.isArray(inset) && inset.length === 4 &&
      inset.every(value => Number.isFinite(value) && value >= 0) &&
      box.width - inset[1] - inset[3] >= 2 && box.height - inset[0] - inset[2] >= 2;
  }

  function clip(frame, inset) {
    frame.style.clipPath = 'inset(' + inset.map(value => value + 'px').join(' ') + ')';
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
    if (!url || !hasBannerPosition(marker.box, marker.inset)) return;

    // The gallery already uses this signal to prioritise its first image
    // and avoid triggering an edge slide under the pointer on arrival.
    window.__galleryDesktopEdgeArrived = true;
    try { window.sessionStorage.removeItem('gallery-desktop-edge-arrival'); } catch {}
    const { cover, frame } = createCover(url);
    place(frame, marker.box);
    clip(frame, marker.inset);
    document.body.append(cover);

    let leaving = false;
    const deadline = window.setTimeout(reveal, 2000);
    function reveal() {
      if (leaving) return;
      leaving = true;
      window.clearTimeout(deadline);
      cover.classList.add('portfolio-gallery-transition--leaving');
      cover.addEventListener('transitionend', event => {
        if (event.target === cover && event.propertyName === 'opacity') cover.remove();
      });
      window.setTimeout(() => cover.remove(), 300);
    }

    window.addEventListener('pagehide', () => cover.remove(), { once: true });
    document.addEventListener('DOMContentLoaded', async () => {
      // Paint the banner in its original position before moving to the real image slot.
      await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      if (leaving) return;

      const shot = document.querySelector('.gallery .shot-primary')?.getBoundingClientRect();
      cover.classList.add('portfolio-gallery-transition--moving');
      if (shot?.width > 0 && shot.height > 0) {
        // Keep the banner's original aspect ratio while it moves into the gallery.
        const height = shot.width * marker.box.height / marker.box.width;
        place(frame, { left: shot.left, top: shot.top + (shot.height - height) / 2, width: shot.width, height });
        clip(frame, [0, 0, 0, 0]);
      }
      if (document.querySelector('#gallery-access')) {
        reveal();
        return;
      }

      const timeToMove = new Promise(resolve => window.setTimeout(resolve, 180));
      try {
        const gallery = await window.GalleryViewer?.ready;
        await gallery?.firstReady;
        const first = gallery?.items?.[0]?.image;
        if (first?.naturalWidth) await first.decode?.().catch(() => {});
      } catch { /* Reveal the destination even if gallery loading fails. */ }
      await timeToMove;
      reveal();
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
      const historyVisit = window.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward';
      if (!event.persisted && !historyVisit) return;
      clear();
      const scrollTop = window.history.state?.portfolioRecentWorkScrollTop;
      if (Number.isFinite(scrollTop) && scrollTop >= 0) {
        window.requestAnimationFrame(() => { region.scrollTop = scrollTop; });
      }
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
      const { cover, backdrop, frame } = createCover(url);
      const inset = [top - box.top, box.right - right, box.bottom - bottom, left - box.left];
      place(frame, box);
      clip(frame, inset);
      backdrop.style.opacity = '0';
      document.body.append(cover);
      source.classList.add('portfolio-gallery-transition-source');
      const transition = { cover, source, scrollTop: region.scrollTop, navigating: false };
      active = transition;

      function navigate() {
        if (active !== transition || transition.navigating) return;
        transition.navigating = true;
        window.clearTimeout(transition.timer);
        transition.animation?.kill();
        backdrop.style.opacity = '1';
        const { left, top, width, height } = box;
        const marker = JSON.stringify({
          pathname: destination.pathname, banner: url, at: Date.now(),
          box: { left, top, width, height }, inset
        });
        try {
          window.sessionStorage.setItem(key, marker);
          transition.marker = marker;
        } catch { /* Links still navigate when storage is unavailable. */ }
        // The browser restores the page scroll, but can reset a nested scroller on Back.
        try {
          window.history.replaceState({
            ...window.history.state, portfolioRecentWorkScrollTop: transition.scrollTop
          }, '');
        } catch { /* The banner remains a normal navigation if history state is restricted. */ }
        transition.timer = window.setTimeout(clear, 4000);
        window.location.assign(destination.href);
      }

      transition.timer = window.setTimeout(navigate, 250);
      transition.animation = window.gsap.timeline({ onComplete: navigate });
      transition.animation.to(backdrop, { opacity: 1, duration: .14, ease: 'power1.out' });
    });
  }

  if (document.currentScript?.hasAttribute('data-gallery-arrival')) arrive();
  else depart();
})();
