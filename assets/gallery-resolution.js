'use strict';

const GalleryResolution = (() => {
  const settings = document.documentElement.dataset;
  const wide = window.matchMedia(settings.gallery4kMedia);
  const originalsOrigin = settings.galleryOriginalsOrigin;
  const originalsRevision = settings.galleryOriginalsRevision;
  const revisionPattern = /^[a-f0-9]{40}$/;
  const imageName = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.jpg$/i;
  const replacementVersions = new Map();
  const replacementRequests = new Map();
  let galleryRevisions = {};
  try {
    const parsed = JSON.parse(settings.galleryOriginalsGalleryRevisions || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) galleryRevisions = parsed;
  } catch { /* Older pages can continue using their existing media revision. */ }

  function replacementMap(images) {
    if (!images || typeof images !== 'object' || Array.isArray(images)) return;
    const entries = Object.entries(images);
    if (entries.some(([name, revision]) => !imageName.test(name) ||
        typeof revision !== 'string' || !revisionPattern.test(revision))) return;
    return new Map(entries);
  }

  if (settings.galleryReplacementFolder) {
    try {
      const published = replacementMap(JSON.parse(settings.galleryPublishedReplacements));
      if (published) replacementVersions.set(settings.galleryReplacementFolder, published);
    } catch { /* The live gallery lookup can still load the replacement index. */ }
  }

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
    if (originalsOrigin && originalsRevision && url.origin === new URL(document.baseURI).origin) {
      const match = url.pathname.match(/\/galleries\/([a-z0-9-]+)\/([A-Za-z0-9_.-]+\.jpe?g)$/i);
      if (match) {
        const [, gallery, filename] = match;
        const replacement = replacementVersions.get(gallery)?.get(filename);
        if (replacement) {
          const directory = `${originalsOrigin}/public-replacements/${gallery}/${replacement}/`;
          const preview = directory + '1440p/' + filename;
          return resolution === '4k'
            ? { url: directory + filename, fallbackUrl: preview, isReplacement: true }
            : { url: preview, fallbackUrl: webpUrl(url) };
        }
        if (resolution !== '4k') return { url: webpUrl(url) };
        const override = galleryRevisions[gallery];
        const revision = revisionPattern.test(override || '') ? override : originalsRevision;
        return {
          url: `${originalsOrigin}/public-media/${revision}/${gallery}/${filename}`,
          fallbackUrl: webpUrl(url),
        };
      }
    }
    return { url: resolution === '1440p' ? webpUrl(url) : url.href };
  }

  function publicImageUrl(original, resolution) {
    return publicImageSource(original, resolution).url;
  }

  async function fetchReplacementVersions(gallery) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    try {
      const response = await fetch(`${originalsOrigin}/public-replacements/${gallery}.json`, {
        cache: 'no-store', credentials: 'omit', signal: controller.signal
      });
      if (!response.ok) return false;
      const { images } = await response.json();
      const published = replacementMap(images);
      if (!published) return false;
      const previous = replacementVersions.get(gallery);
      replacementVersions.set(gallery, published);
      return (previous?.size ?? 0) !== published.size ||
        [...published].some(([name, revision]) => previous?.get(name) !== revision);
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  function refreshPublicUpdates(galleryBase) {
    if (!originalsOrigin || !originalsRevision) return Promise.resolve(false);
    const url = new URL(galleryBase, document.baseURI);
    const gallery = url.pathname.match(/\/galleries\/([a-z0-9-]+)\/$/)?.[1];
    if (!gallery || url.origin !== new URL(document.baseURI).origin || gallery === 'hb-rzstart') {
      return Promise.resolve(false);
    }
    if (!replacementRequests.has(gallery)) {
      replacementRequests.set(gallery, fetchReplacementVersions(gallery)
        .finally(() => replacementRequests.delete(gallery)));
    }
    return replacementRequests.get(gallery);
  }

  function refreshPublicImageUpdates(original) {
    const url = new URL(original, document.baseURI);
    return refreshPublicUpdates(new URL('.', url).href);
  }

  return { current, publicImageSource, publicImageUrl, refreshPublicUpdates, refreshPublicImageUpdates };
})();
