import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import { errText } from './api';
import { localDate, addDays } from './enrollment';
import { downloadCsv } from './office';
import { esc, printWindow } from './learning';
import { servedMeals, mealLabel } from './kitchen';

// USDA food program (CACFP) monthly meal counts, for the director and office. Counts are the
// meals teachers log (one per child per meal per day), split by each child's free / reduced /
// paid category. The claim itself is filed with the state; this gives the numbers and flags
// anything an auditor would question.
const CATS = [
  { id: 'free', label: 'Free' }, { id: 'reduced', label: 'Reduced' }, { id: 'paid', label: 'Paid' }, { id: 'unset', label: 'Not set' },
];
const monthOf = (iso = localDate()) => iso.slice(0, 8) + '01';
const shiftMonth = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n, 1); return localDate(d).slice(0, 8) + '01'; };
const monthName = iso => new Date(iso + 'T12:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' });
const dayShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export default function FoodProgram({ facility, facilityId, settings, kids }) {
  const [month, setMonth] = useState(monthOf());
  const [data,  setData]  = useState(null);
  const [cats,  setCats]  = useState(null);   // child_id -> row
  const [err,   setErr]   = useState(null);
  const [show,  setShow]  = useState('report');
  const meals = servedMeals(settings);

  const load = useCallback(async () => {
    const [{ data: d, error }, { data: c }] = await Promise.all([
      supabase.rpc('daycare_cacfp_month', { p_facility: facilityId, p_month: month }),
      supabase.from('daycare_cacfp_children').select('*').eq('facility_id', facilityId),
    ]);
    if (error) setErr(errText(error));
    setData(d || null);
    setCats(Object.fromEntries((c || []).map(r => [r.child_id, r])));
  }, [facilityId, month]);
  useEffect(() => { setData(null); load(); }, [load]);

  // Totals per meal per category, and per day per meal
  const counts = data?.counts || [];
  const total = (meal, cat) => counts.filter(r => r.meal === meal && (!cat || r.category === cat)).reduce((s, r) => s + r.n, 0);
  const days = [...new Set([...counts.map(r => r.day), ...(data?.attendance || []).map(a => a.day)])].sort();
  const att = Object.fromEntries((data?.attendance || []).map(a => [a.day, a.n]));
  const dayMeal = (day, meal) => counts.filter(r => r.day === day && r.meal === meal).reduce((s, r) => s + r.n, 0);
  const unset = kids.filter(k => !cats?.[k.child_id]).length;

  function csv() {
    downloadCsv(`food-program-${month.slice(0, 7)}.csv`, [
      ['Date', 'Children here', ...meals.flatMap(m => CATS.map(c => `${m.label} (${c.label})`))],
      ...days.map(d => [d, att[d] || 0, ...meals.flatMap(m => CATS.map(c => counts.filter(r => r.day === d && r.meal === m.id && r.category === c.id).reduce((s, r) => s + r.n, 0)))]),
      ['Total', '', ...meals.flatMap(m => CATS.map(c => total(m.id, c.id)))],
    ]);
  }
  function print() {
    printWindow(`Food program ${monthName(month)}`, `
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:right}
      th{background:#f1f5f9}td:first-child,th:first-child{text-align:left}.tot td{font-weight:700}`,
      `<h1>Meal counts: ${esc(monthName(month))}</h1><div class="sub">${esc(facility?.name || '')} · USDA Child and Adult Care Food Program</div>
       <table><tr><th>Meal</th>${CATS.map(c => `<th>${c.label}</th>`).join('')}<th>Total</th></tr>
       ${meals.map(m => `<tr><td>${esc(m.label)}</td>${CATS.map(c => `<td>${total(m.id, c.id)}</td>`).join('')}<td><b>${total(m.id)}</b></td></tr>`).join('')}</table>
       <table><tr><th>Date</th><th>Here</th>${meals.map(m => `<th>${esc(m.short)}</th>`).join('')}</tr>
       ${days.map(d => `<tr><td>${esc(dayShort(d))}</td><td>${att[d] || 0}</td>${meals.map(m => `<td>${dayMeal(d, m.id)}</td>`).join('')}</tr>`).join('')}
       <tr class="tot"><td>Total</td><td></td>${meals.map(m => `<td>${total(m.id)}</td>`).join('')}</tr></table>`);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month">‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 120, textAlign: 'center' }}>{monthName(month)}</span>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= monthOf()} aria-label="Next month">›</button>
        <span style={{ flex: 1 }}/>
        {[['report', 'Meal counts'], ['children', `Free / reduced / paid${unset ? ` (${unset} not set)` : ''}`]].map(([id, label]) => (
          <button key={id} className="chip" onClick={() => setShow(id)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: show === id ? 'var(--accent)' : undefined, color: show === id ? '#fff' : undefined }}>{label}</button>
        ))}
      </div>
      {err && <div className="al al-e">{err}</div>}

      {show === 'children' ? <Categories facilityId={facilityId} kids={kids} cats={cats} onSaved={load}/> : !data ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <>
          {data.untagged > 0 && (
            <div className="al al-w">{data.untagged} meal entr{data.untagged === 1 ? 'y' : 'ies'} this month {data.untagged === 1 ? "doesn't" : "don't"} say which meal, so {data.untagged === 1 ? "it isn't" : "they aren't"} counted. Open them in Daily and pick the meal.</div>
          )}
          {unset > 0 && <div className="al al-w">{unset} child{unset === 1 ? '' : 'ren'} {unset === 1 ? 'has' : 'have'} no free / reduced / paid category yet. <button className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setShow('children')}>Set them</button></div>}

          <div className="card" style={{ padding: '8px 12px', overflowX: 'auto', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: 'var(--text-faint)' }}><th style={th}>Meal</th>{CATS.map(c => <th key={c.id} style={thR}>{c.label}</th>)}<th style={thR}>Total</th></tr></thead>
              <tbody>
                {meals.map(m => (
                  <tr key={m.id}><td style={td}>{m.icon} {m.label}</td>{CATS.map(c => <td key={c.id} style={tdR}>{total(m.id, c.id)}</td>)}<td style={{ ...tdR, fontWeight: 800 }}>{total(m.id)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data.over_limit.length > 0 || data.not_checked_in.length > 0) && (
            <div className="card" style={{ padding: '10px 14px', marginBottom: 10 }}>
              {data.over_limit.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>More meals than the program pays for</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>The program pays for up to 2 meals and 1 snack, or 1 meal and 2 snacks, per child per day. Leave the extras off your claim.</div>
                  {data.over_limit.map((r, i) => <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{dayShort(r.day)} · <strong>{r.name}</strong>: {r.meals.map(mealLabel).join(', ')}</div>)}
                </>
              )}
              {data.not_checked_in.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: data.over_limit.length ? 10 : 0 }}>Meals for a child who wasn't here that day</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Auditors compare meal counts with attendance. A child counts as here if they were checked in at any time that day, overnight stays included. Fix the check-in or the meal entry.</div>
                  {data.not_checked_in.slice(0, 30).map((r, i) => <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{dayShort(r.day)} · <strong>{r.name}</strong>: {mealLabel(r.meal)}</div>)}
                  {data.not_checked_in.length > 30 && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>…and {data.not_checked_in.length - 30} more</div>}
                </>
              )}
            </div>
          )}

          <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
            {days.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '8px 0' }}>No meals or check-ins this month yet.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ color: 'var(--text-faint)' }}><th style={th}>Date</th><th style={thR}>Here</th>{meals.map(m => <th key={m.id} style={thR}>{m.short}</th>)}</tr></thead>
                <tbody>
                  {days.map(d => (
                    <tr key={d}><td style={td}>{dayShort(d)}</td><td style={tdR}>{att[d] || 0}</td>
                      {meals.map(m => { const n = dayMeal(d, m.id); return <td key={m.id} style={{ ...tdR, color: n > (att[d] || 0) ? 'var(--err-text, #d05050)' : undefined }}>{n}</td>; })}</tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="bg" style={{ fontSize: 12 }} onClick={csv} disabled={!days.length}>⬇ Download CSV</button>
            <button className="bg" style={{ fontSize: 12 }} onClick={print} disabled={!days.length}>🖨 Print</button>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Enter these numbers in your state's CACFP claim system.</span>
          </div>
        </>
      )}
    </div>
  );
}
const th  = { padding: '5px 6px', borderBottom: '1px solid var(--border)', fontWeight: 700, textAlign: 'left' };
const thR = { ...th, textAlign: 'right' };
const td  = { padding: '5px 6px', borderBottom: '1px solid var(--border)' };
const tdR = { ...td, textAlign: 'right' };

