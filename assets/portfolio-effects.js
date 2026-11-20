'use strict';

(() => {
  if (!window.gsap || !window.ScrollTrigger ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  if (document.body.classList.contains('portfolio-home')) {
    // Only the studio's large banners receive parallax. Preserve native
    // touch scrolling and battery life on coarse-pointer devices.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const region = document.querySelector('.portfolio-home .recent-galleries');
    if (!region) return;
    const banners = [...region.querySelectorAll('.recent-gallery')];
    if (!banners.length) return;
    const images = banners.map(banner => banner.querySelector('img'));
    const maxShiftPercent = 16;
    // The extra image area covers the frame at either end of the pan.
    gsap.set(images, {
      scale: 1 + 2 * (maxShiftPercent + 2) / 100,
      transformOrigin: 'center center'
    });
    const setters = images.map(image => gsap.quickSetter(image, 'yPercent'));
    let scheduled = false;

    function update() {
      scheduled = false;
      const clip = region.getBoundingClientRect();
      const top = Math.max(0, clip.top);
      const bottom = Math.min(window.innerHeight, clip.bottom);
      if (bottom <= top) return;

      const visibleHeight = bottom - top;
      const center = top + visibleHeight / 2;
      const bounds = banners.map(banner => banner.getBoundingClientRect());
      for (let i = 0; i < bounds.length; i++) {
        const { top: bannerTop, height } = bounds[i];
        const bannerCenter = bannerTop + height / 2;
        const travel = (visibleHeight + height) * .4;
        const offset = (center - bannerCenter) / travel;
        setters[i](Math.max(-1, Math.min(1, offset)) * maxShiftPercent);
      }
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }

    // Both the internal Recent Work scroll and the page scroll affect the
    // visible banner positions; a single scroller-only trigger misses one.
    region.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    ScrollTrigger.create({
      trigger: region, start: 'top bottom', end: 'bottom top',
      onUpdate: schedule, onRefresh: schedule
    });
    schedule();
    return;
  }

  // Artur's portfolio only: reveal each arriving batch so even a tall/mobile
  // grid animates naturally as its later rows enter the viewport.
  const grid = document.querySelector('.portfolio-page:not(.portfolio-home) .portfolio-grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll(':scope > li')];
  if (!cards.length) return;
  ScrollTrigger.batch(cards, {
    start: 'top 92%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: .58, stagger: .07,
        ease: 'power2.out', clearProps: 'opacity,transform' })
  });
})();
