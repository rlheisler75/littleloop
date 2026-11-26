import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import { errText } from './api';
import { localDate, addDays } from './enrollment';
import {
  MEALS, servedMeals, loadKitchenSettings, loadKitchenKids, loadMenus, loadSubs, mealConflicts, cacfpCheck,
  kidName, restrictionsOf, dayLabel,
} from './kitchen';
import MenuPlanner from './MenuPlanner';
import FoodOrders from './FoodOrders';
import TempLog from './TempLog';
import FoodProgram from './FoodProgram';

// Kitchen (phase 5A): today's meals with the allergy check and substitutes, meal counts, the
// weekly menu, food orders, fridge/freezer temperatures, and (director/office, if the daycare
// is in the USDA food program) the monthly meal count report.
export default function KitchenTab({ facility, facilityId, userId, manager }) {
  const [settings, setSettings] = useState(null);
  const [kids,     setKids]     = useState(null);
  const [rooms,    setRooms]    = useState([]);
  const [view,     setView]     = useState('today');

  const load = useCallback(async () => {
    const [s, k, { data: rm }] = await Promise.all([
      loadKitchenSettings(facilityId),
      loadKitchenKids(facilityId),
      supabase.from('classrooms').select('id, name, color').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
    ]);
    setSettings(s); setKids(k); setRooms(rm || []);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  const views = [
    { id: 'today', label: 'Today' }, { id: 'menus', label: 'Menus' }, { id: 'orders', label: 'Orders' }, { id: 'temps', label: 'Temperatures' },
    ...(manager && settings?.cacfp ? [{ id: 'program', label: 'Food program' }] : []),
    ...(manager ? [{ id: 'settings', label: 'Settings' }] : []),
  ];
  const active = views.some(v => v.id === view) ? view : 'today';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Kitchen</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {views.map(v => (
            <button key={v.id} className="chip" onClick={() => setView(v.id)}
              style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: active === v.id ? 'var(--accent)' : undefined, color: active === v.id ? '#fff' : undefined }}>{v.label}</button>
          ))}
        </div>
      </div>
      {!settings || !kids ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <>
          {active === 'today'    && <KitchenToday facilityId={facilityId} settings={settings} kids={kids} rooms={rooms} onGoTo={setView}/>}
          {active === 'menus'    && <MenuPlanner facility={facility} facilityId={facilityId} settings={settings} kids={kids}/>}
          {active === 'orders'   && <FoodOrders facilityId={facilityId} manager={manager}/>}
          {active === 'temps'    && <TempLog facility={facility} facilityId={facilityId} userId={userId} manager={manager}/>}
          {active === 'program'  && <FoodProgram facility={facility} facilityId={facilityId} settings={settings} kids={kids}/>}
          {active === 'settings' && <KitchenSettings facilityId={facilityId} settings={settings} onSaved={load}/>}
        </>
      )}
    </div>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────────
