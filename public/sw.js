const CACHE_VERSION = 'littleloop-v3';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(['/icons/icon-192x192.png', '/icons/icon-96x96.png'])
        .catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  console.log('[SW] Push received', e.data ? 'with data' : 'no data');

  let data = { title: '➿ littleloop', body: 'You have a new update.' };

  if (e.data) {
    try {
      const parsed = e.data.json();
      console.log('[SW] Push parsed:', JSON.stringify(parsed));
      if (parsed.title) data = parsed;
    } catch(err) {
      console.log('[SW] Push parse error:', err);
      try { data.body = e.data.text() || data.body; } catch {}
    }
  }

  const options = {
    body:     data.body  || 'Tap to open littleloop.',
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-96x96.png',
    tag:      data.tag   || 'littleloop',
    data:     { url: data.url || '/', littleloop: true },
    vibrate:  [100, 50, 100],
    renotify: true,
  };

  e.waitUntil(
    self.registration.showNotification(data.title || '➿ littleloop', options)
      .then(() => console.log('[SW] Notification shown'))
      .catch(err => console.error('[SW] showNotification error:', err))
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('littleloop.xyz') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
