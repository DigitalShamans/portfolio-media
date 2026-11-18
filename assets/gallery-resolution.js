'use strict';

const GalleryResolution = (() => {
  const wide = window.matchMedia(document.documentElement.dataset.gallery4kMedia);
  const mediaOrigin = document.documentElement.dataset.galleryMediaOrigin;

  function current() {
    return wide.matches ? '4k' : '1440p';
  }

  function publicImageUrl(original, resolution) {
    const url = new URL(original, document.baseURI);
    if (resolution === '1440p') {
      const split = url.pathname.lastIndexOf('/') + 1;
      url.pathname = url.pathname.slice(0, split) + '1440p/' + url.pathname.slice(split) + '.webp';
    }
    return mediaOrigin ? new URL(url.pathname + url.search, mediaOrigin).href : url.href;
  }

  return { current, publicImageUrl };
})();
