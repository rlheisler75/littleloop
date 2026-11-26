import { useState } from 'react';
import Spinner from './ui/Spinner';
import { childrenText, money } from '../lib/plan';

// Monthly/yearly toggle plus one card per tier. Used for sitters (BillingTab) and daycares
// (DaycarePlanCard). `current` = the tier the account pays for now (null = none).
export default function PlanPicker({ tiers, current = null, currentInterval = 'month', hasPlan = false, busy = null, onChoose, recommend = null }) {
  const [interval, setIv] = useState(currentInterval === 'year' ? 'year' : 'month');
  return (
    <div>
      <div style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: 'var(--input-bg)', border: '1px solid var(--border)', marginBottom: 14 }}>
        {[{ id: 'month', label: 'Monthly' }, { id: 'year', label: 'Yearly · 2 months free' }].map(o => (
          <button key={o.id} type="button" onClick={() => setIv(o.id)}
            style={{ padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: interval === o.id ? 'var(--accent)' : 'transparent', color: interval === o.id ? '#fff' : 'var(--text-dim)' }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {tiers.map(t => {
          const isCurrent = current === t.id && (currentInterval === interval);
          const price = interval === 'year' ? t.yearly : t.monthly;
          const key = `${t.id}:${interval}`;
          return (
            <div key={t.id} style={{ padding: '14px 12px', borderRadius: 14, textAlign: 'center', position: 'relative',
              border: `2px solid ${isCurrent ? 'var(--ok-text,#3A9E7A)' : recommend === t.id ? 'var(--accent)' : 'var(--border)'}`,
              background: isCurrent ? 'rgba(58,158,122,.06)' : 'transparent' }}>
              {recommend === t.id && !isCurrent && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>Fits you</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)' }}>{t.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
                {money(price)}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>/{interval === 'year' ? 'yr' : 'mo'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{childrenText(t.children)}{t.hint ? <><br/><span style={{ color: 'var(--text-faint)' }}>{t.hint}</span></> : null}</div>
              {isCurrent ? (
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ok-text,#3A9E7A)', padding: '7px 0' }}>✓ Your plan</div>
              ) : (
                <button className={hasPlan ? 'bg' : 'bp'} style={{ width: '100%', padding: '7px 10px', fontSize: 12 }} disabled={!!busy}
                  onClick={() => onChoose(t.id, interval)}>
                  {busy === key ? <Spinner size={12}/> : hasPlan ? 'Switch' : 'Choose'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