function KitchenToday({ facilityId, settings, kids, rooms, onGoTo }) {
  const [day,    setDay]    = useState(localDate());
  const [menus,  setMenus]  = useState(null);
  const [subs,   setSubs]   = useState({});
  const [counts, setCounts] = useState(null);
  const [temps,  setTemps]  = useState(null);   // { units, loggedToday: Set(unit_id) }
  const meals = servedMeals(settings);
  const today = localDate();

  const load = useCallback(async () => {
    const start = new Date(day + 'T00:00:00');
    const [m, s, { data: c }, { data: units }, { data: logs }] = await Promise.all([
      loadMenus(facilityId, day, day),
      loadSubs(facilityId, day, day),
      supabase.rpc('daycare_meal_counts', { p_facility: facilityId, p_day: day }),
      supabase.from('daycare_temp_units').select('id, name').eq('facility_id', facilityId).eq('active', true),
      supabase.from('daycare_temp_logs').select('unit_id').eq('facility_id', facilityId).gte('logged_at', start.toISOString()).lt('logged_at', new Date(start.getTime() + 86400000).toISOString()),
    ]);
    setMenus(m); setSubs(s); setCounts(c || { checked_in: [], served: [] });
    setTemps({ units: units || [], logged: new Set((logs || []).map(l => l.unit_id)) });
  }, [facilityId, day]);
  useEffect(() => { setMenus(null); load(); }, [load]);

  const roomName = id => rooms.find(r => r.id === id)?.name || 'No room';
  const handCheck = kids.map(k => ({ k, notes: restrictionsOf(k).handCheck })).filter(x => x.notes.length);
  const checkedIn = (counts?.checked_in || []).reduce((s, r) => s + r.n, 0);
  const servedOf = meal => (counts?.served || []).filter(r => r.meal === meal).reduce((s, r) => s + r.n, 0);
  const roomIds = [...new Set([...rooms.map(r => r.id), ...(counts?.checked_in || []).map(r => r.classroom_id), ...(counts?.served || []).map(r => r.classroom_id)])];
  const tempsDue = temps ? temps.units.filter(u => !temps.logged.has(u.id)) : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, -1))} aria-label="Previous day">‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 130, textAlign: 'center' }}>{day === today ? `Today, ${dayLabel(day)}` : dayLabel(day)}</span>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setDay(d => addDays(d, 1))} aria-label="Next day">›</button>
        {day !== today && <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setDay(today)}>Today</button>}
      </div>

      {day === today && temps && temps.units.length > 0 && tempsDue.length > 0 && (
        <div className="al al-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>🌡️ Not checked yet today: {tempsDue.map(u => u.name).join(', ')}</span>
          <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onGoTo('temps')}>Log temperatures</button>
        </div>
      )}

      {!menus ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <>
          {meals.map(m => (
            <MealCard key={m.id} facilityId={facilityId} day={day} meal={m} row={menus[`${day}|${m.id}`]} kids={kids}
              subs={subs} roomName={roomName} cacfp={settings.cacfp} served={servedOf(m.id)} checkedIn={checkedIn}
              onPlan={() => onGoTo('menus')} onSaved={load}/>
          ))}

          {handCheck.length > 0 && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Also check by hand</div>
              {handCheck.map(({ k, notes }) => (
                <div key={k.child_id} style={{ fontSize: 12, padding: '3px 0', color: 'var(--text-dim)' }}>
                  <strong style={{ color: 'var(--text)' }}>{kidName(k)}</strong> <span style={{ color: 'var(--text-faint)' }}>({k.classroom_name || 'no room'})</span>: {notes.join(' · ')}
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: '10px 12px', overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Meal counts</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-faint)', textAlign: 'left' }}>
                  <th style={th}>Room</th><th style={thR}>Here today</th>
                  {meals.map(m => <th key={m.id} style={thR}>{m.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {roomIds.map(id => (
                  <tr key={id || 'none'}>
                    <td style={td}>{roomName(id)}</td>
                    <td style={tdR}>{(counts.checked_in.find(r => r.classroom_id === id)?.n) || 0}</td>
                    {meals.map(m => <td key={m.id} style={tdR}>{(counts.served.find(r => r.classroom_id === id && r.meal === m.id)?.n) || 0}</td>)}
                  </tr>
                ))}
                <tr style={{ fontWeight: 800 }}>
                  <td style={td}>Total</td><td style={tdR}>{checkedIn}</td>
                  {meals.map(m => <td key={m.id} style={tdR}>{servedOf(m.id)}</td>)}
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
              Here today counts every child checked in at any time today, including children who stayed overnight. Meals come from what teachers log on the Today screen (tap a child, then Meal, then pick which meal).
            </div>
          </div>
        </>
      )}
    </div>
  );
}
const th  = { padding: '5px 6px', borderBottom: '1px solid var(--border)', fontWeight: 700 };
const thR = { ...th, textAlign: 'right' };
const td  = { padding: '5px 6px', borderBottom: '1px solid var(--border)' };
const tdR = { ...td, textAlign: 'right' };

function MealCard({ facilityId, day, meal, row, kids, subs, roomName, cacfp, served, checkedIn, onPlan, onSaved }) {
  const foods = row?.foods || [];
  const check = cacfp && foods.length ? cacfpCheck(meal.id, foods) : null;
  const flagged = mealConflicts(kids, foods);
  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>{meal.icon}</span>
        <strong style={{ fontSize: 14, flex: 1 }}>{meal.label}</strong>
        {checkedIn > 0 || served > 0 ? <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Served {served}{checkedIn ? ` of ${checkedIn} here today` : ''}</span> : null}
      </div>
      {foods.length ? (
        <div style={{ fontSize: 13, marginTop: 4 }}>{foods.map(f => f.name).join(', ')}{row.note && <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}> · {row.note}</span>}</div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Nothing planned. <button className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={onPlan}>Plan the menu</button></div>
      )}
      {check && (
        <div style={{ fontSize: 11, marginTop: 4, color: check.ok ? 'var(--ok-text, #2e9e6a)' : 'var(--warn-text)' }}>
          {check.ok ? '✓ Meets the food program meal pattern' : `⚠ Food program: missing ${check.missing.join(', ')}`}
        </div>
      )}
      {flagged.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {flagged.map(({ kid, hits }) => (
            <SubstituteRow key={kid.child_id} facilityId={facilityId} day={day} meal={meal.id} kid={kid} hits={hits}
              room={roomName(kid.classroom_id)} sub={subs[`${day}|${meal.id}|${kid.child_id}`]} onSaved={onSaved}/>
          ))}
        </div>
      )}
    </div>
  );
}

