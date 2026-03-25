import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../services/format';
import Spinner from '../../components/ui/Spinner';

// ─── Single child check-in toggle ────────────────────────────────────────────

export function CheckInButton({ child, familyId, currentUserId, checkerName, isSitter, onChecked }) {
  const [status,    setStatus]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [lastEntry, setLastEntry] = useState(null);

  useEffect(() => {
    async function loadStatus() {
      const { data } = await supabase.from('checkins').select('*')
        .eq('child_id', child.id)
        .order('checked_at', { ascending: false })
        .limit(1).maybeSingle();
      if (data) { setStatus(data.status); setLastEntry(data); }
      else setStatus(null);
    }
    loadStatus();
  }, [child.id]);

  async function toggle() {
    setLoading(true);
    const newStatus = status === 'in' ? 'out' : 'in';
    const now       = new Date().toISOString();
    const { data: inserted, error } = await supabase.from('checkins').insert({
      child_id:        child.id,
      family_id:       familyId,
      status:          newStatus,
      checked_by:      currentUserId,
      checked_by_name: checkerName,
      checked_by_role: isSitter ? 'sitter' : 'member',
      checked_at:      now,
    }).select().single();
    if (error) {
      console.error('checkin error:', error);
    } else {
      setStatus(newStatus);
      setLastEntry(inserted || { status: newStatus, checked_at: now, checked_by_name: checkerName });
      onChecked?.(child.id, newStatus);
    }
    setLoading(false);
  }

  const isIn     = status === 'in';
  const btnColor = isIn
    ? 'linear-gradient(135deg,#E05A5A,#B03030)'
    : 'linear-gradient(135deg,#3A9E7A,#2A7A5A)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={toggle} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: 'none', background: btnColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: loading ? .6 : 1, transition: 'all .2s' }}>
        {loading ? <Spinner size={10}/> : isIn ? '✓ Checked In' : '⊕ Check In'}
      </button>
      {lastEntry && (
        <div style={{ fontSize: 9, color: 'var(--text-faint)', lineHeight: 1.4 }}>
          {status === 'in' ? 'In' : 'Out'} · {timeAgo(lastEntry.checked_at)} · {lastEntry.checked_by_name}
        </div>
      )}
    </div>
  );
}

// ─── Check in / out all children at once ────────────────────────────────────

export function MultiCheckInButton({ children, familyId, currentUserId, checkerName, isSitter }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function checkAll() {
    setLoading(true);
    const now = new Date().toISOString();

    const statuses = await Promise.all(children.map(async c => {
      const { data } = await supabase.from('checkins').select('status')
        .eq('child_id', c.id).order('checked_at', { ascending: false }).limit(1).maybeSingle();
      return { child: c, lastStatus: data?.status || null };
    }));

    const allIn     = statuses.every(s => s.lastStatus === 'in');
    const newStatus = allIn ? 'out' : 'in';

    await supabase.from('checkins').insert(
      statuses.map(({ child }) => ({
        child_id:        child.id,
        family_id:       familyId,
        status:          newStatus,
        checked_by:      currentUserId,
        checked_by_name: checkerName,
        checked_by_role: isSitter ? 'sitter' : 'member',
        checked_at:      now,
      }))
    );

    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
    window.dispatchEvent(new CustomEvent('checkin-update'));
  }

  return (
    <button onClick={checkAll} disabled={loading || done}
      style={{ padding: '4px 10px', borderRadius: 10, border: '1px solid rgba(58,158,122,.3)', background: 'rgba(58,158,122,.1)', color: '#88D8B8', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
      {loading ? <Spinner size={10}/> : done ? '✓ Done' : '⊕ Check in all'}
    </button>
  );
}
