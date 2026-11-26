import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import ChildInfoModal from './ChildInfoModal';
import CareLogModal from './CareLogModal';
import { loadCareLogs, summarize, clock } from './care';
import { ageText, ratioCheck, startOfToday, timeText, dayText, latestByChild, errText } from './api';
import { loadPhotoConsent, localDate } from './enrollment';

// Today: each classroom's children (checked in or not), who's in the room, and whether
// the room is within its staff ratio. Counts only this daycare's own check-ins.
export default function TodayBoard({ facilityId, me, myName, manager, userId, onGoTo }) {
  const [loading,  setLoading]  = useState(true);
  const [rooms,    setRooms]    = useState([]);
  const [kids,     setKids]     = useState([]);      // children with classroom_id from their enrollment
  const [latest,   setLatest]   = useState({});      // child_id -> latest check-in here
  const [staff,    setStaff]    = useState([]);
  const [shifts,   setShifts]   = useState([]);      // open room shifts
  const [busy,     setBusy]     = useState({});      // child_id / shift key -> true
  const [alert,    setAlert]    = useState(null);
  const [info,     setInfo]     = useState(null);    // child for the info modal
  const [photoOk,  setPhotoOk]  = useState({});      // family_id -> 'yes' | 'no'
  const [logs,     setLogs]     = useState({});      // child_id -> today's care log entries
  const [logFor,   setLogFor]   = useState(null);    // { kids, editing, startKind } for the log modal
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data: rm }, { data: en }, { data: st }, { data: sh }] = await Promise.all([
      supabase.from('classrooms').select('*').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
      supabase.from('facility_staff').select('id, name, email, user_id, role').eq('facility_id', facilityId).eq('status', 'active'),
      supabase.from('classroom_shifts').select('id, classroom_id, staff_id, started_at').eq('facility_id', facilityId).is('ended_at', null),
    ]);
    const ids = (en || []).map(e => e.child_id);
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    const [{ data: ch }, { data: ci }, consent, care] = ids.length ? await Promise.all([
      supabase.from('children').select('id, name, preferred_name, avatar, color, dob, allergies, allergy_severe, allergy_reaction, diet_types, dietary_restrictions, feeding_notes, family_id').in('id', ids).order('name'),
      supabase.from('checkins').select('id, child_id, status, checked_at, checked_by_name').eq('facility_id', facilityId)
        .in('child_id', ids).gte('checked_at', since).order('checked_at', { ascending: false }),
      loadPhotoConsent(facilityId),
      loadCareLogs(facilityId, localDate(), ids),
    ]) : [{ data: [] }, { data: [] }, {}, {}];
    setPhotoOk(consent || {});
    setLogs(care || {});
    setRooms(rm || []);
    setKids((ch || []).map(c => ({ ...c, classroom_id: roomOf[c.id] || null })));
    setLatest(latestByChild(ci));
    setStaff(st || []);
    setShifts(sh || []);
    setLoading(false);
    firstLoad.current = false;
  }, [facilityId]);

  useEffect(() => { firstLoad.current = true; load(); }, [load]);

  // Other teachers check children in too: refresh every 30 seconds while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  async function toggleChild(child) {
    const cur = latest[child.id];
    const status = cur?.status === 'in' ? 'out' : 'in';
    setBusy(b => ({ ...b, [child.id]: true })); setAlert(null);
    const row = {
      child_id: child.id, family_id: child.family_id, status, facility_id: facilityId,
      checked_by: userId, checked_by_name: myName, checked_by_role: 'staff', checked_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('checkins').insert(row).select('id, child_id, status, checked_at, checked_by_name').single();
    if (error) setAlert(errText(error));
    else setLatest(l => ({ ...l, [child.id]: data }));
    setBusy(b => ({ ...b, [child.id]: false }));
  }

  async function wake(log) {
    setBusy(b => ({ ...b, [log.id]: true })); setAlert(null);
    const { error } = await supabase.from('care_logs').update({ ended_at: new Date().toISOString() }).eq('id', log.id);
    if (error) setAlert(errText(error));
    await load();
    setBusy(b => ({ ...b, [log.id]: false }));
  }

  async function enterRoom(roomId, staffId = null) {
    const key = `room-${roomId}`;
    setBusy(b => ({ ...b, [key]: true })); setAlert(null);
    const { error } = await supabase.rpc('start_room_shift', { p_classroom_id: roomId, p_staff_id: staffId });
    if (error) setAlert(errText(error));
    await load();
    setBusy(b => ({ ...b, [key]: false }));
  }

  async function leaveRoom(shiftId) {
    setBusy(b => ({ ...b, [shiftId]: true })); setAlert(null);
    const { error } = await supabase.rpc('end_room_shift', { p_shift_id: shiftId });
    if (error) setAlert(errText(error));
    await load();
    setBusy(b => ({ ...b, [shiftId]: false }));
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const today      = startOfToday();
  const isIn       = c => latest[c.id]?.status === 'in';
  const staffById  = Object.fromEntries(staff.map(s => [s.id, s]));
  const myStaffId  = me.id;
  const myShift    = shifts.find(s => s.staff_id === myStaffId);
  const myRoom     = myShift && rooms.find(r => r.id === myShift.classroom_id);
  const kidsIn     = kids.filter(isIn).length;
  const unassigned = kids.filter(k => !k.classroom_id || !rooms.some(r => r.id === k.classroom_id));
  const roomStats  = rooms.map(r => {
    const roomKids  = kids.filter(k => k.classroom_id === r.id);
    const inCount   = roomKids.filter(isIn).length;
    const roomShift = shifts.filter(s => s.classroom_id === r.id);
    return { room: r, roomKids, inCount, roomShift, check: ratioCheck(inCount, roomShift.length, r.ratio) };
  });
  const shortRooms = roomStats.filter(s => !s.check.ok).length;
  const freeStaff  = staff.filter(s => !shifts.some(sh => sh.staff_id === s.id));

  if (!rooms.length) return (
    <div className="es"><div className="ic">🧸</div><h3>No classrooms yet</h3>
      <p>{manager ? 'Add your classrooms with their age groups and ratios to start the day board.' : 'Your director hasn\'t added classrooms yet.'}</p>
      {manager && <button className="bp" onClick={() => onGoTo('classrooms')}>+ Add a classroom</button>}
    </div>
  );

  return (
    <div>
      {alert && <div className="al al-e">{alert}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
        <Stat value={`${kidsIn}`} sub={`of ${kids.length} here`} label="Children"/>
        <Stat value={`${shifts.length}`} sub={`of ${staff.length} staff`} label="In rooms"/>
        <Stat value={shortRooms ? `${shortRooms}` : '✓'} sub={shortRooms ? (shortRooms === 1 ? 'room needs staff' : 'rooms need staff') : 'all in ratio'}
          label="Ratio" tone={shortRooms ? 'bad' : 'ok'}/>
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)', flex: 1, minWidth: 180 }}>
          {myRoom ? <>You're in <strong style={{ color: 'var(--text)' }}>{myRoom.name}</strong> since {timeText(myShift.started_at)}</>
                  : 'You\'re not in a classroom. Tap "I\'m in this room" on yours so the ratio counts you.'}
        </span>
        {myShift && <button className="bg" style={{ fontSize: 12, padding: '6px 12px' }} disabled={busy[myShift.id]} onClick={() => leaveRoom(myShift.id)}>Leave room</button>}
      </div>

      {!kids.length && (
        <div className="al al-i">No children enrolled yet. {manager && <button className="bg" style={{ marginLeft: 8, fontSize: 12, padding: '4px 10px' }} onClick={() => onGoTo('families')}>Enroll a family</button>}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {roomStats.map(({ room, roomKids, inCount, roomShift, check }) => {
          const color = room.color || '#8B78D4';
          const amIn  = roomShift.some(s => s.staff_id === myStaffId);
          const tone  = !inCount ? 'idle' : check.ok ? 'ok' : 'bad';
          return (
            <div key={room.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 5, background: color }}/>
              <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 18, fontWeight: 600 }}>{room.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {[room.age_group, `1:${room.ratio}`, room.capacity ? `${roomKids.length}/${room.capacity} enrolled` : `${roomKids.length} enrolled`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <RatioPill tone={tone} inCount={inCount} staffCount={roomShift.length} short={check.short}/>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10 }}>
                  {roomShift.map(s => {
                    const person = staffById[s.staff_id];
                    const canEnd = manager || s.staff_id === myStaffId;
                    return (
                      <span key={s.id} className="chip" style={{ fontSize: 11, padding: '3px 8px' }}>
                        👤 {person?.name || person?.email || 'Staff'}
                        {canEnd && <button onClick={() => leaveRoom(s.id)} disabled={busy[s.id]} aria-label={`Take ${person?.name || 'staff'} out of ${room.name}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, padding: 0, marginLeft: 2 }}>✕</button>}
                      </span>
                    );
                  })}
                  {!amIn && (
                    <button className="bg" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy[`room-${room.id}`]} onClick={() => enterRoom(room.id)}>
                      {busy[`room-${room.id}`] ? <Spinner size={10}/> : '+ I\'m in this room'}
                    </button>
                  )}
                  {manager && freeStaff.filter(s => s.id !== myStaffId).length > 0 && (
                    <select className="fi" value="" onChange={e => e.target.value && enterRoom(room.id, e.target.value)}
                      style={{ width: 'auto', marginBottom: 0, padding: '4px 8px', fontSize: 11, borderRadius: 10 }} aria-label={`Put staff in ${room.name}`}>
                      <option value="">+ Staff…</option>
                      {freeStaff.filter(s => s.id !== myStaffId).map(s => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ padding: '6px 8px 10px' }}>
                {roomKids.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 6px', fontStyle: 'italic' }}>No children in this room.</div>
                  : roomKids.map(c => <ChildRow key={c.id} child={c} noPhoto={photoOk[c.family_id] === 'no'} last={latest[c.id]} today={today} busy={busy[c.id]} onToggle={() => toggleChild(c)} onInfo={() => setInfo(c)}
                      logs={logs[c.id] || []} onLog={() => setLogFor({ kids: [c] })} onWake={wake} busyMap={busy}/>)}
                {roomKids.length > 0 && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '6px 6px 0' }}>
                    <button onClick={() => setLogFor({ kids: roomKids.filter(isIn).length ? roomKids.filter(isIn) : roomKids })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                      📝 Log for the room
                    </button>
                    <button onClick={() => printDietSheet(room, roomKids, photoOk)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      🖨 Allergy & diet sheet
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
          <SectionLabel>Not in a classroom yet</SectionLabel>
          {unassigned.map(c => <ChildRow key={c.id} child={c} noPhoto={photoOk[c.family_id] === 'no'} last={latest[c.id]} today={today} busy={busy[c.id]} onToggle={() => toggleChild(c)} onInfo={() => setInfo(c)}
            logs={logs[c.id] || []} onLog={() => setLogFor({ kids: [c] })} onWake={wake} busyMap={busy}/>)}
          {manager && <button className="bg" style={{ fontSize: 12, padding: '5px 12px', marginTop: 6 }} onClick={() => onGoTo('families')}>Place them in a classroom</button>}
        </div>
      )}

      <ChildInfoModal child={info} facilityId={facilityId} onClose={() => setInfo(null)}/>
      <CareLogModal open={!!logFor} facilityId={facilityId} day={localDate()} kids={logFor?.kids || []} editing={logFor?.editing || null}
        startKind={logFor?.startKind || null} onClose={() => setLogFor(null)} onSaved={load}/>
    </div>
  );
}

function Stat({ value, sub, label, tone }) {
  const color = tone === 'bad' ? 'var(--err-text)' : tone === 'ok' ? 'var(--ok-text)' : 'var(--text)';
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 26, fontWeight: 600, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>
    </div>
  );
}

function RatioPill({ tone, inCount, staffCount, short }) {
  const styles = {
    ok:   { bg: 'rgba(58,158,122,.14)', fg: 'var(--ok-text)',  bd: 'rgba(58,158,122,.3)' },
    bad:  { bg: 'rgba(192,80,80,.14)',  fg: 'var(--err-text)', bd: 'rgba(192,80,80,.3)' },
    idle: { bg: 'var(--input-bg)',      fg: 'var(--text-faint)', bd: 'var(--border)' },
  }[tone];
  const text = tone === 'bad' ? `Needs ${short} more staff` : tone === 'ok' ? 'In ratio' : 'Empty';
  return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: styles.bg, color: styles.fg, border: `1px solid ${styles.bd}` }}>{text}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{inCount} kid{inCount === 1 ? '' : 's'} · {staffCount} staff</div>
    </div>
  );
}

// Printable sheet to post in the room or kitchen: allergies (severe first), diet, feeding.
function printDietSheet(room, kids, photoOk) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const rows = [...kids].sort((a, b) => (b.allergy_severe - a.allergy_severe) || ((b.allergies || []).length - (a.allergies || []).length) || a.name.localeCompare(b.name));
  const body = rows.map(c => {
    const allergies = (c.allergies || []).filter(Boolean);
    const diet = [...(c.diet_types || []), c.dietary_restrictions].filter(Boolean).join('; ');
    return `<tr class="${c.allergy_severe ? 'sev' : ''}">
      <td><b>${esc(c.preferred_name || c.name)}</b>${photoOk[c.family_id] === 'no' ? '<div class="np">No photos</div>' : ''}</td>
      <td>${allergies.length ? `${c.allergy_severe ? '<span class="tag">SEVERE</span> ' : ''}${esc(allergies.join(', '))}${c.allergy_reaction ? `<div class="sm">${esc(c.allergy_reaction)}</div>` : ''}` : '<span class="none">None</span>'}</td>
      <td>${diet ? esc(diet) : '<span class="none">None</span>'}</td>
      <td>${c.feeding_notes ? esc(c.feeding_notes) : ''}</td></tr>`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(room.name)} allergy & diet sheet</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:28px}
    h1{font-size:22px;margin:0 0 2px}.sub{color:#64748b;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:#f1f5f9;padding:8px;font-size:11px;text-transform:uppercase;color:#475569}
    td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top}tr.sev td{background:#fef2f2}
    .tag{background:#dc2626;color:#fff;font-size:10px;font-weight:bold;padding:1px 6px;border-radius:4px}
    .sm{font-size:11px;color:#7f1d1d;margin-top:3px}.none{color:#94a3b8}.np{font-size:10px;color:#b45309;margin-top:2px}
  </style></head><body><h1>${esc(room.name)}: allergies & diets</h1>
  <div class="sub">Printed ${esc(new Date().toLocaleDateString())}. Check littleloop for changes.</div>
  <table><thead><tr><th>Child</th><th>Allergies</th><th>Diet</th><th>Feeding</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

function ChildRow({ child, noPhoto, last, today, busy, onToggle, onInfo, logs = [], onLog, onWake, busyMap = {} }) {
  const isIn  = last?.status === 'in';
  const { chips, napping } = summarize(logs);
  const stale = isIn && new Date(last.checked_at) < today;
  const allergies = (child.allergies || []).filter(Boolean);
  const status = !last ? 'Not here yet'
    : isIn ? (stale ? `In since ${dayText(last.checked_at)}` : `In ${timeText(last.checked_at)}`)
    : new Date(last.checked_at) >= today ? `Out ${timeText(last.checked_at)}` : 'Not here yet';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderRadius: 12 }}>
      <button onClick={onInfo} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'var(--text)' }}>
        <span style={{ width: 34, height: 34, borderRadius: 12, background: `${child.color || '#8B78D4'}22`, border: `1px solid ${child.color || '#8B78D4'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, opacity: isIn ? 1 : .55 }}>{child.avatar || '🌟'}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {child.preferred_name || child.name}
            {child.dob && <span style={{ fontWeight: 500, color: 'var(--text-faint)', fontSize: 11 }}> · {ageText(child.dob)}</span>}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: stale ? 'var(--warn-text)' : 'var(--text-faint)' }}>
            {status}{stale && ' · not checked out'}
            {allergies.length > 0 && <span style={{ color: 'var(--err-text)', fontWeight: child.allergy_severe ? 800 : 700 }}> · {child.allergy_severe ? '🚨 SEVERE ' : '⚠️ '}{allergies.join(', ')}</span>}
            {(child.diet_types || []).length > 0 && <span> · 🍽 {child.diet_types.join(', ')}</span>}
            {noPhoto && <span title="Family said no to photos"> · 📵 no photos</span>}
          </span>
          {(chips.length > 0 || napping) && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
              {napping && <span style={{ fontWeight: 700 }}>😴 Asleep since {clock(napping.started_at)}{chips.length ? ' · ' : ''}</span>}
              {chips.join('  ')}
            </span>
          )}
        </span>
      </button>
      {napping ? (
        <button onClick={() => onWake(napping)} disabled={busyMap[napping.id]} title="Mark awake" aria-label={`${child.preferred_name || child.name} woke up`}
          style={{ flexShrink: 0, width: 32, height: 30, padding: 0, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--input-bg)', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
          {busyMap[napping.id] ? <Spinner size={10}/> : '☀️'}
        </button>
      ) : (
        <button onClick={onLog} title="Log a meal, nap, diaper…" aria-label={`Log for ${child.preferred_name || child.name}`}
          style={{ flexShrink: 0, width: 32, height: 30, padding: 0, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--input-bg)', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
          📝
        </button>
      )}
      <button onClick={onToggle} disabled={busy}
        style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#fff', minWidth: 84,
          background: isIn ? 'linear-gradient(135deg,#E05A5A,#B03030)' : 'linear-gradient(135deg,#3A9E7A,#2A7A5A)', opacity: busy ? .6 : 1 }}>
        {busy ? <Spinner size={10}/> : isIn ? 'Check out' : 'Check in'}
      </button>
    </div>
  );
}
