const CACHE_NAME = 'littleloop-v1';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data;
  try { data = e.data.json(); }
  catch { data = { title: 'littleloop', body: e.data.text() }; }

  const title = data.title || 'littleloop';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icons/icon-192x192.png',
    badge:   '/icons/icon-96x96.png',
    tag:     data.tag   || 'littleloop',
    data:    { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing tab if open
      for (const client of list) {
        if (client.url.includes('littleloop.xyz') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
