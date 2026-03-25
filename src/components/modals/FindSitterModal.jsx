import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendPushNotification } from '../../services/push';
import { Modal } from '../ui/Modal';
import Spinner from '../ui/Spinner';

export default function FindSitterModal({ open, onClose, familyId, familyName, onRequested }) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [sent,      setSent]      = useState({});
  const [alert,     setAlert]     = useState(null);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSent({}); setAlert(null); }
  }, [open]);

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setAlert(null);
    const { data } = await supabase.from('sitters')
      .select('id,name,username,bio,avatar_url,hourly_rate_min,hourly_rate_max')
      .eq('public_profile', true)
      .or(`username.ilike.%${query.trim()}%,name.ilike.%${query.trim()}%`)
      .limit(8);
    setResults(data || []);
    if (!data?.length) setAlert({ t: 'i', m: 'No sitters found. Try a different name or username.' });
    setSearching(false);
  }

  async function sendRequest(sitter) {
    const { data: existing } = await supabase.from('family_sitters')
      .select('id,status').eq('family_id', familyId).eq('sitter_id', sitter.id).maybeSingle();

    if (existing && existing.status !== 'inactive') {
      setSent(s => ({ ...s, [sitter.id]: existing.status === 'active' ? 'connected' : 'requested' }));
      return;
    }

    const { error } = existing
      ? await supabase.from('family_sitters').update({ status: 'requested' }).eq('id', existing.id)
      : await supabase.from('family_sitters').insert({ family_id: familyId, sitter_id: sitter.id, status: 'requested', initiated_by: 'family' });

    if (!error) {
      setSent(s => ({ ...s, [sitter.id]: 'requested' }));
      sendPushNotification(
        [sitter.id],
        `New connection request from ${familyName}`,
        'Tap to view and accept.',
        '/?portal=sitter',
        'new_request'
      );
      onRequested?.();
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Find a Sitter</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>Search by name or username to send a connection request.</p>
      {alert && <div className={`al al-${alert.t}`} style={{ marginBottom: 12 }}>{alert.m}</div>}

      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="fi" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or @username" style={{ marginBottom: 0, flex: 1 }}/>
        <button type="submit" className="bp" style={{ flexShrink: 0 }} disabled={searching}>
          {searching ? <Spinner size={14}/> : 'Search'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(s => {
          const status = sent[s.id];
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'var(--input-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {s.avatar_url ? <img src={s.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={s.name}/> : '➿'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                {s.username && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>@{s.username}</div>}
                {(s.hourly_rate_min || s.hourly_rate_max) && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>${s.hourly_rate_min || '?'}–${s.hourly_rate_max || '?'}/hr</div>
                )}
              </div>
              {status === 'connected'
                ? <span className="sb sb-a" style={{ fontSize: 10 }}>Connected</span>
                : status === 'requested'
                  ? <span className="sb sb-p" style={{ fontSize: 10 }}>Requested</span>
                  : <button className="bp" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }} onClick={() => sendRequest(s)}>+ Connect</button>
              }
            </div>
          );
        })}
      </div>

      <button className="bg" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Close</button>
    </Modal>
  );
}