// Each enrolled child's category from the family's income eligibility form (renewed every year)
function Categories({ facilityId, kids, cats, onSaved }) {
  const [busy, setBusy] = useState({});
  const [err,  setErr]  = useState(null);
  const yearAgo = addDays(localDate(), -365);

  async function save(k, patch) {
    const cur = cats?.[k.child_id];
    const next = { category: cur?.category || '', form_date: cur?.form_date || '', ...patch };
    setBusy(b => ({ ...b, [k.child_id]: true })); setErr(null);
    const { error } = next.category
      ? await supabase.from('daycare_cacfp_children').upsert({ facility_id: facilityId, child_id: k.child_id, category: next.category, form_date: next.form_date || null }, { onConflict: 'facility_id,child_id' })
      : await supabase.from('daycare_cacfp_children').delete().eq('facility_id', facilityId).eq('child_id', k.child_id);
    setBusy(b => ({ ...b, [k.child_id]: false }));
    if (error) { setErr(errText(error)); return; }
    onSaved();
  }

  if (!cats) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;
  return (
    <div>
      {err && <div className="al al-e">{err}</div>}
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>
        From each family's income eligibility form. Only the director and office see this. Forms are good for 12 months.
      </div>
      <div className="card" style={{ padding: '4px 14px' }}>
        {kids.map(k => {
          const c = cats[k.child_id];
          const old = c?.form_date && c.form_date < yearAgo;
          return (
            <div key={k.child_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 140, fontSize: 13 }}>
                <strong>{k.name}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{k.classroom_name || ''}</span>
                {old && <span style={{ display: 'block', fontSize: 11, color: 'var(--warn-text)' }}>Form is over a year old. Get a new one.</span>}
              </span>
              <select className="fi" value={c?.category || ''} disabled={busy[k.child_id]} onChange={e => save(k, { category: e.target.value })}
                aria-label={`Category for ${k.name}`} style={{ width: 'auto', marginBottom: 0, padding: '5px 8px', fontSize: 12 }}>
                <option value="">Not set</option><option value="free">Free</option><option value="reduced">Reduced</option><option value="paid">Paid</option>
              </select>
              <input className="fi" type="date" value={c?.form_date || ''} max={localDate()} disabled={busy[k.child_id] || !c} onChange={e => save(k, { form_date: e.target.value })}
                aria-label={`Form date for ${k.name}`} title="Date on the income eligibility form" style={{ width: 'auto', marginBottom: 0, padding: '5px 8px', fontSize: 12 }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}
