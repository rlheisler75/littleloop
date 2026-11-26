import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { DOMAINS, BANDS, LEVELS, levelOf, bandForDob, loadSkills, loadLatestLevels, starterRows, childName, STARTER_SKILLS } from './learning';
import { localDate, fmtDate } from './enrollment';
import { ageText, errText } from './api';

// Skills: the daycare's checklist and each child's progress. Any staff member records a
// level with one tap (it's kept as a dated observation); tapping a skill shows its history.
export default function SkillsTracker({ facilityId, rooms, kids, myRoomId, manager, userId }) {
  const [skills,  setSkills]  = useState(null);
  const [roomId,  setRoomId]  = useState(() => (myRoomId && rooms.some(r => r.id === myRoomId)) ? myRoomId : 'all');
  const [childId, setChildId] = useState(null);
  const [band,    setBand]    = useState('preschool');
  const [latest,  setLatest]  = useState({});
  const [busy,    setBusy]    = useState(null);     // skill id being saved
  const [msg,     setMsg]     = useState(null);
  const [detail,  setDetail]  = useState(null);     // skill
  const [editing, setEditing] = useState(false);

  const loadAll = useCallback(async () => setSkills(await loadSkills(facilityId)), [facilityId]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const shownKids = kids.filter(k => roomId === 'all' || k.classroom_id === roomId);
  const child = kids.find(k => k.id === childId) || null;
  useEffect(() => {
    if (!shownKids.some(k => k.id === childId)) setChildId(shownKids[0]?.id || null);
  }, [roomId, kids]);   // eslint-disable-line react-hooks/exhaustive-deps

  const loadChild = useCallback(async () => {
    if (!childId) { setLatest({}); return; }
    const all = await loadLatestLevels(facilityId, [childId]);
    setLatest(all[childId] || {});
  }, [facilityId, childId]);
  useEffect(() => {
    setLatest({}); setMsg(null);
    const c = kids.find(k => k.id === childId);
    setBand(bandForDob(c?.dob) || 'preschool');
    loadChild();
  }, [childId]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function record(skill, level) {
    setBusy(skill.id); setMsg(null);
    const { data, error } = await supabase.from('skill_observations')
      .insert({ facility_id: facilityId, child_id: childId, skill_id: skill.id, level, observed_on: localDate() })
      .select('id, child_id, skill_id, level, note, observed_on, created_at, created_by, created_by_name').single();
    setBusy(null);
    if (error) { setMsg({ err: errText(error) }); return; }
    setLatest(l => ({ ...l, [skill.id]: data }));
  }

  async function addStarter() {
    setBusy('starter'); setMsg(null);
    const { error } = await supabase.from('facility_skills').insert(starterRows(facilityId));
    setBusy(null);
    if (error) { setMsg({ err: errText(error) }); return; }
    loadAll();
  }

  if (skills === null) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;

  if (!skills.length) return (
    <div className="es"><div className="ic">🌱</div><h3>Set up your skills checklist</h3>
      {manager ? (
        <>
          <p>Teachers track each child's progress against a checklist of skills for infants, toddlers and preschoolers. Start with ours ({Object.values(STARTER_SKILLS).reduce((s, b) => s + Object.values(b).flat().length, 0)} common milestones you can rename, hide or add to) or build your own.</p>
          {msg?.err && <div className="al al-e">{msg.err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="bp" onClick={addStarter} disabled={!!busy}>{busy ? <Spinner/> : 'Use the littleloop checklist'}</button>
            <button className="bg" onClick={() => setEditing(true)}>Build my own</button>
          </div>
          {editing && <ChecklistEditor facilityId={facilityId} skills={skills} onClose={() => setEditing(false)} onChanged={loadAll}/>}
        </>
      ) : <p>Your director or office sets up the skills checklist first.</p>}
    </div>
  );

  const bandSkills = skills.filter(s => s.active && s.band === band);
  const domains = DOMAINS.map(d => ({ ...d, items: bandSkills.filter(s => s.domain === d.id) })).filter(d => d.items.length);
  const achieved = bandSkills.filter(s => latest[s.id]?.level === 'achieved').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {rooms.length > 1 && (
          <select className="fi" value={roomId} onChange={e => setRoomId(e.target.value)} aria-label="Classroom"
            style={{ width: 'auto', minWidth: 150, marginBottom: 0, padding: '7px 10px' }}>
            <option value="all">All classrooms</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.id === myRoomId ? ' (my room)' : ''}</option>)}
          </select>
        )}
        {manager && <button className="bg" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }} onClick={() => setEditing(true)}>✏️ Edit checklist</button>}
      </div>

      {shownKids.length === 0 ? <div className="al al-s">No children enrolled in this classroom.</div> : (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
          {shownKids.map(k => (
            <button key={k.id} className="chip" onClick={() => setChildId(k.id)}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: k.id === childId ? 'var(--accent)' : undefined, color: k.id === childId ? '#fff' : undefined }}>
              {k.avatar || '🌟'} {childName(k)}
            </button>
          ))}
        </div>
      )}

      {msg?.err && <div className="al al-e">{msg.err}</div>}

      {child && (
        <>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26 }}>{child.avatar || '🌟'}</span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{childName(child)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {[ageText(child.dob), rooms.find(r => r.id === child.classroom_id)?.name].filter(Boolean).join(' · ')}
                {bandSkills.length > 0 && ` · ${achieved} of ${bandSkills.length} achieved`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {BANDS.map(b => (
                <button key={b.id} className="chip" onClick={() => setBand(b.id)} title={`Ages ${b.hint}`}
                  style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, background: band === b.id ? 'var(--accent)' : undefined, color: band === b.id ? '#fff' : undefined }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {domains.length === 0 && <div className="al al-w">No {BANDS.find(b => b.id === band)?.label.toLowerCase()} skills on the checklist yet.{manager ? ' Add some with Edit checklist.' : ''}</div>}

          {domains.map(d => {
            const done = d.items.filter(s => latest[s.id]?.level === 'achieved').length;
            return (
              <div key={d.id} className="card" style={{ padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{d.icon} {d.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 700 }}>{done} of {d.items.length} achieved</span>
                </div>
                {d.items.map(s => {
                  const o = latest[s.id];
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => setDetail(s)} style={{ flex: 1, minWidth: 180, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)' }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>
                          {o ? `${levelOf(o.level)?.label} · ${fmtDate(o.observed_on)}${o.created_by_name ? ` · ${o.created_by_name}` : ''}${o.note ? ' · 📝' : ''}` : 'Not assessed yet'}
                        </span>
                      </button>
                      <LevelButtons value={o?.level} busy={busy === s.id} onPick={lv => record(s, lv)}/>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {detail && child && <SkillDetail facilityId={facilityId} skill={detail} child={child} manager={manager} userId={userId}
        onClose={() => setDetail(null)} onChanged={loadChild}/>}
      {editing && <ChecklistEditor facilityId={facilityId} skills={skills} onClose={() => setEditing(false)} onChanged={loadAll}/>}
    </div>
  );
}

export function LevelButtons({ value, busy, onPick, small = false }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: busy ? .5 : 1 }} role="group" aria-label="Level">
      {LEVELS.map(l => {
        const on = value === l.id;
        return (
          <button key={l.id} type="button" disabled={busy} onClick={() => onPick(l.id)} aria-pressed={on}
            style={{ padding: small ? '3px 6px' : '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${on ? l.color : 'var(--border)'}`, background: on ? l.color : 'transparent', color: on ? '#fff' : 'var(--text-dim)' }}>
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

// One skill for one child: its history, plus a dated entry with a note.
function SkillDetail({ facilityId, skill, child, manager, userId, onClose, onChanged }) {
  const [rows,  setRows]  = useState(null);
  const [level, setLevel] = useState(null);
  const [day,   setDay]   = useState(localDate());
  const [note,  setNote]  = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('skill_observations').select('*').eq('child_id', child.id).eq('skill_id', skill.id)
      .order('observed_on', { ascending: false }).order('created_at', { ascending: false });
    setRows(data || []);
    if (level === null) setLevel(data?.[0]?.level || 'emerging');
  }, [child.id, skill.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('skill_observations')
      .insert({ facility_id: facilityId, child_id: child.id, skill_id: skill.id, level, observed_on: day, note: note.trim() || null });
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    setNote(''); load(); onChanged();
  }

  async function remove(id) {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('skill_observations').delete().eq('id', id);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    load(); onChanged();
  }

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {DOMAINS.find(d => d.id === skill.domain)?.label} · {childName(child)}
      </div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 10 }}>{skill.name}</div>
      {error && <div className="al al-e">{error}</div>}

      <label className="fl">Level</label>
      <div style={{ marginBottom: 12 }}><LevelButtons value={level} onPick={setLevel}/></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: '0 0 150px' }}><label className="fl">Observed</label>
          <input className="fi" type="date" value={day} max={localDate()} onChange={e => setDay(e.target.value)}/></div>
        <div style={{ flex: 1 }}><label className="fl">Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input className="fi" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="What you saw"/></div>
      </div>
      <button className="bp full" onClick={save} disabled={busy || !level || !day}>{busy ? <Spinner/> : 'Save'}</button>

      <div style={{ fontSize: 12, fontWeight: 800, margin: '16px 0 6px' }}>History</div>
      <div style={{ maxHeight: '32vh', overflowY: 'auto' }}>
        {!rows ? <Spinner/> : rows.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nothing recorded yet.</div> : rows.map(r => {
          const l = levelOf(r.level);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: l?.color, borderRadius: 8, padding: '2px 7px', flexShrink: 0 }}>{l?.label}</span>
              <span style={{ flex: 1, fontSize: 12 }}>
                {fmtDate(r.observed_on)}{r.created_by_name ? ` · ${r.created_by_name}` : ''}
                {r.note && <span style={{ display: 'block', color: 'var(--text-dim)' }}>{r.note}</span>}
              </span>
              {(manager || r.created_by === userId) && (
                <button className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => remove(r.id)} disabled={busy} aria-label="Delete this entry">✕</button>
              )}
            </div>
          );
        })}
      </div>
      <button className="bg full" style={{ marginTop: 12 }} onClick={onClose} disabled={busy}>Close</button>
    </Modal>
  );
}

// Director/office: rename, hide or add skills; add the starter list for an empty age group.
function ChecklistEditor({ facilityId, skills, onClose, onChanged }) {
  const [band,  setBand]  = useState('preschool');
  const [names, setNames] = useState({});     // id -> edited name
  const [adds,  setAdds]  = useState({});     // domain -> new skill name
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const inBand = skills.filter(s => s.band === band);

  async function run(fn) {
    setBusy(true); setError(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) { setError(errText(err)); return false; }
    onChanged(); return true;
  }
  const rename = s => {
    const n = (names[s.id] ?? s.name).trim();
    if (!n || n === s.name) return;
    run(() => supabase.from('facility_skills').update({ name: n }).eq('id', s.id));
  };
  const toggle = s => run(() => supabase.from('facility_skills').update({ active: !s.active }).eq('id', s.id));
  const add = async domain => {
    const n = (adds[domain] || '').trim();
    if (!n) return;
    const sort = Math.max(0, ...inBand.filter(s => s.domain === domain).map(s => s.sort)) + 10;
    if (await run(() => supabase.from('facility_skills').insert({ facility_id: facilityId, band, domain, name: n, sort })))
      setAdds(a => ({ ...a, [domain]: '' }));
  };
  const addStarterBand = () => run(() => supabase.from('facility_skills').insert(starterRows(facilityId).filter(r => r.band === band)));

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>Skills checklist</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>Hidden skills keep their history but stop showing for new progress and report cards.</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {BANDS.map(b => (
          <button key={b.id} className="chip" onClick={() => setBand(b.id)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: band === b.id ? 'var(--accent)' : undefined, color: band === b.id ? '#fff' : undefined }}>
            {b.label} <span style={{ fontWeight: 400 }}>({b.hint})</span>
          </button>
        ))}
      </div>
      {error && <div className="al al-e">{error}</div>}
      {inBand.length === 0 && (
        <div className="al al-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          No skills for this age group yet.
          <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={addStarterBand} disabled={busy}>Add the littleloop list</button>
        </div>
      )}
      <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {DOMAINS.map(d => {
          const list = inBand.filter(s => s.domain === d.id).sort((a, b) => a.sort - b.sort);
          return (
            <div key={d.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{d.icon} {d.label}</div>
              {list.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, opacity: s.active ? 1 : .55 }}>
                  <input className="fi" value={names[s.id] ?? s.name} onChange={e => setNames(n => ({ ...n, [s.id]: e.target.value }))}
                    onBlur={() => rename(s)} maxLength={200} aria-label="Skill name" style={{ marginBottom: 0, padding: '6px 9px', fontSize: 13 }}/>
                  <button className="bg" style={{ padding: '5px 9px', fontSize: 11, flexShrink: 0 }} onClick={() => toggle(s)} disabled={busy}>{s.active ? 'Hide' : 'Show'}</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="fi" value={adds[d.id] || ''} onChange={e => setAdds(a => ({ ...a, [d.id]: e.target.value }))} maxLength={200}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(d.id); } }}
                  placeholder="Add a skill" aria-label={`Add a ${d.label} skill`} style={{ marginBottom: 0, padding: '6px 9px', fontSize: 13 }}/>
                <button className="bg" style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }} onClick={() => add(d.id)} disabled={busy || !(adds[d.id] || '').trim()}>Add</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="bg full" style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>Done</button>
    </Modal>
  );
}
