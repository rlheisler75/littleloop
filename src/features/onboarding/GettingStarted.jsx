import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// First-week checklist on the sitter's Families tab. It walks a new sitter to the point
// where littleloop is useful: a connected family plus a first check-in, update and invoice.
// It hides itself once every step is done, or when the sitter dismisses it.

const count = q => q.then(({ count: c }) => c || 0);

export default function GettingStarted({ sitterId, onGoTo }) {
  const dismissKey = `ll_getting_started_done_${sitterId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(dismissKey); } catch { return false; }
  });
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (dismissed) return;
    Promise.all([
      count(supabase.from('family_sitters').select('id', { count: 'exact', head: true }).eq('sitter_id', sitterId).in('status', ['active', 'pending'])),
      count(supabase.from('family_sitters').select('id', { count: 'exact', head: true }).eq('sitter_id', sitterId).eq('status', 'active')),
      count(supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('sitter_id', sitterId)),
      count(supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', sitterId)),
      count(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('sitter_id', sitterId)),
    ]).then(([invited, joined, checkins, posts, invoices]) =>
      setDone({ invited: invited > 0 || joined > 0, joined: joined > 0, checkin: checkins > 0, post: posts > 0, invoice: invoices > 0 }));
  }, [sitterId, dismissed]);

  if (dismissed || !done) return null;

  const steps = [
    { key: 'invited', label: 'Invite your first family',   hint: 'Tap “+ Invite Family” below. Families always use littleloop free.' },
    { key: 'joined',  label: 'Your family joins',          hint: 'They get an email invite. Nudge them, since it only takes a minute.' },
    { key: 'checkin', label: 'Check a child in',           hint: 'Parents get notified the moment their kids are with you.' },
    { key: 'post',    label: 'Share an update',            hint: 'A photo, meal or nap note in the Feed. Parents love these.', tab: 'feed' },
    { key: 'invoice', label: 'Send your first invoice',    hint: 'Families pay you directly by Venmo, Zelle, Cash App and more.', tab: 'invoices' },
  ];
  const completed = steps.filter(s => done[s.key]).length;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch {}
    setDismissed(true);
  };

  if (completed === steps.length) return null;

  const next = steps.find(s => !done[s.key]);

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 19, fontWeight: 600 }}>Get set up</div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>Hide</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>{completed} of {steps.length} done</div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--input-bg)', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ width: `${(completed / steps.length) * 100}%`, height: '100%', background: 'var(--accent,#7BAAEE)', transition: 'width .3s' }}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map(s => {
          const isDone = done[s.key];
          const isNext = s === next;
          return (
            <div key={s.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: isDone ? 0.55 : 1 }}>
              <div style={{ width: 20, height: 20, flex: '0 0 20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                background: isDone ? 'var(--accent,#7BAAEE)' : 'transparent', border: isDone ? 'none' : '1.5px solid var(--border)', color: '#fff' }}>
                {isDone ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: isNext ? 600 : 400, textDecoration: isDone ? 'line-through' : 'none' }}>{s.label}</div>
                {isNext && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{s.hint}</div>}
              </div>
              {isNext && s.tab && (
                <button className="bg" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => onGoTo(s.tab)}>Go →</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
