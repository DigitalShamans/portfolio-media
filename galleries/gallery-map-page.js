'use strict';

(async () => {
  // Keep desktop zoom/display sizing aligned with fitGallery in gallery-viewer.js.
  const mapPage = document.querySelector('.gallery-map-page');
  const finePointer = window.matchMedia('(pointer: fine)');
  let displaySize = `${screen.width}x${screen.height}`;
  let baselinePixelRatio = window.devicePixelRatio;
  function fitMap() {
    const viewport = document.documentElement;
    const currentDisplaySize = `${screen.width}x${screen.height}`;
    if (currentDisplaySize !== displaySize) {
      displaySize = currentDisplaySize;
      baselinePixelRatio = window.devicePixelRatio;
    }
    if (!finePointer.matches) {
      mapPage.style.removeProperty('--shot-width');
      return;
    }
    const pageScale = window.devicePixelRatio / baselinePixelRatio;
    const fitWidth = Math.min(viewport.clientWidth, viewport.clientHeight * 16 / 9);
    mapPage.style.setProperty('--shot-width', (0.9 * fitWidth * pageScale) + 'px');
  }
  fitMap();
  window.addEventListener('resize', fitMap);
  finePointer.addEventListener('change', fitMap);

  const caption = document.querySelector('#map-caption');
  try {
    const options = JSON.parse(document.querySelector('#gallery-map-options').textContent);
    const folder = new URLSearchParams(location.search).get('gallery') || options.defaultGallery;
    if (!/^hb-[a-z0-9-]+$/.test(folder) || !Object.hasOwn(options.galleries, folder) || !options.galleries[folder].hasMap) throw new Error('Map unavailable');
    const gallery = options.galleries[folder], versions = gallery.versions || {};
    const root = new URL(options.galleryRoot + folder + '/', location.origin);
    const url = new URL('gallery-map.json', root);
    if (versions['gallery-map.json']) url.searchParams.set('v', versions['gallery-map.json']);
    const galleryUrl = new URL('gallery.json', root);
    if (versions['gallery.json']) galleryUrl.searchParams.set('v', versions['gallery.json']);
    const [response, galleryResponse] = await Promise.all([fetch(url), fetch(galleryUrl)]);
    if (!response.ok || !galleryResponse.ok) throw new Error('Map unavailable');
    const entries = GalleryData.parse(await galleryResponse.text());
    const available = new Set(entries.flatMap(GalleryData.images));
    const map = GalleryMapData.parse(await response.text(), available);
    const resolveImage = name => {
      const src = new URL('1440p/' + encodeURIComponent(name.replace(/\.[^.]+$/, '.webp')), root);
      if (versions[name]) src.searchParams.set('v', versions[name]);
      src.searchParams.set('webp', options.webpRevision);
      const original = options.delivery?.revision
        ? options.delivery.service_origin + '/public-media/' + options.delivery.revision + '/' + folder + '/' + encodeURIComponent(name)
        : new URL(encodeURIComponent(name), root).href;
      return { src: src.href, original, media: options.media };
    };
    document.querySelector('#map-title').textContent = gallery.title;
    const link = document.querySelector('#map-gallery-link');
    link.href = (options.personal ? '/artur' : '') + options.galleryRoot + folder + '/'; link.hidden = false;
    const stage = document.querySelector('#public-map'); stage.hidden = false;
    const targets = new Map();
    const renderer = GalleryMap.mount(stage, map, resolveImage, {
      caption, help: document.querySelector('#map-help'),
      onNavigate(region) {
        const target = targets.get(region.image);
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
    const screenshots = document.querySelector('#map-screenshots');
    screenshots.replaceChildren();
    screenshots.setAttribute('aria-label', gallery.title + ' screenshots');
    const regions = new Map(map.regions.map(region => [region.image, region]));
    // Preserve primary gallery order, including a comparison image if a hotspot targets it.
    const images = entries.flatMap(entry => GalleryData.images(entry).filter((name, index) => index === 0 || regions.has(name)));
    images.forEach((name, index) => {
      const region = regions.get(name);
      const label = 'Screenshot ' + (index + 1) + (region ? ' - ' + region.label : '');
      const figure = document.createElement('figure');
      figure.className = 'gallery-map-shot'; figure.id = 'map-shot-' + encodeURIComponent(name);
      figure.dataset.image = name; figure.tabIndex = -1;
      figure.append(renderer.picture(name, region?.label || gallery.title + ' ' + label, false, true));
      const description = document.createElement('figcaption'); description.textContent = label;
      figure.append(description); screenshots.append(figure); targets.set(name, figure);
    });
    screenshots.hidden = false;
    caption.textContent = 'Whole-level overview';
    // Mounting the overview can add the page scrollbar; measure the visible layout.
    fitMap();
  } catch {
    const error = document.querySelector('#map-error'); error.textContent = 'This interactive map is not available.'; error.hidden = false;
    caption.textContent = '';
  }
})();
