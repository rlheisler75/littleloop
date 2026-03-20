importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const CACHE_VERSION = 'littleloop-v5';

firebase.initializeApp({
  apiKey: "AIzaSyBfGko5kB7BeSy4kFzaAdfWQiG_Nk62SqU",
  authDomain: "littleloop-aa558.firebaseapp.com",
  projectId: "littleloop-aa558",
  storageBucket: "littleloop-aa558.firebasestorage.app",
  messagingSenderId: "1025731561016",
  appId: "1:1025731561016:web:4d44b61dced529072f08cd",
});

const messaging = firebase.messaging();

// ── Background push handler (Firebase) ────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW v5] Firebase background message:', JSON.stringify(payload));
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  return self.registration.showNotification(title || '➿ littleloop', {
    body:     body || 'Tap to open littleloop.',
    icon:     '/icons/icon-192x192.png',
    badge:    '/icons/icon-96x96.png',
    tag:      data.tag || 'littleloop',
    data:     { url: data.url || '/' },
    vibrate:  [200, 100, 200],
    renotify: true,
  });
});

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  console.log('[SW v5] Installing...');
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(['/icons/icon-192x192.png', '/icons/icon-96x96.png']).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  console.log('[SW v5] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fallback push handler (Web Push) ──────────────────────────────────────────
self.addEventListener('push', (e) => {
  console.log('[SW v5] Raw push received');
  // Firebase handles its own pushes via onBackgroundMessage
  // This catches any non-Firebase pushes
  let data = { title: '➿ littleloop', body: 'You have a new update.' };
  if (e.data) {
    try { const p = e.data.json(); if (p.title) data = p; } catch {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'littleloop',
      vibrate: [200, 100, 200],
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  console.log('[SW v5] Notification clicked');
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