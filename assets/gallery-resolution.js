'use strict';

const GalleryResolution = (() => {
  const settings = document.documentElement.dataset;
  const wide = window.matchMedia(settings.gallery4kMedia);
  const originalsOrigin = settings.galleryOriginalsOrigin;
  const originalsRevision = settings.galleryOriginalsRevision;
  let galleryRevisions = {};
  try {
    const parsed = JSON.parse(settings.galleryOriginalsGalleryRevisions || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) galleryRevisions = parsed;
  } catch { /* Older pages can continue using their existing media revision. */ }

  function current() {
    return wide.matches ? '4k' : '1440p';
  }

  function webpUrl(url) {
    const split = url.pathname.lastIndexOf('/') + 1;
    const filename = url.pathname.slice(split).replace(/\.[^/.]+$/, '.webp');
    url.pathname = url.pathname.slice(0, split) + '1440p/' + filename;
    const revision = settings.galleryWebpRevision;
    if (revision) url.searchParams.set('webp', revision);
    return url.href;
  }

  function publicImageSource(original, resolution) {
    const url = new URL(original, document.baseURI);
    if (resolution === '4k' && originalsOrigin && originalsRevision &&
        url.origin === new URL(document.baseURI).origin) {
      const galleryPath = url.pathname.match(/\/galleries\/([a-z0-9-]+\/[A-Za-z0-9_.-]+\.jpe?g)$/i)?.[1];
      if (galleryPath) {
        const override = galleryRevisions[galleryPath.split('/')[0]];
        const revision = /^[a-f0-9]{40}$/.test(override || '') ? override : originalsRevision;
        return {
          url: `${originalsOrigin}/public-media/${revision}/${galleryPath}`,
          fallbackUrl: webpUrl(url),
        };
      }
    }
    return { url: resolution === '1440p' ? webpUrl(url) : url.href };
  }

  function publicImageUrl(original, resolution) {
    return publicImageSource(original, resolution).url;
  }

  return { current, publicImageSource, publicImageUrl };
})();
