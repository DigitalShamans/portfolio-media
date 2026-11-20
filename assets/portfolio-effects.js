'use strict';

(() => {
  if (!window.gsap || !window.ScrollTrigger ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Reveal cards as their rows enter view, including rows farther down on mobile.
  const cards = [...document.querySelectorAll('.portfolio-page .portfolio-grid > li')];
  if (cards.length) {
    ScrollTrigger.batch(cards, {
      start: 'top 92%',
      once: true,
      onEnter: batch => gsap.fromTo(batch,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .58, stagger: .07,
          ease: 'power2.out', clearProps: 'opacity,transform' })
    });
  }
})();
