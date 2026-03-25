import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtHours, fmtTime, fmtDateTime } from '../../services/format';
import { EditCheckinModal, ManualCheckoutModal } from '../../components/modals/CheckinModals';
import Spinner from '../../components/ui/Spinner';

export default function SessionsList({ familyId, childrenMap, dateRange = 'week', showTitle = true }) {
  const [sessions,       setSessions]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [editEntry,      setEditEntry]      = useState(null);
  const [manualSession,  setManualSession]  = useState(null);
  const [filter,         setFilter]         = useState(dateRange);

  useEffect(() => { load(); }, [familyId, filter]);

  async function load() {
    setLoading(true);
    let query = supabase.from('sessions')
      .select('*, children:child_id(name,avatar,color)')
      .eq('family_id', familyId);

    if (filter === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      query = query.gte('checked_in_at', start.toISOString());
    } else if (filter === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      query = query.gte('checked_in_at', start.toISOString());
    } else if (filter === 'month') {
      const start = new Date(); start.setDate(start.getDate() - 30);
      query = query.gte('checked_in_at', start.toISOString());
    }

    const { data } = await query.order('checked_in_at', { ascending: false }).limit(100);
    setSessions(data || []);
    setLoading(false);
  }

  const openSessions   = sessions.filter(s => s.is_open);
  const needsReview    = sessions.filter(s => s.needs_review);
  const closedSessions = sessions.filter(s => !s.is_open);
  const totalHours     = closedSessions.reduce((s, r) => s + (r.hours || 0), 0);

  return (
    <div>
      {showTitle && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600 }}>⏱ Hours Log</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['today', 'week', 'month', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '4px 9px', borderRadius: 20, fontSize: 10, cursor: 'pointer', border: `1px solid ${filter === f ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: filter === f ? 'rgba(111,163,232,.15)' : 'transparent', color: filter === f ? '#7BAAEE' : 'var(--text-faint)', textTransform: 'capitalize' }}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Missing checkout warnings */}
      {needsReview.map(s => (
        <div key={s.checkin_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: 'rgba(200,120,74,.1)', border: '1px solid rgba(200,120,74,.3)' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F5C098' }}>Missing checkout</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {s.children?.name} checked in {fmtDateTime(s.checked_in_at)} at {fmtTime(s.checked_in_at)} — no checkout recorded
            </div>
          </div>
          <button className="bp" style={{ fontSize: 10, padding: '4px 10px', flexShrink: 0 }} onClick={() => setManualSession(s)}>Fix</button>
        </div>
      ))}

      {/* Active sessions */}
      {openSessions.filter(s => !s.needs_review).map(s => (
        <div key={s.checkin_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: 'rgba(58,158,122,.08)', border: '1px solid rgba(58,158,122,.25)' }}>
          <span style={{ fontSize: 20 }}>{s.children?.avatar || '🧒'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.children?.name}</div>
            <div style={{ fontSize: 11, color: '#88D8B8' }}>Checked in at {fmtTime(s.checked_in_at)} · {fmtHours(s.hours)} so far</div>
          </div>
          <span style={{ fontSize: 10, background: 'rgba(58,158,122,.2)', color: '#88D8B8', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Active</span>
        </div>
      ))}

      {/* Summary row */}
      {closedSessions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10, marginBottom: 10, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{closedSessions.length} session{closedSessions.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7BAAEE' }}>{fmtHours(totalHours)} total</span>
        </div>
      )}

      {/* Session rows */}
      {loading
        ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={16}/></div>
        : closedSessions.length === 0 && openSessions.filter(s => !s.needs_review).length === 0 && needsReview.length === 0
          ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', fontSize: 12 }}>No sessions recorded yet.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closedSessions.map(s => (
                <div key={s.checkin_id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.children?.avatar || '🧒'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{s.children?.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7BAAEE' }}>{fmtHours(s.hours)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setEditEntry({ id: s.checkin_id, checked_at: s.checked_in_at, checked_by_name: s.checked_in_by, label: 'Check-in' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: 'rgba(58,158,122,.1)', border: '1px solid rgba(58,158,122,.2)', color: '#88D8B8', fontSize: 10, cursor: 'pointer' }}>
                      <span>▶ In</span>
                      <span style={{ fontWeight: 600 }}>{fmtDateTime(s.checked_in_at)} {fmtTime(s.checked_in_at)}</span>
                      {s.checkin_edited && <span style={{ opacity: .6 }}>·edited</span>}
                      <span style={{ opacity: .5 }}>✏️</span>
                    </button>
                    <button onClick={() => setEditEntry({ id: s.checkout_id, checked_at: s.checked_out_at, checked_by_name: s.checked_out_by, label: 'Check-out' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: 'rgba(192,80,80,.1)', border: '1px solid rgba(192,80,80,.2)', color: '#F5AAAA', fontSize: 10, cursor: 'pointer' }}>
                      <span>■ Out</span>
                      <span style={{ fontWeight: 600 }}>{fmtDateTime(s.checked_out_at)} {fmtTime(s.checked_out_at)}</span>
                      {s.checkout_edited && <span style={{ opacity: .6 }}>·edited</span>}
                      <span style={{ opacity: .5 }}>✏️</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {editEntry && (
        <EditCheckinModal open={!!editEntry} onClose={() => setEditEntry(null)}
          entry={editEntry} label={editEntry?.label || ''}
          onSaved={() => { setEditEntry(null); load(); }}/>
      )}
      {manualSession && (
        <ManualCheckoutModal open={!!manualSession} onClose={() => setManualSession(null)}
          session={manualSession} familyId={familyId}
          onSaved={() => { setManualSession(null); load(); }}/>
      )}
    </div>
  );
}
