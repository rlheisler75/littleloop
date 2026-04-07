// src/admin/sections/AdminBgChecks.jsx
// Background check document review queue.
// Shows sitters who have uploaded a doc but haven't been verified yet,
// plus a log of already-verified sitters.

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';

export default function AdminBgChecks({ adminUser, onVerified }) {
  const [pending,    setPending]    = useState([]);
  const [verified,   setVerified]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [working,    setWorking]    = useState({}); // sitter id → true while saving
  const [alert,      setAlert]      = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [tab,        setTab]        = useState('pending'); // 'pending' | 'verified'

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    // Pending: have a doc but not yet verified
    const { data: pend } = await supabase
      .from('sitters')
      .select('id, name, background_check_date, background_check_doc_url, background_check_verified_at, avatar_url')
      .eq('background_check', true)
      .not('background_check_doc_url', 'is', null)
      .eq('background_check_verified', false)
      .order('name');

    // Verified: already approved
    const { data: ver } = await supabase
      .from('sitters')
      .select('id, name, background_check_date, background_check_doc_url, background_check_verified_at, avatar_url')
      .eq('background_check_verified', true)
      .order('background_check_verified_at', { ascending: false });

    setPending(pend || []);
    setVerified(ver || []);
    setLoading(false);
  }

  async function verify(sitter) {
    setWorking(w => ({ ...w, [sitter.id]: true }));
    setAlert(null);
    try {
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('sitters').update({
        background_check_verified:    true,
        background_check_verified_at: now,
        background_check_verified_by: user.id,
      }).eq('id', sitter.id);
      if (error) throw error;

      // Move from pending → verified list
      setPending(p => p.filter(s => s.id !== sitter.id));
      setVerified(v => [{ ...sitter, background_check_verified_at: now }, ...v]);
      onVerified?.();
      setAlert({ t: 's', m: `✅ ${sitter.name} marked as verified.` });
    } catch (err) {
      setAlert({ t: 'e', m: err.message });
    } finally {
      setWorking(w => ({ ...w, [sitter.id]: false }));
    }
  }

  async function unverify(sitter) {
    setWorking(w => ({ ...w, [sitter.id]: true }));
    setAlert(null);
    try {
      const { error } = await supabase.from('sitters').update({
        background_check_verified:    false,
        background_check_verified_at: null,
        background_check_verified_by: null,
      }).eq('id', sitter.id);
      if (error) throw error;

      setVerified(v => v.filter(s => s.id !== sitter.id));
      setPending(p => [...p, { ...sitter, background_check_verified_at: null }].sort((a, b) => a.name.localeCompare(b.name)));
      setAlert({ t: 's', m: `${sitter.name} moved back to pending.` });
    } catch (err) {
      setAlert({ t: 'e', m: err.message });
    } finally {
      setWorking(w => ({ ...w, [sitter.id]: false }));
    }
  }

  function SitterRow({ sitter, isVerified }) {
    const isPdf = sitter.background_check_doc_url?.toLowerCase().includes('.pdf');
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        borderRadius: 12,
        background: isVerified ? 'rgba(11,165,173,.06)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${isVerified ? 'rgba(11,165,173,.2)' : 'rgba(255,255,255,.08)'}`,
        marginBottom: 8,
      }}>

        {/* Avatar */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.08)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {sitter.avatar_url
            ? <img src={sitter.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : '👤'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{sitter.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
            {sitter.background_check_date && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                Check date: {new Date(sitter.background_check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {isVerified && sitter.background_check_verified_at && (
              <span style={{ fontSize: 11, color: '#0BA5AD' }}>
                🛡️ Verified {new Date(sitter.background_check_verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* View document */}
          {sitter.background_check_doc_url && (
            isPdf ? (
              <a
                href={sitter.background_check_doc_url}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                📄 View PDF
              </a>
            ) : (
              <button
                onClick={() => setPreviewUrl(sitter.background_check_doc_url)}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', fontSize: 12, cursor: 'pointer' }}
              >
                🖼️ View Doc
              </button>
            )
          )}

          {/* Verify / Unverify */}
          {isVerified ? (
            <button
              onClick={() => unverify(sitter)}
              disabled={working[sitter.id]}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(192,80,80,.12)', border: '1px solid rgba(192,80,80,.25)', color: '#F5AAAA', fontSize: 12, cursor: 'pointer' }}
            >
              {working[sitter.id] ? <Spinner size={11}/> : 'Revoke'}
            </button>
          ) : (
            <button
              onClick={() => verify(sitter)}
              disabled={working[sitter.id]}
              style={{ padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#0BA5AD,#13584E)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {working[sitter.id] ? <Spinner size={11}/> : <>🛡️ Verify</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", marginBottom: 6 }}>
          🛡️ Background Check Review
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>
          Review documents submitted by sitters. Verified sitters receive a prominent badge on their public profile.
        </p>
      </div>

      {alert && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: alert.t === 's' ? 'rgba(58,158,122,.1)' : 'rgba(192,80,80,.1)',
          border: `1px solid ${alert.t === 's' ? 'rgba(58,158,122,.25)' : 'rgba(192,80,80,.25)'}`,
          color: alert.t === 's' ? '#88D8B8' : '#F5AAAA',
        }}>
          {alert.m}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0 }}>
        {[
          { id: 'pending',  label: 'Pending Review', count: pending.length },
          { id: 'verified', label: 'Verified',        count: verified.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0',
            border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(255,255,255,.06)' : 'transparent',
            color: tab === t.id ? '#E4EAF4' : 'rgba(255,255,255,.4)',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            borderBottom: tab === t.id ? '2px solid #7BAAEE' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: t.id === 'pending' && t.count > 0 ? '#F5924A' : 'rgba(255,255,255,.15)',
                color: '#fff', borderRadius: 10, padding: '1px 6px',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={24}/></div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>All caught up!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>No background checks pending review.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
              {pending.length} document{pending.length !== 1 ? 's' : ''} awaiting review — open each doc before verifying.
            </div>
            {pending.map(s => <SitterRow key={s.id} sitter={s} isVerified={false}/>)}
          </div>
        )
      ) : (
        verified.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No verified sitters yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Verified sitters will appear here.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>
              {verified.length} sitter{verified.length !== 1 ? 's' : ''} verified · click Revoke to remove verification.
            </div>
            {verified.map(s => <SitterRow key={s.id} sitter={s} isVerified={true}/>)}
          </div>
        )
      )}

      {/* Image preview lightbox */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}/>
          <button
            onClick={() => setPreviewUrl(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none', background: 'rgba(0,0,0,.4)', padding: '6px 14px', borderRadius: 20 }}
          >
            Open full size ↗
          </a>
        </div>
      )}
    </div>
  );
}
