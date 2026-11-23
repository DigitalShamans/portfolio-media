'use strict';

(() => {
  const diagnostics = window.PortfolioDiagnostics;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap || !window.ScrollTrigger || reduced) {
    diagnostics?.state('portfolio-reveals', 'Static cards', reduced
      ? 'Reduced motion is enabled.' : 'GSAP or ScrollTrigger was unavailable during initialization.');
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Reveal cards as their rows enter view, including rows farther down on mobile.
  const cards = [...document.querySelectorAll('.portfolio-page .portfolio-grid > li')];
  if (cards.length) {
    ScrollTrigger.batch(cards, {
      start: 'top 92%',
      once: true,
      onEnter: batch => {
        diagnostics?.count('portfolio-reveals', 'cards entered', batch.length);
        gsap.fromTo(batch, { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: .58, stagger: .07, ease: 'power2.out', clearProps: 'opacity,transform',
            onComplete: diagnostics ? () => diagnostics.count('portfolio-reveals', 'cards revealed', batch.length) : undefined });
      }
    });
    diagnostics?.state('portfolio-reveals', 'GSAP ScrollTrigger', 'Card reveals are armed.', { cards: cards.length });
  }
})();
