import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { CARE_KINDS, careKind, timeInput, stamp } from './care';
import { errText } from './api';
import { loadKitchenSettings, loadMenus, loadSubs, servedMeals, guessMeal, conflictsFor } from './kitchen';

// Log a meal, nap, diaper, etc. for one child or several at once, or edit one entry.
//   kids:    children to log for (each { id, name, preferred_name, avatar, allergies, allergy_severe, diet_types, ... })
//   editing: an existing care_logs row (kids is then that one child)
export default function CareLogModal({ open, facilityId, day, kids = [], editing = null, startKind = null, onClose, onSaved }) {
  const [kind,    setKind]    = useState(null);
  const [picked,  setPicked]  = useState({});      // child id -> included
  const [time,    setTime]    = useState(timeInput());
  const [endTime, setEndTime] = useState('');
  const [amount,  setAmount]  = useState('');
  const [detail,  setDetail]  = useState('');
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [meal,    setMeal]    = useState('');      // which meal (for the kitchen's meal counts)
  const [kitchen, setKitchen] = useState(null);    // { served, menus, subs } for this day
  const autoDetail = useRef('');                   // the "what was served" text we filled in from the menu
  const kidKey = kids.map(k => k.id).join(',');

  useEffect(() => {
    if (!open) return;
    setError(null); setSaving(false);
    setPicked(Object.fromEntries(kids.map(k => [k.id, true])));
    autoDetail.current = '';
    if (editing) {
      setKind(editing.kind);
      setTime(timeInput(new Date(editing.started_at)));
      setEndTime(editing.ended_at ? timeInput(new Date(editing.ended_at)) : '');
      setAmount(editing.amount || ''); setDetail(editing.detail || ''); setNote(editing.note || '');
      setMeal(editing.meal || '');
    } else {
      setKind(startKind); setTime(timeInput()); setEndTime(''); setAmount(''); setDetail(''); setNote(''); setMeal('');
    }
  }, [open, editing?.id, kidKey, startKind]);

  // The day's menu, for meals: which meals the daycare serves, what's on each, and substitutes
  const wantsKitchen = open && kind === 'meal';
  useEffect(() => {
    if (!wantsKitchen) return;
    let live = true;
    Promise.all([loadKitchenSettings(facilityId), loadMenus(facilityId, day, day), loadSubs(facilityId, day, day)]).then(([s, menus, subs]) => {
      if (!live) return;
      const meals = servedMeals(s), served = meals.map(m => m.id);
      setKitchen({ meals, served, menus, subs });
      if (!editing) setMeal(m => m || guessMeal(served) || '');
    });
    return () => { live = false; };
  }, [wantsKitchen, facilityId, day]);

  // Fill in "what was served" from the menu, unless the teacher typed something of their own
  const menuFoods = kitchen && meal ? (kitchen.menus[`${day}|${meal}`]?.foods || []) : [];
  // What this child actually got: the menu without what they can't have, plus their substitute.
  // (So a family never reads "peanut butter sandwich" in the report of a child with a peanut allergy.)
  const servedFor = c => {
    const keep = menuFoods.filter(food => !conflictsFor(c, [food]).length).map(food => food.name);
    const sub = keep.length < menuFoods.length ? kitchen?.subs[`${day}|${meal}|${c.id}`]?.substitute : null;
    return (sub ? [sub, ...keep] : keep).join(', ').slice(0, 200);
  };
  useEffect(() => {
    if (kind !== 'meal' || editing) return;
    const text = kids.length === 1 ? servedFor(kids[0]) : menuFoods.map(f => f.name).join(', ');
    setDetail(d => (d === '' || d === autoDetail.current) ? text.slice(0, 200) : d);
    autoDetail.current = text.slice(0, 200);
  }, [meal, kitchen, kind]);

  if (!open) return null;
  const k = kind ? careKind(kind) : null;
  const chosen = kids.filter(c => picked[c.id]);
  const name = c => c.preferred_name || c.name;
  const flagged = chosen.filter(c => (c.allergies || []).filter(Boolean).length || (c.diet_types || []).length || c.dietary_restrictions);
  const conflicts = k?.id === 'meal' && menuFoods.length
    ? chosen.map(c => ({ c, hits: conflictsFor(c, menuFoods), sub: kitchen.subs[`${day}|${meal}|${c.id}`] })).filter(x => x.hits.length)
    : null;

  async function save(e) {
    e.preventDefault();
    if (!k) { setError('Choose what you\'re logging.'); return; }
    if (!chosen.length) { setError('Choose at least one child.'); return; }
    if (k.detailRequired && !detail.trim()) { setError(`Fill in ${k.detailLabel.toLowerCase()}.`); return; }
    if (k.noteRequired && !note.trim()) { setError('Write the note.'); return; }
    if (k.id === 'bottle' && amount && !/^\d{1,2}(\.\d{1,2})?$/.test(amount.trim())) { setError('Ounces should be a number, like 4 or 5.5.'); return; }
    const started = stamp(day, time);
    const ended = k.id === 'nap' && endTime ? stamp(day, endTime) : null;
    if (ended && ended < started) { setError('Wake-up time is before the nap started.'); return; }
    const fields = {
      started_at: started, ended_at: ended,
      amount: amount.trim() || null, detail: detail.trim() || null, note: note.trim() || null,
      ...(k.id === 'meal' ? { meal: meal || null } : {}),
    };
    setSaving(true); setError(null);
    const { error: err } = editing
      ? await supabase.from('care_logs').update(fields).eq('id', editing.id)
      : await supabase.from('care_logs').insert(chosen.map(c => ({
          ...fields,
          // Untouched menu text: each child's own version (substitute instead of what they can't have)
          ...(k.id === 'meal' && autoDetail.current && fields.detail === autoDetail.current.trim() ? { detail: servedFor(c) || null } : {}),
          facility_id: facilityId, child_id: c.id, day, kind: k.id,
        })));
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved?.();
    onClose();
  }

  async function remove() {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('care_logs').delete().eq('id', editing.id);
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved?.();
    onClose();
  }

  const chipBtn = (value, current, set) => (
    <button key={value} type="button" onClick={() => set(current === value ? '' : value)} className="chip"
      style={{ cursor: 'pointer', fontSize: 12, padding: '6px 12px', fontWeight: 700,
        background: current === value ? 'var(--accent)' : undefined, color: current === value ? '#fff' : undefined,
        borderColor: current === value ? 'var(--accent)' : undefined }}>
      {value}
    </button>
  );

  return (
    <Modal open={open} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>
        {editing ? `Edit ${careKind(editing.kind).label.toLowerCase()}` : kids.length === 1 ? `Log for ${name(kids[0])}` : `Log for ${chosen.length} of ${kids.length} children`}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>
        {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} · parents see this in their daily report
      </div>
      {error && <div className="al al-e">{error}</div>}

      <form onSubmit={save}>
        {kids.length > 1 && !editing && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {kids.map(c => (
              <button key={c.id} type="button" onClick={() => setPicked(p => ({ ...p, [c.id]: !p[c.id] }))} className="chip" aria-pressed={!!picked[c.id]}
                style={{ cursor: 'pointer', fontSize: 12, opacity: picked[c.id] ? 1 : .45, textDecoration: picked[c.id] ? 'none' : 'line-through' }}>
                {c.avatar || '🌟'} {name(c)}
              </button>
            ))}
          </div>
        )}

        {!editing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6, marginBottom: 14 }}>
            {CARE_KINDS.map(o => (
              <button key={o.id} type="button" onClick={() => { setKind(o.id); setAmount(''); setDetail(''); }}
                style={{ padding: '9px 4px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text)',
                  border: `1px solid ${kind === o.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: kind === o.id ? 'color-mix(in srgb,var(--accent) 16%,transparent)' : 'var(--input-bg)' }}>
                <div style={{ fontSize: 20 }}>{o.icon}</div>{o.label}
              </button>
            ))}
          </div>
        )}

        {k && (
          <>
            {k.id === 'meal' && kitchen && (
              <>
                <label className="fl">Which meal</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {kitchen.meals.map(m => (
                    <button key={m.id} type="button" onClick={() => setMeal(meal === m.id ? '' : m.id)} className="chip" aria-pressed={meal === m.id}
                      style={{ cursor: 'pointer', fontSize: 12, padding: '6px 12px', fontWeight: 700,
                        background: meal === m.id ? 'var(--accent)' : undefined, color: meal === m.id ? '#fff' : undefined, borderColor: meal === m.id ? 'var(--accent)' : undefined }}>
                      {m.icon} {m.short}
                    </button>
                  ))}
                </div>
              </>
            )}
            {conflicts && conflicts.length > 0 && (
              <div className="al al-e" style={{ fontSize: 12 }}>
                {conflicts.map(({ c, hits, sub }) => (
                  <div key={c.id} style={{ marginBottom: 2 }}>
                    {c.allergy_severe ? '🚨' : '⚠️'} <strong>{name(c)}</strong> can't have {hits.map(h => `${h.food} (${h.why.join(', ')})`).join('; ')}.
                    {sub ? <> Gets instead: <strong>{sub.substitute}</strong></> : ' No substitute set: check with the kitchen.'}
                  </div>
                ))}
              </div>
            )}
            {(k.id === 'meal' || k.id === 'bottle') && flagged.length > 0 && !(conflicts && conflicts.length) && (
              <div className="al al-w" style={{ fontSize: 12 }}>
                {flagged.map(c => {
                  const allergies = (c.allergies || []).filter(Boolean);
                  const diet = [...(c.diet_types || []), c.dietary_restrictions].filter(Boolean);
                  return (
                    <div key={c.id}>
                      <strong>{name(c)}:</strong>
                      {allergies.length > 0 && <> {c.allergy_severe ? '🚨 SEVERE ' : '⚠️ '}{allergies.join(', ')}</>}
                      {diet.length > 0 && <> · 🍽 {diet.join('; ')}</>}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="fl">{k.id === 'nap' ? 'Fell asleep' : 'Time'}</label>
                <input className="fi" type="time" value={time} onChange={e => setTime(e.target.value)} required/>
              </div>
              {k.id === 'nap' && (
                <div style={{ flex: 1 }}>
                  <label className="fl">Woke up <span style={{ fontWeight: 400 }}>(leave empty if asleep)</span></label>
                  <input className="fi" type="time" value={endTime} onChange={e => setEndTime(e.target.value)}/>
                </div>
              )}
              {k.id === 'bottle' && (
                <div style={{ flex: 1 }}>
                  <label className="fl">{k.amountLabel}</label>
                  <input className="fi" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 4" maxLength={5}/>
                </div>
              )}
            </div>

            {k.amountChoices && (
              <>
                <label className="fl">How much they ate</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{k.amountChoices.map(v => chipBtn(v, amount, setAmount))}</div>
              </>
            )}
            {k.choices && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{k.choices.map(v => chipBtn(v, detail, setDetail))}</div>
            )}
            {k.detailLabel && (
              <>
                <label className="fl">{k.detailLabel}{!k.detailRequired && <span style={{ fontWeight: 400 }}> (optional)</span>}</label>
                <input className="fi" value={detail} onChange={e => setDetail(e.target.value)} placeholder={k.detailPlaceholder} maxLength={200}/>
              </>
            )}
            <label className="fl">{k.noteRequired ? 'Note' : <>Note <span style={{ fontWeight: 400 }}>(optional)</span></>}</label>
            <textarea className="fi" rows={k.noteRequired ? 4 : 2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
              placeholder={k.id === 'medicine' ? 'Given with lunch, no reaction' : k.id === 'diaper' ? 'e.g. a little redness, cream applied' : 'Anything the family should know'}/>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="bp full" disabled={saving || !k}>{saving ? <Spinner/> : editing ? 'Save' : chosen.length > 1 ? `Save for ${chosen.length} children` : 'Save'}</button>
          {editing && <button type="button" className="bd" style={{ padding: '11px 16px' }} disabled={saving} onClick={remove}>Delete</button>}
          <button type="button" className="bg" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
