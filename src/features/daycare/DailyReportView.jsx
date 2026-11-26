import { careKind, describe, clock } from './care';

// One child's day: arrival/pickup, every logged entry in time order, and the teacher's note.
// Shared by the staff Daily tab (with onEdit) and the parent's report (read-only).
export default function DailyReportView({ logs = [], checkins = [], report = null, onEdit = null, showAuthors = true }) {
  const arrived = checkins.find(c => c.status === 'in');
  const left    = [...checkins].reverse().find(c => c.status === 'out');
  const items = [
    ...(arrived ? [{ id: 'in', at: arrived.checked_at, icon: '👋', text: `Arrived${arrived.checked_by_name ? ` · checked in by ${arrived.checked_by_name}` : ''}` }] : []),
    ...logs.map(l => ({ id: l.id, at: l.started_at, icon: careKind(l.kind).icon, text: describe(l), note: l.note, by: l.created_by_name, log: l })),
    ...(left && (!arrived || left.checked_at > arrived.checked_at) ? [{ id: 'out', at: left.checked_at, icon: '🏡', text: `Went home${left.checked_by_name ? ` · checked out by ${left.checked_by_name}` : ''}` }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div>
      {items.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic', padding: '8px 0' }}>Nothing logged yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 62, flexShrink: 0, fontSize: 11, color: 'var(--text-faint)', paddingTop: 2 }}>{clock(it.at)}</div>
            <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 1 }}>{it.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.text}</div>
              {it.note && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{it.note}</div>}
              {showAuthors && it.by && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{it.by}</div>}
            </div>
            {onEdit && it.log && (
              <button onClick={() => onEdit(it.log)} aria-label="Edit entry"
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>✏️</button>
            )}
          </div>
        ))}
      </div>
      {report?.teacher_note && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'color-mix(in srgb,var(--accent) 8%,transparent)', border: '1px solid color-mix(in srgb,var(--accent) 25%,transparent)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 3 }}>
            Note from {report.sent_by_name || 'the teacher'}
          </div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{report.teacher_note}</div>
        </div>
      )}
    </div>
  );
}
