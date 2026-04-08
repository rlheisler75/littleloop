// src/admin/sections/AdminBgChecks.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ExpiryBadge({ status, expiresOn }) {
  const cfg = {
    valid:         { bg: 'rgba(58,158,122,.15)',  color: '#88D8B8', label: '✅ Valid' },
    expiring_soon: { bg: 'rgba(245,192,74,.15)',  color: '#F5C84A', label: '⚠️ Expiring soon' },
    expired:       { bg: 'rgba(192,80,80,.15)',   color: '#F5AAAA', label: '❌ Expired' },
    unverified:    { bg: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', label: '⏳ Unverified' },
  };
  const c = cfg[status] || cfg.unverified;
  return (
    <div>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, fontWeight: 700 }}>
        {c.label}
      </span>
      {expiresOn && (
        <div style={{ fontSize: 10, color: status === 'expired' ? '#F5AAAA' : 'rgba(255,255,255,.3)', marginTop: 2 }}>
          {status === 'expired' ? 'Expired' : 'Expires'} {fmtDate(expiresOn)}
        </div>
      )}
    </div>
  );
}

// ── Message modal ─────────────────────────────────────────────────────────────

function MessageModal({ sitter, adminUser, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [alert,   setAlert]   = useState(null);

  const firstName = sitter.name.split(' ')[0];

  const templates = [
    {
      label: '📎 Upload reminder',
      subject: 'Background check document needed',
      body: `Hi ${firstName},\n\nWe noticed you've indicated you have a background check but haven't uploaded the document yet.\n\nPlease upload a copy in your Profile settings → Qualifications tab. This earns you a verified badge on your public profile and helps families feel confident connecting with you.\n\nThanks,\nThe littleloop team`,
    },
    {
      label: '🔍 Document issue',
      subject: 'Issue with your background check document',
      body: `Hi ${firstName},\n\nWe reviewed the background check document you uploaded but were unable to verify it. This may be because the document was unclear, incomplete, or the file was corrupted.\n\nPlease re-upload a clear copy in your Profile settings → Qualifications tab.\n\nIf you have questions, reply to this message.\n\nThanks,\nThe littleloop team`,
    },
    {
      label: '⏰ Expiry warning',
      subject: 'Your background check is expiring soon',
      body: `Hi ${firstName},\n\nYour background check is expiring soon. To maintain your verified status, please obtain a new background check and upload the updated document in your Profile settings → Qualifications tab.\n\nBackground checks are valid for 2 years on littleloop.\n\nThanks,\nThe littleloop team`,
    },
    {
      label: '✏️ Custom',
      subject: '',
      body: '',
    },
  ];

  async function send() {
    if (!subject.trim() || !body.trim()) { setAlert({ t: 'e', m: 'Subject and message are required.' }); return; }
    setSending(true); setAlert(null);
    try {
      const { error } = await supabase.from('admin_messages').insert({
        to_user_id:   sitter.id,   // sitters.id = auth.users.id
        to_name:      sitter.name,
        subject:      subject.trim(),
        body:         body.trim(),
        sent_by_name: adminUser.name,
      });
      if (error) throw error;
      onSent?.();
      onClose();
    } catch (err) { setAlert({ t: 'e', m: err.message }); setSending(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#111D2E', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>✉️ Message {sitter.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Delivered as an in-app notification</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>✕</button>
        </div>

        {alert && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12,
            background: alert.t === 's' ? 'rgba(58,158,122,.1)' : 'rgba(192,80,80,.1)',
            border: `1px solid ${alert.t === 's' ? 'rgba(58,158,122,.25)' : 'rgba(192,80,80,.25)'}`,
            color: alert.t === 's' ? '#88D8B8' : '#F5AAAA' }}>
            {alert.m}
          </div>
        )}

        {/* Templates */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 8 }}>Quick templates</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {templates.map(t => (
              <button key={t.label} onClick={() => { setSubject(t.subject); setBody(t.body); }}
                style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 6 }}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#E4EAF4', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
        </div>

        {/* Body */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 6 }}>Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Write your message…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#E4EAF4', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6, boxSizing: 'border-box' }}/>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={send} disabled={sending}
            style={{ padding: '9px 20px', borderRadius: 9, background: 'linear-gradient(135deg,#3A6FD4,#2550A8)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? .6 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {sending ? <><Spinner size={12}/> Sending…</> : '📨 Send'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sitter row ────────────────────────────────────────────────────────────────

function SitterRow({ sitter, isVerified, working, onVerify, onUnverify, onMessage }) {
  const [lightbox, setLightbox] = useState(null);
  const isPdf    = sitter.background_check_doc_url?.toLowerCase().includes('.pdf');
  const bgStatus = sitter.bg_status || (isVerified ? 'valid' : 'unverified');

  return (
    <>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <img src={lightbox} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}/>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, color: '#fff', cursor: 'pointer' }}>✕</button>
          <a href={lightbox} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none', background: 'rgba(0,0,0,.4)', padding: '6px 14px', borderRadius: 20 }}>
            Open full size ↗
          </a>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, marginBottom: 8,
        background: bgStatus === 'expired' ? 'rgba(192,80,80,.06)' : isVerified ? 'rgba(11,165,173,.06)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${bgStatus === 'expired' ? 'rgba(192,80,80,.2)' : isVerified ? 'rgba(11,165,173,.2)' : 'rgba(255,255,255,.08)'}`,
      }}>
        {/* Avatar */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.08)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {sitter.avatar_url ? <img src={sitter.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '👤'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{sitter.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px', alignItems: 'center' }}>
            {sitter.background_check_date && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Check date: {fmtDate(sitter.background_check_date)}</span>
            )}
            <ExpiryBadge status={bgStatus} expiresOn={sitter.background_check_expires_on}/>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => onMessage(sitter)} title="Message sitter"
            style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 13, cursor: 'pointer' }}>
            ✉️
          </button>

          {sitter.background_check_doc_url && (
            isPdf ? (
              <a href={sitter.background_check_doc_url} target="_blank" rel="noreferrer"
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 12, textDecoration: 'none' }}>
                📄 PDF
              </a>
            ) : (
              <button onClick={() => setLightbox(sitter.background_check_doc_url)}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 12, cursor: 'pointer' }}>
                🖼️ View
              </button>
            )
          )}

          {isVerified ? (
            <button onClick={() => onUnverify(sitter)} disabled={working}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(192,80,80,.12)', border: '1px solid rgba(192,80,80,.25)', color: '#F5AAAA', fontSize: 12, cursor: 'pointer' }}>
              {working ? <Spinner size={11}/> : 'Revoke'}
            </button>
          ) : (
            <button onClick={() => onVerify(sitter)} disabled={working}
              style={{ padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#0BA5AD,#13584E)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {working ? <Spinner size={11}/> : '🛡️ Verify'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminBgChecks({ adminUser, onVerified }) {
  const [pending,   setPending]   = useState([]);
  const [verified,  setVerified]  = useState([]);
  const [expired,   setExpired]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [working,   setWorking]   = useState({});
  const [alert,     setAlert]     = useState(null);
  const [tab,       setTab]       = useState('pending');
  const [messaging, setMessaging] = useState(null);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('sitter_bg_check_status')
      .select('*')
      .order('name');

    const all = data || [];
    setPending(all.filter(s => !s.background_check_verified && s.background_check_doc_url));
    setVerified(all.filter(s => s.background_check_verified && s.bg_status !== 'expired'));
    setExpired(all.filter(s => s.bg_status === 'expired'));
    setLoading(false);
  }

  async function verify(sitter) {
    setWorking(w => ({ ...w, [sitter.id]: true })); setAlert(null);
    try {
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('sitters').update({
        background_check_verified:    true,
        background_check_verified_at: now,
        background_check_verified_by: user.id,
      }).eq('id', sitter.id);
      if (error) throw error;
      setPending(p => p.filter(s => s.id !== sitter.id));
      setVerified(v => [{ ...sitter, background_check_verified: true, bg_status: 'valid' }, ...v]);
      onVerified?.();
      setAlert({ t: 's', m: `✅ ${sitter.name} verified.` });
    } catch (err) { setAlert({ t: 'e', m: err.message }); }
    finally { setWorking(w => ({ ...w, [sitter.id]: false })); }
  }

  async function unverify(sitter) {
    setWorking(w => ({ ...w, [sitter.id]: true }));
    try {
      await supabase.from('sitters').update({ background_check_verified: false, background_check_verified_at: null, background_check_verified_by: null }).eq('id', sitter.id);
      setVerified(v => v.filter(s => s.id !== sitter.id));
      setPending(p => [...p, { ...sitter, background_check_verified: false, bg_status: 'unverified' }].sort((a, b) => a.name.localeCompare(b.name)));
      setAlert({ t: 's', m: `${sitter.name} moved back to pending.` });
    } catch (err) { setAlert({ t: 'e', m: err.message }); }
    finally { setWorking(w => ({ ...w, [sitter.id]: false })); }
  }

  const tabs = [
    { id: 'pending',  label: 'Pending Review', count: pending.length,  warn: true },
    { id: 'verified', label: 'Verified',        count: verified.length, warn: false },
    { id: 'expired',  label: 'Expired / Due',   count: expired.length,  warn: expired.length > 0 },
  ];

  const currentList = { pending, verified, expired }[tab];
  const isVerifiedTab = tab === 'verified';

  return (
    <div>
      {messaging && (
        <MessageModal
          sitter={messaging}
          adminUser={adminUser}
          onClose={() => setMessaging(null)}
          onSent={() => setSentCount(c => c + 1)}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", marginBottom: 6 }}>
          🛡️ Background Check Review
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>
          Review submitted documents · Checks expire after 2 years · ✉️ to message a sitter
        </p>
        {sentCount > 0 && <div style={{ marginTop: 6, fontSize: 12, color: '#88D8B8' }}>✅ {sentCount} message{sentCount !== 1 ? 's' : ''} sent this session</div>}
      </div>

      {alert && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: alert.t === 's' ? 'rgba(58,158,122,.1)' : 'rgba(192,80,80,.1)',
          border: `1px solid ${alert.t === 's' ? 'rgba(58,158,122,.25)' : 'rgba(192,80,80,.25)'}`,
          color: alert.t === 's' ? '#88D8B8' : '#F5AAAA' }}>
          {alert.m}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(255,255,255,.06)' : 'transparent',
            color: tab === t.id ? '#E4EAF4' : 'rgba(255,255,255,.4)',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            borderBottom: tab === t.id ? '2px solid #7BAAEE' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', color: '#fff',
                background: t.warn && t.count > 0 ? '#F5924A' : 'rgba(255,255,255,.15)' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={24}/></div>
      ) : currentList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'pending' ? '🎉' : tab === 'verified' ? '🛡️' : '✅'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {tab === 'pending' ? 'All caught up!' : tab === 'verified' ? 'No verified sitters yet' : 'No expired checks'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
            {tab === 'pending' ? 'No documents waiting.' : tab === 'verified' ? 'Verified sitters appear here.' : 'All checks are current.'}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
            {currentList.length} sitter{currentList.length !== 1 ? 's' : ''}
            {tab === 'pending' && ' · open the doc before verifying · click ✉️ to message'}
            {tab === 'expired' && ' · click ✉️ to request renewal'}
          </div>
          {currentList.map(s => (
            <SitterRow key={s.id} sitter={s} isVerified={isVerifiedTab}
              working={working[s.id] || false}
              onVerify={verify} onUnverify={unverify} onMessage={setMessaging}/>
          ))}
        </div>
      )}
    </div>
  );
}
