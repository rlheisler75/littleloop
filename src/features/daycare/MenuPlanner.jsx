import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { errText } from './api';
import { addDays } from './enrollment';
import { weekStart, weekText } from './learning';
import {
  COMPONENTS, ALLERGENS, componentOf, allergenLabel, servedMeals, loadMenus, weekDays, dayLabel, isToday,
  cacfpCheck, mealConflicts, printMenu, openDays, weekRange,
} from './kitchen';

// The week's menu: Monday to Friday, by meal. Copy an earlier week (a 4-week cycle is "copy from
// 4 weeks ago"), share it with families, print it for the wall.
export default function MenuPlanner({ facility, facilityId, settings, kids }) {
  const [week,    setWeek]    = useState(weekStart());
  const [menus,   setMenus]   = useState(null);
  const [shared,  setShared]  = useState(null);     // the daycare_menu_weeks row
  const [library, setLibrary] = useState([]);
  const [editing, setEditing] = useState(null);     // { day, meal }
  const [copyFrom, setCopyFrom] = useState(null);   // weeks back, waiting for confirm
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);
  const meals = servedMeals(settings);
  const n = openDays(settings);                      // 7 when open on weekends
  const days = weekDays(week, n);

  const load = useCallback(async () => {
    const [m, { data: w }, { data: lib }] = await Promise.all([
      loadMenus(facilityId, week, addDays(week, n - 1)),
      supabase.from('daycare_menu_weeks').select('*').eq('facility_id', facilityId).eq('week_start', week).maybeSingle(),
      supabase.from('daycare_foods').select('id, name, component, allergens').eq('facility_id', facilityId).order('name'),
    ]);
    setMenus(m); setShared(w || null); setLibrary(lib || []);
  }, [facilityId, week, n]);
  useEffect(() => { setMenus(null); setMsg(null); load(); }, [load]);

  const planned = menus ? Object.values(menus).filter(r => r.foods?.length).length : 0;

  async function share(on) {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('daycare_menu_weeks').upsert({ facility_id: facilityId, week_start: week, shared_at: on ? new Date().toISOString() : null }, { onConflict: 'facility_id,week_start' });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: on ? 'Shared. Families see this week\'s menu on their Home screen.' : 'Families no longer see this week\'s menu.' });
    load();
  }

  async function copy(weeksBack) {
    setCopyFrom(null); setBusy(true); setMsg(null);
    const from = addDays(week, -7 * weeksBack);
    const src = await loadMenus(facilityId, from, addDays(from, n - 1));
    const rows = Object.values(src).filter(r => meals.some(m => m.id === r.meal) && (r.foods?.length || r.note)).map(r => {
      const offset = Math.round((new Date(r.day + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000);
      return { facility_id: facilityId, day: addDays(week, offset), meal: r.meal, foods: r.foods, note: r.note };
    });
    if (!rows.length) { setBusy(false); setMsg({ err: `Nothing was planned the week of ${weekRange(from, n)}.` }); return; }
    const { error } = await supabase.from('daycare_menus').upsert(rows, { onConflict: 'facility_id,day,meal' });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: `Copied ${rows.length} meal${rows.length === 1 ? '' : 's'} from the week of ${weekRange(from, n)}.` });
    load();
  }

  const thisWeek = weekStart();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, -7))} aria-label="Previous week">‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 120, textAlign: 'center' }}>{week === thisWeek ? 'This week' : week === addDays(thisWeek, 7) ? 'Next week' : weekRange(week, n)}</span>
        <button className="bg" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setWeek(w => addDays(w, 7))} aria-label="Next week">›</button>
        <span style={{ flex: 1 }}/>
        <select className="fi" value="" disabled={busy} onChange={e => e.target.value && setCopyFrom(Number(e.target.value))} aria-label="Copy an earlier week"
          style={{ width: 'auto', marginBottom: 0, padding: '5px 8px', fontSize: 12 }}>
          <option value="">Copy from…</option>
          {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w === 1 ? 'Last week' : `${w} weeks ago`} ({weekRange(addDays(week, -7 * w), n)})</option>)}
        </select>
        <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} disabled={!menus || !planned} onClick={() => printMenu(week, menus, meals, facility?.name, n)}>🖨 Print</button>
        {shared?.shared_at
          ? <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy} onClick={() => share(false)} title={`Shared by ${shared.shared_by_name || 'staff'}`}>✓ Shared · Stop sharing</button>
          : <button className="bp" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy || !planned} onClick={() => share(true)}>Share with families</button>}
      </div>
      {msg && <div className={`al ${msg.ok ? 'al-s' : 'al-e'}`}>{msg.ok || msg.err}</div>}

      {!menus ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 8 }}>
          {days.map(d => (
            <div key={d} className="card" style={{ padding: '10px 12px', border: isToday(d) ? '1px solid var(--accent)' : undefined }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{dayLabel(d)}{isToday(d) && <span style={{ color: 'var(--accent)' }}> · today</span>}</div>
              {meals.map(m => {
                const r = menus[`${d}|${m.id}`];
                const foods = r?.foods || [];
                const check = settings.cacfp && foods.length ? cacfpCheck(m.id, foods) : null;
                const flagged = foods.length ? mealConflicts(kids, foods).length : 0;
                return (
                  <button key={m.id} onClick={() => setEditing({ day: d, meal: m })}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', marginBottom: 4, borderRadius: 8, cursor: 'pointer', color: 'var(--text)',
                      border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-faint)' }}>
                      {m.short}
                      {check && !check.ok && <span title={`Food program: missing ${check.missing.join(', ')}`} style={{ color: 'var(--warn-text)' }}> · ⚠ pattern</span>}
                      {flagged > 0 && <span title="Children with an allergy or diet conflict" style={{ color: '#d05050' }}> · {flagged} allerg{flagged === 1 ? 'y' : 'ies'}</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: foods.length ? 'var(--text)' : 'var(--text-faint)' }}>
                      {foods.length ? foods.map(f => f.name).join(', ') : '+ Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
        Families see a week only after you share it. To run a 4-week cycle menu, plan 4 weeks once, then use "Copy from… 4 weeks ago".
      </div>

      {editing && (
        <MealEditor facilityId={facilityId} day={editing.day} meal={editing.meal} row={menus?.[`${editing.day}|${editing.meal.id}`]}
          library={library} kids={kids} cacfp={settings.cacfp} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }}/>
      )}
      <Confirm open={copyFrom != null} title={`Copy the week of ${copyFrom ? weekRange(addDays(week, -7 * copyFrom), n) : ''}?`}
        message="Its meals are copied into this week. Meals you already planned for the same day and meal are replaced."
        onConfirm={() => copy(copyFrom)} onCancel={() => setCopyFrom(null)}/>
    </div>
  );
}

const blankFood = { name: '', component: 'other', allergens: [] };

function MealEditor({ facilityId, day, meal, row, library, kids, cacfp, onClose, onSaved }) {
  const [foods,  setFoods]  = useState(row?.foods || []);
  const [note,   setNote]   = useState(row?.note || '');
  const [draft,  setDraft]  = useState(blankFood);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  function setName(name) {
    const hit = library.find(f => f.name.toLowerCase() === name.trim().toLowerCase());
    setDraft(hit ? { name, component: hit.component, allergens: hit.allergens || [] } : { ...draft, name });
  }
  function addDraft() {
    const name = draft.name.trim();
    if (!name) return;
    if (foods.length >= 15) { setError('A meal can have up to 15 foods.'); return; }
    if (foods.some(f => f.name.toLowerCase() === name.toLowerCase())) { setError(`${name} is already on this meal.`); return; }
    setFoods(fs => [...fs, { name: name.slice(0, 80), component: draft.component, allergens: draft.allergens }]);
    setDraft(blankFood); setError(null);
  }
  const editFood = i => { setDraft(foods[i]); setFoods(fs => fs.filter((_, j) => j !== i)); };
  const toggleAllergen = a => setDraft(d => ({ ...d, allergens: d.allergens.includes(a) ? d.allergens.filter(x => x !== a) : [...d.allergens, a] }));

  async function save(e) {
    e?.preventDefault();
    const all = draft.name.trim() ? [...foods, { ...draft, name: draft.name.trim() }] : foods;   // a typed food not yet added counts
    setSaving(true); setError(null);
    let error;
    if (!all.length && !note.trim()) {
      ({ error } = row ? await supabase.from('daycare_menus').delete().eq('id', row.id) : { error: null });
    } else {
      ({ error } = await supabase.from('daycare_menus').upsert({ facility_id: facilityId, day, meal: meal.id, foods: all, note: note.trim() || null }, { onConflict: 'facility_id,day,meal' }));
      // Remember each food's group and allergens for next time
      if (!error && all.length) {
        const { error: libErr } = await supabase.from('daycare_foods').upsert(
          all.map(f => ({ facility_id: facilityId, name: f.name, component: f.component, allergens: f.allergens || [] })), { onConflict: 'facility_id,name_key' });
        if (libErr) console.error('food list:', libErr);
      }
    }
    setSaving(false);
    if (error) { setError(errText(error)); return; }
    onSaved();
  }

  const preview = draft.name.trim() ? [...foods, draft] : foods;
  const check = cacfp && preview.length ? cacfpCheck(meal.id, preview) : null;
  const flagged = mealConflicts(kids, preview);

  return (
    <Modal open onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>{meal.icon} {meal.label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>{dayLabel(day)}</div>
      {error && <div className="al al-e">{error}</div>}

      {foods.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {foods.map((f, i) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
              <span title={componentOf(f.component).label}>{componentOf(f.component).icon}</span>
              <span style={{ flex: 1, fontSize: 13 }}>
                {f.name}
                {f.allergens?.length > 0 && <span style={{ fontSize: 11, color: 'var(--warn-text)' }}> · contains {f.allergens.map(allergenLabel).join(', ').toLowerCase()}</span>}
              </span>
              <button type="button" className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => editFood(i)}>Edit</button>
              <button type="button" className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setFoods(fs => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); addDraft(); }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border)', marginBottom: 12 }}>
          <label className="fl">Add a food</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="fi" list="ll-food-list" value={draft.name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="e.g. Whole wheat pasta"
              style={{ marginBottom: 0, flex: 1 }} aria-label="Food"/>
            <select className="fi" value={draft.component} onChange={e => setDraft(d => ({ ...d, component: e.target.value }))} aria-label="Food group"
              style={{ marginBottom: 0, width: 'auto' }}>
              {COMPONENTS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <datalist id="ll-food-list">{library.map(f => <option key={f.id} value={f.name}/>)}</datalist>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '8px 0 4px' }}>Contains</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ALLERGENS.map(a => (
              <button key={a.id} type="button" className="chip" aria-pressed={draft.allergens.includes(a.id)} onClick={() => toggleAllergen(a.id)}
                style={{ cursor: 'pointer', fontSize: 11, padding: '4px 9px', background: draft.allergens.includes(a.id) ? 'var(--warn-text, #b7791f)' : undefined, color: draft.allergens.includes(a.id) ? '#fff' : undefined }}>
                {a.label}
              </button>
            ))}
          </div>
          <button type="submit" className="bg" style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }} disabled={!draft.name.trim()}>+ Add to {meal.short.toLowerCase()}</button>
        </div>
      </form>

      {check && (
        <div className={`al ${check.ok ? 'al-s' : 'al-w'}`} style={{ fontSize: 12 }}>
          {check.ok ? '✓ Meets the food program meal pattern.' : `Food program meal pattern: add ${check.missing.join(', ')}.`}
        </div>
      )}
      {flagged.length > 0 && (
        <div className="al al-w" style={{ fontSize: 12 }}>
          <strong>Can't have this:</strong>
          {flagged.map(({ kid, hits }) => (
            <div key={kid.child_id}>{kid.allergy_severe ? '🚨' : '⚠️'} {kid.name} ({kid.classroom_name || 'no room'}): {hits.map(h => `${h.food} (${h.why.join(', ')})`).join('; ')}</div>
          ))}
          <div style={{ marginTop: 4, color: 'var(--text-faint)' }}>Set what each child gets instead on the Kitchen's Today screen for that day.</div>
        </div>
      )}

      <label className="fl">Note <span style={{ fontWeight: 400 }}>(optional, families see it)</span></label>
      <input className="fi" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="e.g. Pizza day!"/>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="bp full" onClick={save} disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
        <button className="bg" onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </Modal>
  );
}
