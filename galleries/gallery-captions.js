// Optional, filename-anchored source captions. The editor's image schema stays unchanged.
(() => {
  const gallery = document.querySelector('.gallery');
  const template = document.querySelector('#gallery-caption-data');
  if (!gallery || !template?.content) return;

  const captions = new Map();
  for (const row of template.content.querySelectorAll('[data-image]')) {
    const filename = row.dataset.image;
    const text = row.textContent;
    if (!filename || !text.trim()) continue;
    captions.set(filename, text);
    captions.set(filename.replace(/\.[^.]+$/, '.webp'), text);
  }
  if (!captions.size) return;

  let sequence = 0;
  function mount() {
    for (const shot of gallery.querySelectorAll('.shot')) {
      if (shot.querySelector('.shot-caption')) continue;
      let filename;
      try {
        const url = new URL(shot.getAttribute('href'), document.baseURI);
        filename = decodeURIComponent(url.pathname.split('/').pop());
      } catch { continue; }
      const text = captions.get(filename);
      if (text === undefined) continue;
      const caption = document.createElement('span');
      caption.className = 'shot-caption';
      caption.id = 'gallery-source-caption-' + (++sequence);
      caption.textContent = text;
      shot.append(caption);
      shot.setAttribute('aria-describedby', caption.id);
    }
  }
  mount();
  if (typeof MutationObserver !== 'undefined') {
    // Observe gallery replacement only; adding text inside a shot cannot loop.
    const observer = new MutationObserver(mount);
    observer.observe(gallery, { childList: true });
  }
})();
