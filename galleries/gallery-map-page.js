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
    const map = GalleryMapData.parse(await response.text(), new Set(entries.flatMap(GalleryData.images)));
    const resolveImage = name => {
      const image = new URL(encodeURIComponent(name), root);
      if (versions[name]) image.searchParams.set('v', versions[name]);
      return {
        src: GalleryResolution.publicImageUrl(image.href, '1440p'),
        original: GalleryResolution.publicImageUrl(image.href, '4k'),
        media: options.media
      };
    };
    document.querySelector('#map-title').textContent = gallery.title;
    const link = document.querySelector('#map-gallery-link');
    link.href = (options.personal ? '/artur' : '') + options.galleryRoot + folder + '/'; link.hidden = false;
    const screenshots = document.querySelector('#map-screenshots');
    screenshots.dataset.galleryRoot = root.href;
    screenshots.setAttribute('aria-label', gallery.title + ' screenshots');
    document.body.dataset.galleryAssetVersions = JSON.stringify(versions);

    const viewerApi = await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = options.viewerScript;
      script.onload = () => window.GalleryViewer ? resolve(window.GalleryViewer) : reject(new Error('Viewer unavailable'));
      script.onerror = () => reject(new Error('Viewer unavailable'));
      document.head.append(script);
    });
    const loaded = await viewerApi.ready;
    if (!loaded) throw new Error('Gallery unavailable');
    const targets = new Map(), regions = new Map(map.regions.map(region => [region.image, region]));
    const figures = document.createDocumentFragment();
    loaded.items.forEach((item, index) => {
      const region = regions.get(item.filenames[0]);
      const label = 'Screenshot ' + (index + 1) + (region ? ' - ' + region.label : '');
      const figure = document.createElement('figure');
      figure.className = 'gallery-map-shot'; figure.id = 'map-shot-' + encodeURIComponent(item.filenames[0]);
      figure.dataset.image = item.filenames[0]; figure.tabIndex = -1;
      if (region) item.image.alt = region.label;
      figure.append(item.element);
      const description = document.createElement('figcaption'); description.textContent = label;
      figure.append(description); figures.append(figure);
      item.filenames.forEach(name => targets.set(name, figure));
    });
    screenshots.replaceChildren(figures); screenshots.hidden = false;
    const stage = document.querySelector('#public-map'); stage.hidden = false;
    GalleryMap.mount(stage, map, resolveImage, {
      caption, help: document.querySelector('#map-help'),
      onNavigate(region) {
        const target = targets.get(region.image);
        if (!target) return;
        viewerApi.selectImage(region.image);
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });

    const modal = document.querySelector('#viewer'), fullscreenStage = document.querySelector('#fullscreen-map');
    const fullscreenButton = document.querySelector('#map-fullscreen');
    let fullscreenRenderer;
    modal.addEventListener('gallery-imagechange', event => {
      const overview = event.detail.filename === map.overview.image;
      modal.classList.toggle('has-overview-map', overview);
      fullscreenStage.hidden = !overview;
      if (overview && !fullscreenRenderer) {
        fullscreenRenderer = GalleryMap.mount(fullscreenStage, map, resolveImage, {
          onNavigate(region) { viewerApi.openImage(region.image); }
        });
      } else if (!overview) {
        fullscreenRenderer?.close();
      }
    });
    modal.addEventListener('close', () => {
      fullscreenRenderer?.destroy(); fullscreenRenderer = undefined;
      fullscreenStage.hidden = true; modal.classList.remove('has-overview-map');
    });
    fullscreenButton.disabled = false;
    fullscreenButton.addEventListener('click', event => viewerApi.openImage(map.overview.image, { opener: fullscreenButton, event }));
    caption.textContent = 'Whole-level overview';
    fitMap();
  } catch (error) {
    console.error('Interactive map could not be loaded', error);
    const message = document.querySelector('#map-error'); message.textContent = 'This interactive map is not available.'; message.hidden = false;
    caption.textContent = '';
  }
})();
