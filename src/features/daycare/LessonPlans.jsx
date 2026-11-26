import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { AREAS, areaOf, DAYS, weekStart, weekText, dayDate, newId, printLessonPlan } from './learning';
import { addDays } from './enrollment';
import { errText } from './api';

// A week's plan, read-only (staff and parents).
export function LessonPlanWeek({ plan }) {
  const acts = n => (plan.activities || []).filter(a => a.day === n);
  return (
    <div>
      {plan.theme && <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>🌟 {plan.theme}</div>}
      {plan.goals && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 10 }}>
          <strong style={{ color: 'var(--text)' }}>This week's goals: </strong>{plan.goals}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 8 }}>
        {DAYS.map(d => (
          <div key={d.n} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '8px 10px', background: 'var(--input-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{d.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{dayDate(plan.week_start, d.n)}</span>
            </div>
            {acts(d.n).length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>—</div>}
            {acts(d.n).map(a => {
              const ar = areaOf(a.area);
              return (
                <div key={a.id} style={{ padding: '5px 0', borderTop: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{ar.icon} {ar.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{a.description}</div>}
                  {a.materials && <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>Materials: {a.materials}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const blankDraft = () => ({ theme: '', goals: '', activities: [] });
const toDraft = p => ({ theme: p?.theme || '', goals: p?.goals || '', activities: (p?.activities || []).map(a => ({ ...a })) });

// Staff: one classroom's plan for one week. The director/office and the room's own teachers
// write it; families of the room's children see it once it's shared.
export default function LessonPlans({ facility, facilityId, rooms, myRoomId, manager }) {
  const [roomId,  setRoomId]  = useState(() => (rooms.find(r => r.id === myRoomId) || rooms[0])?.id || null);
  const [week,    setWeek]    = useState(() => weekStart());
  const [plan,    setPlan]    = useState(undefined);   // undefined = loading, null = none
  const [draft,   setDraft]   = useState(null);        // editing when set
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const room = rooms.find(r => r.id === roomId) || null;
  const canEdit = !!room && (manager || myRoomId === room.id);

  const load = useCallback(async () => {
    if (!roomId) { setPlan(null); return; }
    const { data, error } = await supabase.from('lesson_plans').select('*').eq('classroom_id', roomId).eq('week_start', week).maybeSingle();
    if (error) console.error('load lesson plan:', error);
    setPlan(data || null);
  }, [roomId, week]);

  useEffect(() => { setPlan(undefined); setDraft(null); setMsg(null); load(); }, [load]);

  if (!rooms.length) return (
    <div className="es"><div className="ic">🗓️</div><h3>No classrooms yet</h3><p>Lesson plans are written for each classroom. {manager ? 'Add classrooms under Rooms first.' : 'Your director hasn\'t added classrooms yet.'}</p></div>
  );

  async function copyLastWeek() {
    setBusy(true); setMsg(null);
    const { data } = await supabase.from('lesson_plans').select('theme, goals, activities, week_start')
      .eq('classroom_id', roomId).lt('week_start', week).order('week_start', { ascending: false }).limit(1).maybeSingle();
    setBusy(false);
    if (!data) { setMsg({ warn: 'There\'s no earlier plan for this room to copy. Starting a blank one.' }); setDraft(blankDraft()); return; }
    setDraft({ theme: data.theme || '', goals: data.goals || '', activities: (data.activities || []).map(a => ({ ...a, id: newId() })) });
    setMsg({ ok: `Copied the week of ${weekText(data.week_start)}. Change what you need, then save.` });
  }

  async function save(status = null) {
    const activities = draft.activities.filter(a => a.title.trim()).map(a => ({
      id: a.id, day: a.day, area: a.area, title: a.title.trim().slice(0, 150),
      description: (a.description || '').trim().slice(0, 1000) || null, materials: (a.materials || '').trim().slice(0, 300) || null,
    }));
    const row = { theme: draft.theme.trim() || null, goals: draft.goals.trim() || null, activities };
    if (status) row.status = status;
    setBusy(true); setMsg(null);
    let res;
    if (plan) {
      // Only if nobody else saved it since it was opened
      res = await supabase.from('lesson_plans').update(row).eq('id', plan.id).eq('updated_at', plan.updated_at).select().maybeSingle();
      if (!res.error && !res.data) {
        setBusy(false);
        setMsg({ err: 'Someone else changed this plan while you were editing. Copy anything you need, then reload to see their version.' });
        return;
      }
    } else {
      res = await supabase.from('lesson_plans').insert({ ...row, facility_id: facilityId, classroom_id: roomId, week_start: week }).select().single();
    }
    setBusy(false);
    if (res.error) { setMsg({ err: errText(res.error) }); return; }
    setPlan(res.data); setDraft(null);
    setMsg({ ok: res.data.status === 'published' ? 'Saved and shared with families.' : 'Saved as a draft. Families don\'t see it until you share it.' });
  }

  async function setShared(shared) {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.from('lesson_plans').update({ status: shared ? 'published' : 'draft' }).eq('id', plan.id).select().single();
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setPlan(data);
    setMsg({ ok: shared ? `Shared. Families in ${room.name} can see this week's plan.` : 'Families no longer see this plan.' });
  }

  async function remove() {
    setConfirmDelete(false); setBusy(true);
    const { error } = await supabase.from('lesson_plans').delete().eq('id', plan.id);
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setPlan(null); setDraft(null); setMsg({ ok: 'Plan deleted.' });
  }

  const thisWeek = weekStart();
  const editing = !!draft;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {rooms.length > 1 ? (
          <select className="fi" value={roomId || ''} onChange={e => setRoomId(e.target.value)} disabled={editing} aria-label="Classroom"
            style={{ width: 'auto', minWidth: 150, marginBottom: 0, padding: '7px 10px' }}>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.id === myRoomId ? ' (my room)' : ''}</option>)}
          </select>
        ) : <span style={{ fontSize: 14, fontWeight: 800 }}>{room?.name}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button className="bg" style={{ padding: '5px 11px' }} onClick={() => setWeek(w => addDays(w, -7))} disabled={editing} aria-label="Previous week">‹</button>
          <button className="bg" style={{ padding: '5px 10px', fontSize: 12, minWidth: 128 }} onClick={() => setWeek(thisWeek)} disabled={editing || week === thisWeek}>
            {week === thisWeek ? 'This week' : `Week of ${weekText(week)}`}
          </button>
          <button className="bg" style={{ padding: '5px 11px' }} onClick={() => setWeek(w => addDays(w, 7))} disabled={editing} aria-label="Next week">›</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>{weekText(week)}</div>

      {msg && <div className={`al ${msg.err ? 'al-e' : msg.warn ? 'al-w' : 'al-s'}`}>{msg.err || msg.warn || msg.ok}</div>}

      {plan === undefined ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
      : editing ? (
        <PlanEditor draft={draft} setDraft={setDraft} week={week} busy={busy} published={plan?.status === 'published'}
          onSave={() => save()} onSaveShare={() => save('published')} onCancel={() => { setDraft(null); setMsg(null); }}
          onDelete={plan ? () => setConfirmDelete(true) : null}/>
      ) : !plan ? (
        <div className="es"><div className="ic">🗓️</div><h3>No plan for this week yet</h3>
          <p>{canEdit ? 'Plan the week\'s activities, then share it with families so they can talk about it at home.'
            : `${room?.name}'s teachers haven't written this week's plan yet.`}</p>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="bp" onClick={() => { setDraft(blankDraft()); setMsg(null); }} disabled={busy}>Start this week's plan</button>
              <button className="bg" onClick={copyLastWeek} disabled={busy}>{busy ? <Spinner/> : 'Copy the last plan'}</button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
              background: plan.status === 'published' ? 'rgba(58,158,122,.14)' : 'rgba(224,160,60,.15)',
              color: plan.status === 'published' ? 'var(--ok-text)' : 'var(--warn-text)' }}>
              {plan.status === 'published' ? '✓ Shared with families' : 'Draft · families can\'t see it yet'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {plan.updated_by_name ? `Last edited by ${plan.updated_by_name}` : ''}
            </span>
          </div>
          <LessonPlanWeek plan={plan}/>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {canEdit && <button className="bg" onClick={() => { setDraft(toDraft(plan)); setMsg(null); }} disabled={busy}>✏️ Edit</button>}
            {canEdit && plan.status !== 'published' && <button className="bp" onClick={() => setShared(true)} disabled={busy}>{busy ? <Spinner/> : 'Share with families'}</button>}
            {canEdit && plan.status === 'published' && <button className="bg" onClick={() => setShared(false)} disabled={busy}>Stop sharing</button>}
            <button className="bg" onClick={() => printLessonPlan(plan, room?.name || '', facility?.name)}>🖨 Print for the room</button>
          </div>
        </div>
      )}

      <Confirm open={confirmDelete} danger title="Delete this plan?" message={`The plan for ${room?.name}, week of ${weekText(week)}, will be removed for staff and families.`}
        onConfirm={remove} onCancel={() => setConfirmDelete(false)}/>
    </div>
  );
}

function PlanEditor({ draft, setDraft, week, busy, published, onSave, onSaveShare, onCancel, onDelete }) {
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setAct = (id, patch) => setDraft(d => ({ ...d, activities: d.activities.map(a => a.id === id ? { ...a, ...patch } : a) }));
  const removeAct = id => setDraft(d => ({ ...d, activities: d.activities.filter(a => a.id !== id) }));
  const addAct = day => setDraft(d => ({ ...d, activities: [...d.activities, { id: newId(), day, area: 'circle', title: '', description: '', materials: '' }] }));
  const everyDay = a => setDraft(d => ({ ...d, activities: [...d.activities,
    ...DAYS.filter(x => x.n !== a.day && !d.activities.some(o => o.day === x.n && o.title.trim() === a.title.trim()))
      .map(x => ({ ...a, id: newId(), day: x.n }))] }));

  return (
    <div>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
        <label className="fl">Theme <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input className="fi" value={draft.theme} onChange={e => set('theme', e.target.value)} maxLength={150} placeholder="e.g. Fall harvest"/>
        <label className="fl">This week's goals <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <textarea className="fi" rows={2} value={draft.goals} onChange={e => set('goals', e.target.value)} maxLength={2000}
          placeholder="e.g. Count to 10 with objects, name fall colors, practice taking turns"/>
      </div>

      {DAYS.map(d => {
        const acts = draft.activities.filter(a => a.day === d.n);
        return (
          <div key={d.n} className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{d.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{dayDate(week, d.n)}</span>
            </div>
            {acts.map(a => (
              <div key={a.id} style={{ borderTop: '1px dashed var(--border)', padding: '8px 0' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <select className="fi" value={a.area} onChange={e => setAct(a.id, { area: e.target.value })} aria-label="Learning area"
                    style={{ width: 'auto', minWidth: 150, flex: '0 0 auto', marginBottom: 6 }}>
                    {AREAS.map(ar => <option key={ar.id} value={ar.id}>{ar.icon} {ar.label}</option>)}
                  </select>
                  <input className="fi" value={a.title} onChange={e => setAct(a.id, { title: e.target.value })} maxLength={150}
                    placeholder="Activity, e.g. Leaf rubbings" aria-label="Activity" style={{ flex: 1, minWidth: 160, marginBottom: 6 }}/>
                </div>
                <textarea className="fi" rows={2} value={a.description || ''} onChange={e => setAct(a.id, { description: e.target.value })} maxLength={1000}
                  placeholder="What the children will do (optional)" aria-label="Description" style={{ marginBottom: 6 }}/>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="fi" value={a.materials || ''} onChange={e => setAct(a.id, { materials: e.target.value })} maxLength={300}
                    placeholder="Materials (optional)" aria-label="Materials" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}/>
                  <button type="button" className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => everyDay(a)} disabled={!a.title.trim()}
                    title="Add this activity to every other day">Every day</button>
                  <button type="button" className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => removeAct(a.id)} aria-label={`Remove ${a.title || 'activity'}`}>✕</button>
                </div>
              </div>
            ))}
            <button type="button" className="bg" style={{ padding: '6px 12px', fontSize: 12, marginTop: 4 }} onClick={() => addAct(d.n)}>+ Add activity</button>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'sticky', bottom: 0, padding: '10px 0', background: 'var(--body-bg, transparent)' }}>
        <button className="bp" onClick={published ? onSave : onSaveShare} disabled={busy} style={{ flex: 1, minWidth: 160 }}>
          {busy ? <Spinner/> : published ? 'Save (stays shared)' : 'Save and share with families'}
        </button>
        {!published && <button className="bg" onClick={onSave} disabled={busy}>Save draft</button>}
        <button className="bg" onClick={onCancel} disabled={busy}>Cancel</button>
        {onDelete && <button className="bd" style={{ padding: '8px 14px' }} onClick={onDelete} disabled={busy}>Delete</button>}
      </div>
    </div>
  );
}
