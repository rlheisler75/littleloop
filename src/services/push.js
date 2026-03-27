import { supabase } from '../lib/supabase';

// ─── Firebase config ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyBfGko5kB7BeSy4kFzaAdfWQiG_Nk62SqU',
  authDomain:        'littleloop-aa558.firebaseapp.com',
  projectId:         'littleloop-aa558',
  storageBucket:     'littleloop-aa558.firebasestorage.app',
  messagingSenderId: '1025731561016',
  appId:             '1:1025731561016:web:4d44b61dced529072f08cd',
};

const FIREBASE_VAPID_KEY = 'BC8hDE8RmkIYX3wYXsxzeNWoU4rr4Zp-0lJkzTKiowOHbHOBinKK_IdXm1j9gjINhC_gZMCK5_eN9YCLJVZt7qI';

let _fbMessaging = null;

export async function getFirebaseMessaging() {
  if (_fbMessaging) return _fbMessaging;
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
    const supported = await isSupported();
    if (!supported) { console.warn('[Push] Firebase Messaging not supported'); return null; }
    const fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    _fbMessaging = { messaging: getMessaging(fbApp), getToken };
    return _fbMessaging;
  } catch (e) {
    console.error('[Push] Firebase import failed:', e);
    return null;
  }
}

export async function subscribeToPush(userId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { console.warn('[Push] Permission denied'); return; }

    const reg = await navigator.serviceWorker.ready;
    const fb = await getFirebaseMessaging();
    if (!fb) { console.warn('[Push] Firebase not available'); return; }

    const fcmToken = await fb.getToken(fb.messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!fcmToken) { console.warn('[Push] No FCM token returned'); return; }
    console.log('[Push] Firebase token:', fcmToken.slice(0, 20) + '...');

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id:      userId,
      fcm_token:    fcmToken,
      subscription: { fcm_token: fcmToken, type: 'firebase' },
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) console.error('[Push] Save failed:', error);
    else console.log('[Push] Firebase token saved for', userId);
  } catch (e) {
    console.warn('[Push] Subscribe failed:', e);
  }
}

export function sendPushNotification(userIds, title, body, url, tag) {
  if (!userIds?.length) return;
  supabase.functions.invoke('send-push', {
    body: { userIds, title, body, url, tag },
  }).catch(console.error);
}

export function invokeNotification(data) {
  const body = data?.body ?? data;
  supabase.functions.invoke('send-notification', { body }).catch(console.error);
}

// ─── Register service worker immediately on page load ─────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('[SW] Registered:', reg.scope, 'active:', !!reg.active))
      .catch(err => console.error('[SW] Failed:', err));
  });
}
