const CACHE_VERSION = 'littleloop-v4';

// ── Install — skip waiting IMMEDIATELY ────────────────────────────────────────
self.addEventListener('install', (e) => {
  console.log('[SW v4] Installing...');
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(['/icons/icon-192x192.png', '/icons/icon-96x96.png']).catch(()=>{}))
      .then(() => {
        console.log('[SW v4] Installed, skipping waiting');
        return self.skipWaiting();
      })
  );
});

// ── Activate — claim all clients immediately ───────────────────────────────────
self.addEventListener('activate', (e) => {
  console.log('[SW v4] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => {
        console.log('[SW v4] Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// ── Push ───────────────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  console.log('[SW v4] Push received!', e.data ? 'has data' : 'no data');

  let data = { title: '➿ littleloop', body: 'You have a new update.' };

  if (e.data) {
    try {
      const parsed = e.data.json();
      console.log('[SW v4] Push data:', JSON.stringify(parsed));
      if (parsed.title) data = parsed;
    } catch(err) {
      console.log('[SW v4] Parse error:', err);
      try { data.body = e.data.text() || data.body; } catch {}
    }
  }

  const options = {
    body:     data.body  || 'Tap to open littleloop.',
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-96x96.png',
    tag:      data.tag   || 'littleloop',
    data:     { url: data.url || '/', littleloop: true },
    vibrate:  [200, 100, 200],
    renotify: true,
  };

  e.waitUntil(
    self.registration.showNotification(data.title || '➿ littleloop', options)
      .then(() => console.log('[SW v4] Notification shown!'))
      .catch(err => console.error('[SW v4] showNotification failed:', err))
  );
});

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  console.log('[SW v4] Notification clicked');
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('littleloop') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
