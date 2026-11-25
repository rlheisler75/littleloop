import { useState } from 'react';
import { RANGE_PRESETS, presetRange } from './office';

// Date range [from, to] (YYYY-MM-DD) with quick presets. Used by the Office and Clock tabs.
export default function RangePicker({ range, setRange, presets = RANGE_PRESETS }) {
  const [preset, setPreset] = useState(null);
  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {presets.map(p => (
          <button key={p.id} className="chip" onClick={() => { setPreset(p.id); setRange(presetRange(p.id)); }}
            style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, background: preset === p.id ? 'var(--accent)' : undefined, color: preset === p.id ? '#fff' : undefined }}>{p.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
        <input className="fi" type="date" value={range[0]} onChange={e => { setPreset(null); setRange([e.target.value, range[1]]); }} style={{ width: 'auto', marginBottom: 0, padding: '5px 8px' }} aria-label="From"/>
        <span>to</span>
        <input className="fi" type="date" value={range[1]} onChange={e => { setPreset(null); setRange([range[0], e.target.value]); }} style={{ width: 'auto', marginBottom: 0, padding: '5px 8px' }} aria-label="To"/>
      </div>
    </div>
  );
}