// One child who can't have something at this meal, and what they get instead
function SubstituteRow({ facilityId, day, meal, kid, hits, room, sub, onSaved }) {
  const [text, setText] = useState(sub?.substitute || '');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState(null);
  useEffect(() => { setText(sub?.substitute || ''); }, [sub?.substitute]);
  const dirty = text.trim() !== (sub?.substitute || '');

  async function save() {
    setBusy(true); setErr(null);
    const { error } = text.trim()
      ? await supabase.from('daycare_meal_subs').upsert({ facility_id: facilityId, day, meal, child_id: kid.child_id, substitute: text.trim() }, { onConflict: 'facility_id,day,meal,child_id' })
      : await supabase.from('daycare_meal_subs').delete().eq('facility_id', facilityId).eq('day', day).eq('meal', meal).eq('child_id', kid.child_id);
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    onSaved?.();
  }

  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${kid.allergy_severe ? 'rgba(220,80,80,.5)' : 'rgba(224,160,60,.45)'}`,
      background: kid.allergy_severe ? 'rgba(220,80,80,.08)' : 'rgba(224,160,60,.08)' }}>
      <div style={{ fontSize: 12 }}>
        {kid.allergy_severe ? '🚨 ' : '⚠️ '}<strong>{kid.name}</strong> <span style={{ color: 'var(--text-faint)' }}>({room})</span>
        {kid.allergy_severe && <strong style={{ color: '#d05050' }}> SEVERE</strong>}
        : {hits.map(h => `${h.food} (${h.why.join(', ')})`).join('; ')}
      </div>
      {kid.allergy_severe && kid.allergy_reaction && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Reaction: {kid.allergy_reaction}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input className="fi" value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder="Gets instead, e.g. sunflower butter sandwich"
          aria-label={`Substitute for ${kid.name}`} style={{ marginBottom: 0, padding: '6px 10px', fontSize: 12 }}/>
        <button className={dirty ? 'bp' : 'bg'} style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }} disabled={busy || !dirty} onClick={save}>
          {busy ? <Spinner size={10}/> : sub && !dirty ? '✓ Saved' : 'Save'}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: 'var(--err-text, #d05050)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// ── Settings (director/office) ──────────────────────────────────────────────────
function KitchenSettings({ facilityId, settings, onSaved }) {
  const [meals, setMeals] = useState(settings.meals || []);
  const [cacfp, setCacfp] = useState(!!settings.cacfp);
  const [weekends, setWeekends] = useState(!!settings.weekends);
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState(null);
  const toggle = id => setMeals(ms => ms.includes(id) ? ms.filter(x => x !== id) : MEALS.map(m => m.id).filter(x => x === id || ms.includes(x)));

  async function save() {
    if (!meals.length) { setMsg({ err: 'Pick at least one meal you serve.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('daycare_kitchen_settings').upsert({ facility_id: facilityId, meals, cacfp, weekends }, { onConflict: 'facility_id' });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: 'Saved.' });
    onSaved?.();
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      {msg && <div className={`al ${msg.ok ? 'al-s' : 'al-e'}`}>{msg.ok || msg.err}</div>}
      <label className="fl">Meals you serve</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {MEALS.map(m => (
          <button key={m.id} type="button" className="chip" aria-pressed={meals.includes(m.id)} onClick={() => toggle(m.id)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: meals.includes(m.id) ? 'var(--accent)' : undefined, color: meals.includes(m.id) ? '#fff' : undefined }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '-8px 0 14px' }}>Open evenings or around the clock? Add Supper and Evening snack.</div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={weekends} onChange={e => setWeekends(e.target.checked)} style={{ marginTop: 3 }}/>
        <span><strong>We're open on weekends</strong>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Menus run Monday through Sunday instead of Monday through Friday.</span>
        </span>
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={cacfp} onChange={e => setCacfp(e.target.checked)} style={{ marginTop: 3 }}/>
        <span>
          <strong>We're in the USDA food program (CACFP)</strong>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
            Menus are checked against the program's meal pattern, and the director and office get a monthly meal count report
            split into free, reduced and paid. You still file the claim with your state; this gives you the numbers.
          </span>
        </span>
      </label>
      <button className="bp" onClick={save} disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
    </div>
  );
}
