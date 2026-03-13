// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: '➿ littleloop', body: 'You have a new update.' };

  if (e.data) {
    try {
      const parsed = e.data.json();
      if (parsed.title) data = parsed;
    } catch {
      try { data.body = e.data.text() || data.body; } catch {}
    }
  }

  const options = {
    body:     data.body  || 'Tap to open littleloop.',
    icon:     data.icon  || '/icons/icon-192x192.png',
    badge:    '/icons/icon-96x96.png',
    tag:      data.tag   || 'littleloop',
    data:     { url: data.url || '/', littleloop: true },
    vibrate:  [100, 50, 100],
    renotify: !!data.tag,
  };

  e.waitUntil(self.registration.showNotification(data.title || '➿ littleloop', options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (!e.notification.data?.littleloop) return;

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
