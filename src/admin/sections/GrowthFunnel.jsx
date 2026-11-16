import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const RANGES = [[null, 'All time'], [30, '30 days'], [7, '7 days']];

const SITTER_STEPS = [
  ['signed_up',        'Signed up'],
  ['connected_family', 'Connected a family'],
  ['first_checkin',    'Did a check-in'],
  ['activated_7d',     'Checked in within 7 days of signup'],
  ['active_this_week', 'Active this week'],
  ['over_free_limit',  'Over the 2-family free limit'],
  ['paying',           'Paying for Pro'],
];
const FAMILY_STEPS = [
  ['signed_up',      'Signed up'],
  ['added_child',    'Added a child'],
  ['has_sitter',     'Connected to a sitter'],
  ['emergency_info', 'Added emergency contacts'],
];

const box = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 16, marginBottom: 20 };
const label = { fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' };

function Steps({ steps, data, color }) {
  const top = data?.[steps[0][0]] || 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {steps.map(([k, name], i) => {
        const v = data?.[k] || 0;
        const pct = top ? Math.round((v / top) * 100) : 0;
        return (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'rgba(255,255,255,.75)' }}>{name}</span>
              <span style={{ fontWeight: 700, color }}>{v}{i > 0 && <span style={{ fontWeight: 400, color: 'rgba(255,255,255,.35)' }}> · {pct}%</span>}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${i === 0 ? (top ? 100 : 0) : pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Signup → activation → paid, computed from app data (no tracking cookies).
export default function GrowthFunnel({ isMobile }) {
  const [days, setDays] = useState(null);
  const [data, setData] = useState(null);
  const [err,  setErr]  = useState(null);

  useEffect(() => {
    setData(null); setErr(null);
    supabase.rpc('admin_growth_funnel', { p_days: days }).then(({ data, error }) => error ? setErr(error.message) : setData(data));
  }, [days]);

  const weekly = data?.weekly || [];
  const maxWk = Math.max(1, ...weekly.map(w => w.sitters + w.families));

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style={label}>Growth funnel</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(([d, l]) => (
            <button key={l} onClick={() => setDays(d)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid rgba(255,255,255,.12)', background: days === d ? 'rgba(123,170,238,.2)' : 'transparent', color: days === d ? '#A8CCFF' : 'rgba(255,255,255,.5)' }}>{l}</button>
          ))}
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#F5924A' }}>{err}</div>}
      {!data && !err && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Loading…</div>}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sitters {data.sitters.referred > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>· {data.sitters.referred} via referral</span>}</div>
              <Steps steps={SITTER_STEPS} data={data.sitters} color="#7BAAEE"/>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Families</div>
              <Steps steps={FAMILY_STEPS} data={data.families} color="#CFA8FF"/>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Sign-ups per week</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70 }}>
                {weekly.map(w => (
                  <div key={w.week} title={`Week of ${w.week}: ${w.sitters} sitters, ${w.families} families`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ height: `${(w.families / maxWk) * 100}%`, background: '#CFA8FF', borderRadius: '3px 3px 0 0', minHeight: w.families ? 3 : 0 }}/>
                    <div style={{ height: `${(w.sitters / maxWk) * 100}%`, background: '#7BAAEE', minHeight: w.sitters ? 3 : 0, borderRadius: w.families ? 0 : '3px 3px 0 0' }}/>
                    <div style={{ height: 2, background: 'rgba(255,255,255,.1)' }}/>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                <span>{weekly[0]?.week?.slice(5)}</span><span>this week</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 12 }}>The time range filters by sign-up date. "Active this week" means a check-in, post or invoice in the last 7 days. Site traffic and referrers are in Vercel → Analytics.</div>
        </>
      )}
    </div>
  );
}
