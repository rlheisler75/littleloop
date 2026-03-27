import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtHours, fmtTime, fmtDateTime } from '../../services/format';
import { EditCheckinModal, ManualCheckoutModal } from '../../components/modals/CheckinModals';
import Spinner from '../../components/ui/Spinner';

const PAGE_SIZE = 15;

export default function SessionsList({ familyId, childrenMap, dateRange = 'week', showTitle = true }) {
  const [sessions,      setSessions]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [totalCount,    setTotalCount]    = useState(0);
  const [totalHoursAll, setTotalHoursAll] = useState(0);
  const [editEntry,     setEditEntry]     = useState(null);
  const [manualSession, setManualSession] = useState(null);
  const [filter,        setFilter]        = useState(dateRange);
  const [page,          setPage]          = useState(0);

  // Reset to page 0 whenever filter or family changes
  useEffect(() => {
    setPage(0);
    setSessions([]);
  }, [filter, familyId]);

  const loadPage = useCallback(async (pageNum, append = false) => {
    pageNum === 0 ? setLoading(true) : setLoadingMore(true);

    // For "all" on first page, also fetch total count + total hours for the summary bar
    if (filter === 'all' && pageNum === 0) {
      const { data: summary } = await supabase
        .from('sessions')
        .select('hours')
        .eq('family_id', familyId)
        .eq('is_open', false);
      setTotalCount((summary || []).length);
      setTotalHoursAll((summary || []).reduce((s, r) => s + (r.hours || 0), 0));
    }

    const { data } = await buildBaseQuery(familyId, filter)
      .order('checked_in_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    setSessions(prev => append ? [...prev, ...(data || [])] : (data || []));
    pageNum === 0 ? setLoading(false) : setLoadingMore(false);
  }, [familyId, filter]);

  useEffect(() => { loadPage(0); }, [loadPage]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    loadPage(next, true);
  }

  const openSessions   = sessions.filter(s => s.is_open);
  const needsReview    = sessions.filter(s => s.needs_review);
  const closedSessions = sessions.filter(s => !s.is_open);

  // Hours: use pre-fetched total on "all", compute from loaded data otherwise
  const totalHours = filter === 'all'
    ? totalHoursAll
    : closedSessions.reduce((s, r) => s + (r.hours || 0), 0);

  const hasMore   = filter === 'all' && closedSessions.length < totalCount;
  const remaining = totalCount - closedSessions.length;

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

      {/* Summary bar — session count + total hours */}
      {(closedSessions.length > 0 || (filter === 'all' && totalCount > 0)) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10, marginBottom: 10, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {filter === 'all'
              ? `${totalCount} session${totalCount !== 1 ? 's' : ''} total`
              : `${closedSessions.length} session${closedSessions.length !== 1 ? 's' : ''}`}
          </span>
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

      {/* Load more button — only on All tab */}
      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore}
          style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loadingMore
            ? <><Spinner size={12}/> Loading…</>
            : `Load ${Math.min(remaining, PAGE_SIZE)} more · ${remaining} remaining`}
        </button>
      )}

      {editEntry && (
        <EditCheckinModal open={!!editEntry} onClose={() => setEditEntry(null)}
          entry={editEntry} label={editEntry?.label || ''}
          onSaved={() => { setEditEntry(null); loadPage(0); }}/>
      )}
      {manualSession && (
        <ManualCheckoutModal open={!!manualSession} onClose={() => setManualSession(null)}
          session={manualSession} familyId={familyId}
          onSaved={() => { setManualSession(null); loadPage(0); }}/>
      )}
    </div>
  );
}

// ─── Shared query builder ────────────────────────────────────────────────────

function buildBaseQuery(familyId, filter) {
  let q = supabase.from('sessions')
    .select('*, children:child_id(name,avatar,color)')
    .eq('family_id', familyId);

  if (filter === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    q = q.gte('checked_in_at', start.toISOString());
  } else if (filter === 'week') {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);
    q = q.gte('checked_in_at', start.toISOString());
  } else if (filter === 'month') {
    const start = new Date(); start.setDate(start.getDate() - 30);
    q = q.gte('checked_in_at', start.toISOString());
  }
  // 'all' — no date filter, caller applies .range() for pagination

  return q;
}
