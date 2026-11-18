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
      url.pathname = url.pathname.slice(0, split) + '1440p/' + url.pathname.slice(split) + '.webp';
      const revision = document.documentElement.dataset.galleryWebpRevision;
      if (revision) url.searchParams.set('webp', revision);
    }
    return url.href;
  }

  return { current, publicImageUrl };
})();
