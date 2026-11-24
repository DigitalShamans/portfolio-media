'use strict';

const GalleryEmbeds = (() => {
  const providers = {
    sketchfab: { id: /^[a-f0-9]{32}$/, origin: 'https://sketchfab.com/models/', suffix: '/embed' },
    youtube: { id: /^[A-Za-z0-9_-]{11}$/, origin: 'https://www.youtube-nocookie.com/embed/', suffix: '?rel=0' },
  };
  // Require the absolute end; $ alone also accepts a final newline.
  const videoFile = /^[A-Za-z0-9][A-Za-z0-9_-]*\.mp4(?![\s\S])/;

  function anchorIndex(entries, filename) {
    return entries.findIndex(entry => GalleryData.images(entry).includes(filename));
  }

  function source(embed) {
    if (embed.type === 'video') return embed.file;
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
      const validSource = embed && (embed.type === 'video'
        ? typeof embed.file === 'string' && videoFile.test(embed.file)
        : provider && typeof embed.id === 'string' && provider.id.test(embed.id));
      if (!validSource ||
          typeof embed.title !== 'string' || !embed.title.trim() ||
          (embed.caption !== undefined && typeof embed.caption !== 'string') ||
          (embed.after === undefined && embed.before === undefined) ||
          (embed.after !== undefined && !GalleryData.isImageName(embed.after)) ||
          (embed.before !== undefined && !GalleryData.isImageName(embed.before))) {
        throw new Error('Each viewer needs a supported provider ID or local MP4 basename, title and gallery image anchor.');
      }
      const key = embed.type + ':' + (embed.type === 'video' ? embed.file : embed.id);
      if (used.has(key)) throw new Error('Embedded viewer appears more than once: ' + key);
      used.add(key);
    }
    return embeds;
  }

  async function mount(gallery, entries, elements, url, assetUrl) {
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
        const media = document.createElement(embed.type === 'video' ? 'video' : 'iframe');
        const mediaSource = source(embed);
        media.src = embed.type === 'video' && assetUrl ? assetUrl(mediaSource) : mediaSource;
        media.title = embed.title;
        media.width = 1280;
        media.height = 720;
        if (embed.type === 'video') {
          media.controls = true;
          media.playsInline = true;
          media.preload = 'metadata';
        } else {
          media.loading = 'lazy';
          media.allow = embed.type === 'sketchfab'
            ? 'autoplay; fullscreen; xr-spatial-tracking'
            : 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          media.allowFullscreen = true;
          media.referrerPolicy = 'strict-origin-when-cross-origin';
        }
        section.append(heading, media);
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
