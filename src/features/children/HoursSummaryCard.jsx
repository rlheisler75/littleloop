import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtHours, fmtTime, fmtDateTime } from '../../services/format';
import Spinner from '../../components/ui/Spinner';

// ─── Hours summary card for parent home tab ───────────────────────────────────

export function HoursSummaryCard({ familyId, children }) {
  const [openSessions, setOpenSessions] = useState([]);
  const [weekHours,    setWeekHours]    = useState(0);
  const [needsReview,  setNeedsReview]  = useState([]);

  useEffect(() => { load(); }, [familyId]);

  async function load() {
    const now       = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data } = await supabase.from('sessions')
      .select('*,children:child_id(name,avatar)')
      .eq('family_id', familyId)
      .gte('checked_in_at', weekStart.toISOString());

    const open   = (data || []).filter(s => s.is_open && !s.needs_review);
    const review = (data || []).filter(s => s.needs_review);
    const closed = (data || []).filter(s => !s.is_open);
    setOpenSessions(open);
    setNeedsReview(review);
    setWeekHours(closed.reduce((s, r) => s + (r.hours || 0), 0));
  }

  if (openSessions.length === 0 && weekHours === 0 && needsReview.length === 0) return null;

  return (
    <div className="card fade-up" style={{ padding: '14px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>⏱</span>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600 }}>Hours This Week</span>
        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: '#7BAAEE' }}>{fmtHours(weekHours)}</span>
      </div>
      {needsReview.map(s => (
        <div key={s.checkin_id} style={{ fontSize: 11, color: '#F5C098', marginBottom: 4, padding: '6px 10px', background: 'rgba(200,120,74,.08)', borderRadius: 8, border: '1px solid rgba(200,120,74,.2)' }}>
          ⚠️ {s.children?.name} — missing checkout from {fmtDateTime(s.checked_in_at)}
        </div>
      ))}
      {openSessions.map(s => (
        <div key={s.checkin_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(58,158,122,.08)', borderRadius: 8, border: '1px solid rgba(58,158,122,.2)', marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{s.children?.avatar || '🧒'}</span>
          <span style={{ fontSize: 12, flex: 1 }}>{s.children?.name} is checked in</span>
          <span style={{ fontSize: 11, color: '#88D8B8', fontWeight: 600 }}>{fmtHours(s.hours)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Checkin log (raw event list, sitter view) ────────────────────────────────

export function CheckinLog({ familyId }) {
  const [log,     setLog]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase.from('checkins')
        .select('*, children(name,avatar)')
        .eq('family_id', familyId)
        .order('checked_at', { ascending: false });

      if (filter === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        query = query.gte('checked_at', start.toISOString());
      } else if (filter === 'week') {
        const start = new Date();
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        query = query.gte('checked_at', start.toISOString());
      }

      const { data } = await query.limit(100);
      setLog(data || []);
      setLoading(false);
    }
    load();
  }, [familyId, filter]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600 }}>Check-in Log</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['today', 'week', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${filter === f ? 'var(--accent,#7BAAEE)' : 'var(--border)'}`, background: filter === f ? 'rgba(111,163,232,.15)' : 'transparent', color: filter === f ? 'var(--accent,#7BAAEE)' : 'var(--text-faint)', fontSize: 10, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f === 'all' ? 'All time' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={16}/></div>
        : log.length === 0
          ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', fontSize: 12 }}>No check-ins recorded yet.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {log.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{entry.children?.avatar || '🧒'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.children?.name || 'Unknown'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                      {entry.checked_by_name} · {new Date(entry.checked_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: entry.status === 'in' ? 'rgba(58,158,122,.15)' : 'rgba(192,80,80,.15)', color: entry.status === 'in' ? '#88D8B8' : '#F5AAAA', border: `1px solid ${entry.status === 'in' ? 'rgba(58,158,122,.25)' : 'rgba(192,80,80,.25)'}` }}>
                    {entry.status === 'in' ? 'Checked In' : 'Checked Out'}
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
