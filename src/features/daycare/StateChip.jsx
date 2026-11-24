// Status pill for packet items: done/ok = green, todo/missing/resign/expiring = amber,
// expired = red, optional = grey.
const RED = { background: 'rgba(192,80,80,.14)', color: 'var(--err-text)', border: '1px solid rgba(192,80,80,.3)' };

export default function StateChip({ state, label, style }) {
  const cls = state === 'done' || state === 'ok' ? 'sb-a' : state === 'optional' ? 'sb-i' : state === 'expired' ? '' : 'sb-p';
  return (
    <span className={`sb ${cls}`} style={{ fontSize: 10, whiteSpace: 'nowrap', ...(state === 'expired' ? RED : {}), ...style }}>
      {label}
    </span>
  );
}
