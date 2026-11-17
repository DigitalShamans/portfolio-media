(() => {
  'use strict';

  const region = document.querySelector('.recent-galleries');
  const galleryImages = Array.from(region.querySelectorAll('[data-gallery-preloads]'), gallery =>
    gallery.dataset.galleryPreloads.split(' ').filter(Boolean)
  );

  function visibleBanners() {
    const bounds = region.getBoundingClientRect();
    const top = Math.max(bounds.top, 0);
    const bottom = Math.min(bounds.bottom, window.innerHeight);
    const left = Math.max(bounds.left, 0);
    const right = Math.min(bounds.right, window.innerWidth);
    if (top >= bottom || left >= right) return [];

    return Array.from(region.querySelectorAll('.recent-gallery img')).filter(image => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right;
    });
  }

  function waitForImage(image) {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }

  async function preloadGalleryImages() {
    await Promise.all(visibleBanners().map(waitForImage));

    const queue = new Set();
    const maxImages = Math.max(0, ...galleryImages.map(images => images.length));
    for (let index = 0; index < maxImages; index++) {
      for (const images of galleryImages) {
        if (images[index]) queue.add(images[index]);
      }
    }

    for (const url of queue) {
      const image = new Image();
      image.fetchPriority = 'low';
      image.src = url;
      await waitForImage(image);
    }
  }

  void preloadGalleryImages();
})();
