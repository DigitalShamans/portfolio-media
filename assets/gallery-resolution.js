'use strict';

const GalleryResolution = (() => {
  const wide = window.matchMedia(document.documentElement.dataset.gallery4kMedia);

  function current() {
    return wide.matches ? '4k' : '1440p';
  }

  function publicImageUrl(original, resolution) {
    const url = new URL(original, document.baseURI);
    if (resolution === '1440p') {
      const split = url.pathname.lastIndexOf('/') + 1;
      const filename = url.pathname.slice(split).replace(/\.[^/.]+$/, '.webp');
      url.pathname = url.pathname.slice(0, split) + '1440p/' + filename;
      const revision = document.documentElement.dataset.galleryWebpRevision;
      if (revision) url.searchParams.set('webp', revision);
    }
    return url.href;
  }

  return { current, publicImageUrl };
})();
