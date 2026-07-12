import { AVAIL_DAYS, AVAIL_TIMES } from '../../lib/constants';

export function AvailabilityPicker({ value, onChange }) {
  const parsed = (() => {
    try { return typeof value === 'object' && value ? value : JSON.parse(value || '{}'); }
    catch { return {}; }
  })();

  function toggle(day, time) {
    const key  = day.toLowerCase();
    const cur  = parsed[key] || [];
    const next = cur.includes(time) ? cur.filter(t => t !== time) : [...cur, time];
    onChange({ ...parsed, [key]: next });
  }

  function toggleDay(day) {
    const key  = day.toLowerCase();
    const cur  = parsed[key] || [];
    const next = cur.length === AVAIL_TIMES.length ? [] : AVAIL_TIMES.map(t => t.id);
    onChange({ ...parsed, [key]: next });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ width: 60, padding: '6px 8px', textAlign: 'left', fontSize: 10, color: 'var(--text-faint)', fontWeight: 600 }} />
            {AVAIL_DAYS.map(d => {
              const key   = d.toLowerCase();
              const allOn = (parsed[key] || []).length === AVAIL_TIMES.length;
              return (
                <th key={d} style={{ padding: '4px 2px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => toggleDay(d)}
                    style={{
                      padding:     '3px 6px',
                      borderRadius: 6,
                      fontSize:    11,
                      fontWeight:  700,
                      cursor:      'pointer',
                      border:      `1px solid ${allOn ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`,
                      background:  allOn ? 'rgba(111,163,232,.2)' : 'transparent',
                      color:       allOn ? '#7BAAEE' : 'var(--text-dim)',
                    }}
                  >
                    {d}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {AVAIL_TIMES.map(t => (
            <tr key={t.id}>
              <td style={{ padding: '3px 8px', fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600, fontSize: 10 }}>{t.label}</div>
                <div style={{ fontSize: 9, opacity: .7 }}>{t.sub}</div>
              </td>
              {AVAIL_DAYS.map(d => {
                const key = d.toLowerCase();
                const on  = (parsed[key] || []).includes(t.id);
                return (
                  <td key={d} style={{ padding: '3px 2px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggle(d, t.id)}
                      style={{
                        width:        28,
                        height:       28,
                        borderRadius: 8,
                        cursor:       'pointer',
                        border:       `1px solid ${on ? '#7BAAEE' : 'rgba(255,255,255,.08)'}`,
                        background:   on ? 'rgba(111,163,232,.2)' : 'rgba(255,255,255,.03)',
                        fontSize:     14,
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        margin:       '0 auto',
                      }}
                    >
                      {on ? '✓' : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AvailabilityDisplay({ value }) {
  let parsed = {};
  try { parsed = typeof value === 'object' && value ? value : JSON.parse(value || '{}'); } catch {}

  const days = AVAIL_DAYS.filter(d => (parsed[d.toLowerCase()] || []).length > 0);
  if (!days.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {days.map(d => {
        const slots = (parsed[d.toLowerCase()] || [])
          .map(id => AVAIL_TIMES.find(t => t.id === id)?.label)
          .filter(Boolean);
        return (
          <span key={d} className="chip" style={{ fontSize: 10 }}>
            {d}: {slots.join(', ')}
          </span>
        );
      })}
    </div>
  );
}
