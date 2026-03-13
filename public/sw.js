const CACHE_VERSION = 'littleloop-v2';

// ── Install — don't skipWaiting immediately, avoids "site updated" notification
self.addEventListener('install', (e) => {
  // Cache essential assets silently
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(['/icons/icon-192x192.png', '/icons/icon-96x96.png'])
        .catch(() => {}) // ignore cache failures
    )
  );
  // Only skip waiting if no existing controller (first install)
  if (!self.registration.active) self.skipWaiting();
});

// ── Activate — clean old caches, claim clients silently ───────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// ── Message — allow app to trigger skipWaiting on next navigation ─────────────
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

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
    icon:     '/icons/icon-192x192.png',
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
