'use strict';

const GalleryEmbeds = (() => {
  const providers = {
    sketchfab: { id: /^[a-f0-9]{32}$/, origin: 'https://sketchfab.com/models/', suffix: '/embed' },
    youtube: { id: /^[A-Za-z0-9_-]{11}$/, origin: 'https://www.youtube-nocookie.com/embed/', suffix: '?rel=0' },
  };

  function anchorIndex(entries, filename) {
    return entries.findIndex(entry => GalleryData.images(entry).includes(filename));
  }

  function source(embed) {
    const provider = providers[embed.type];
    return provider.origin + embed.id + provider.suffix;
  }

  function parse(text) {
    let embeds;
    try { embeds = JSON.parse(text); }
    catch { throw new Error('gallery-embeds.json is not valid JSON.'); }
    if (!Array.isArray(embeds) || !embeds.length) {
      throw new Error('gallery-embeds.json must contain at least one viewer.');
    }
    const used = new Set();
    for (const embed of embeds) {
      const provider = embed && Object.hasOwn(providers, embed.type) && providers[embed.type];
      if (!provider || typeof embed.id !== 'string' || !provider.id.test(embed.id) ||
          typeof embed.title !== 'string' || !embed.title.trim() ||
          (embed.caption !== undefined && typeof embed.caption !== 'string') ||
          (embed.after === undefined && embed.before === undefined) ||
          (embed.after !== undefined && !GalleryData.isImageName(embed.after)) ||
          (embed.before !== undefined && !GalleryData.isImageName(embed.before))) {
        throw new Error('Each viewer needs a supported provider, model/video ID, title and gallery image anchor.');
      }
      const key = embed.type + ':' + embed.id;
      if (used.has(key)) throw new Error('Embedded viewer appears more than once: ' + key);
      used.add(key);
    }
    return embeds;
  }

  async function mount(gallery, entries, elements, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Embedded viewer list unavailable.');
      const embeds = parse(await response.text());
      const tails = new Map();
      for (const embed of embeds) {
        const index = anchorIndex(entries, embed.after);
        const section = document.createElement('section');
        section.className = 'gallery-embed';
        const heading = document.createElement('h2');
        heading.textContent = embed.title;
        const iframe = document.createElement('iframe');
        iframe.src = source(embed);
        iframe.title = embed.title;
        iframe.loading = 'lazy';
        iframe.width = 1280;
        iframe.height = 720;
        iframe.allow = embed.type === 'sketchfab'
          ? 'autoplay; fullscreen; xr-spatial-tracking'
          : 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        section.append(heading, iframe);
        if (embed.caption) {
          const caption = document.createElement('p');
          caption.textContent = embed.caption;
          section.append(caption);
        }
        if (index >= 0) {
          const anchor = tails.get(index) || elements[index];
          anchor.after(section);
          tails.set(index, section);
        } else {
          const next = elements[anchorIndex(entries, embed.before)]
            ?? (embed.after === undefined ? elements[0] : undefined);
          if (next) next.before(section);
          else gallery.append(section);
        }
      }
    } catch (error) {
      console.error('Gallery embeds could not be loaded', error);
      const message = document.createElement('p');
      message.className = 'gallery-embed-error';
      message.setAttribute('role', 'status');
      message.textContent = 'The embedded viewers could not be loaded. Please refresh to try again.';
      gallery.append(message);
    }
  }

  return { parse, anchorIndex, source, mount };
})();
