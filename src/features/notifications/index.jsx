import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { subscribeToPush } from '../../services/push';
import {
  EMAIL_PREFS_SITTER, EMAIL_PREFS_PARENT,
  PUSH_PREFS_SITTER_FULL, PUSH_PREFS_PARENT,
} from '../../lib/constants';
import { timeAgo } from '../../services/format';
import Spinner from '../../components/ui/Spinner';

// ─── In-app notification bell ─────────────────────────────────────────────────

export function NotificationCenter({ userId }) {
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [unread,  setUnread]  = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef              = useRef(null);

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('touchstart', handle); };
  }, [open]);

  async function loadUnread() {
    const { count } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('read', false);
    setUnread(count || 0);
  }

  async function loadNotifs() {
    setLoading(true);
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    setNotifs(data || []);
    setLoading(false);
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    setUnread(0);
  }

  function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    loadNotifs();
  }

  const NOTIF_ICONS = {
    new_message: '💬', new_post: '🌸', new_invoice: '💰',
    invoice_paid: '✅', checkin: '🟢', checkout: '🔴',
    eta: '🚗', connection_request: '🤝', connection_accepted: '✅',
    invoice_reminder: '🔔', review: '⭐',
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, color: 'var(--text-dim)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, background: '#E05A5A', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--body-bg,#0C1420)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'fixed', top: 60, right: 12, width: Math.min(360, window.innerWidth - 24), maxHeight: '80vh', overflowY: 'auto', background: 'var(--nav-bg,#111D2E)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.5)', zIndex: 200, padding: '16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600 }}>Notifications</div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-faint)', lineHeight: 1, padding: '0 4px' }}>✕</button>
          </div>
          {loading
            ? <div style={{ textAlign: 'center', padding: 32 }}><Spinner size={20}/></div>
            : notifs.length === 0
              ? <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-faint)', fontSize: 13 }}>No notifications yet.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {notifs.map(n => (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: n.read ? 'transparent' : 'rgba(111,163,232,.06)', border: `1px solid ${n.read ? 'transparent' : 'rgba(111,163,232,.12)'}` }}>
                      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{NOTIF_ICONS[n.type] || '🔔'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text-dim)', lineHeight: 1.4 }}>{n.title}</div>
                        {n.body && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </div>
      )}
    </div>
  );
}

// ─── Email notification preferences ──────────────────────────────────────────

export function EmailPreferencesCard({ userId, isSitter }) {
  const PREFS = isSitter ? EMAIL_PREFS_SITTER : EMAIL_PREFS_PARENT;
  const [prefs, setPrefs] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('email_preferences').select('preferences').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data) setPrefs(data.preferences || {}); });
  }, [userId]);

  async function save(newPrefs) {
    await supabase.from('email_preferences').upsert({
      user_id: userId, preferences: newPrefs, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key) {
    const newPrefs = { ...prefs, [key]: prefs[key] === false ? true : false };
    setPrefs(newPrefs);
    save(newPrefs);
  }

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📧 Email Notifications</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Choose which emails you'd like to receive.</div>
      {saved && <div style={{ fontSize: 11, color: '#5EE89A', marginBottom: 10 }}>✓ Saved</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PREFS.map(p => {
          const isOn = prefs[p.key] !== false;
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <div style={{ flex: 1, fontSize: 13 }}>{p.label}</div>
              <Toggle isOn={isOn} onToggle={() => toggle(p.key)}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Push notification preferences ───────────────────────────────────────────

export function PushPreferencesCard({ userId, isSitter }) {
  const PREFS = isSitter ? PUSH_PREFS_SITTER_FULL : PUSH_PREFS_PARENT;
  const [prefs,      setPrefs]      = useState({});
  const [permission, setPermission] = useState(Notification.permission);
  const [saved,      setSaved]      = useState(false);
  const [subbed,     setSubbed]     = useState(false);

  useEffect(() => {
    async function load() {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) setSubbed(!!(await reg.pushManager.getSubscription()));
      }
      const { data } = await supabase.from('push_preferences').select('preferences').eq('user_id', userId).maybeSingle();
      if (data) setPrefs(data.preferences || {});
    }
    load();
  }, [userId]);

  async function requestAndSubscribe() {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') { await subscribeToPush(userId); setSubbed(true); }
  }

  async function save(newPrefs) {
    await supabase.from('push_preferences').upsert({
      user_id: userId, preferences: newPrefs, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key) {
    const newPrefs = { ...prefs, [key]: prefs[key] === false ? true : false };
    setPrefs(newPrefs);
    save(newPrefs);
  }

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🔔 Push Notifications</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Get notified even when littleloop isn't open.</div>

      {permission === 'denied' ? (
        <div className="al al-e">Notifications are blocked in your browser. To enable, click the lock icon in your address bar and allow notifications for littleloop.xyz.</div>
      ) : !subbed ? (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>You haven't enabled push notifications yet.</div>
          <button className="bp" onClick={requestAndSubscribe}>Enable Push Notifications</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5EE89A' }}/>
            <div style={{ fontSize: 12, color: '#5EE89A', fontWeight: 500 }}>Push notifications enabled</div>
            {saved && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>✓ Saved</div>}
          </div>
          {/android/i.test(navigator.userAgent) && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(58,111,212,.1)', border: '1px solid rgba(58,111,212,.2)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              💡 <strong>Tip:</strong> To get pop-up notifications, open Chrome → tap the lock icon → <strong>Notifications</strong> → enable <strong>Pop on screen</strong> and <strong>Vibrate</strong>.
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>Choose which notifications you'd like to receive:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PREFS.map(p => {
              const isOn = prefs[p.key] !== false;
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div style={{ flex: 1, fontSize: 13 }}>{p.label}</div>
                  <Toggle isOn={isOn} onToggle={() => toggle(p.key)}/>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared toggle switch ─────────────────────────────────────────────────────

function Toggle({ isOn, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background .2s', flexShrink: 0, background: isOn ? 'var(--accent)' : 'rgba(255,255,255,.1)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 3, left: isOn ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }}/>
    </div>
  );
}
