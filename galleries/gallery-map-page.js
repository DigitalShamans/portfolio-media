'use strict';

(async () => {
  const caption = document.querySelector('#map-caption');
  try {
    const options = JSON.parse(document.querySelector('#gallery-map-options').textContent);
    const folder = new URLSearchParams(location.search).get('gallery') || options.defaultGallery;
    if (!/^hb-[a-z0-9-]+$/.test(folder) || !Object.hasOwn(options.galleries, folder) || !options.galleries[folder].hasMap) throw new Error('Map unavailable');
    const gallery = options.galleries[folder], versions = gallery.versions || {};
    const root = new URL(options.galleryRoot + folder + '/', location.origin);
    const url = new URL('gallery-map.json', root);
    if (versions['gallery-map.json']) url.searchParams.set('v', versions['gallery-map.json']);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Map unavailable');
    const map = GalleryMapData.parse(await response.text(), new Set(Object.keys(versions).filter(name => name !== 'gallery.json' && name !== 'gallery-map.json')));
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
    GalleryMap.mount(stage, map, resolveImage, { caption, help: document.querySelector('#map-help') });
    caption.textContent = 'Whole-level overview';
  } catch {
    const error = document.querySelector('#map-error'); error.textContent = 'This interactive map is not available.'; error.hidden = false;
    caption.textContent = '';
  }
})();
