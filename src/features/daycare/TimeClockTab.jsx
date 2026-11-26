import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { shortDate } from './billing';
import { presetRange, hours, downloadCsv } from './office';
import { localDate } from './enrollment';
import { roleLabel, errText } from './api';
import RangePicker from './RangePicker';

// GPS time clock (like ElderLoop's). Staff clock in and out on their phone; the location is saved
// only at that moment and the server checks it's within the daycare's radius. The director and
// office see who's on the clock, timesheets with overtime, and fix missed or wrong punches.

const OPEN_LIMIT_MS = 16 * 3600 * 1000;    // a clock-in older than this was a forgotten clock-out
const ft = m => Math.round(m * 3.28084);
const ftRound = m => Math.round(m * 3.28084 / 10) * 10;   // radius in feet, to the nearest 10 (500 ft is stored as 152 m)
const time = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const weekday = iso => new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const pad = n => String(n).padStart(2, '0');
const toInput = ts => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const mondayOf = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDate(d); };
function haversine(lat1, lng1, lat2, lng2) {
  const r = x => x * Math.PI / 180, R = 6371000;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Watches the phone's location while the clock is on screen (nothing is saved until a punch)
function useGps(active) {
  const [gps, setGps] = useState(null);
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) { setGps({ error: 'This device can\'t share its location.' }); return; }
    const id = navigator.geolocation.watchPosition(
      p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => setGps({ error: e.code === 1
        ? 'Location is off for littleloop. Allow location for this site in your browser or phone settings.'
        : 'Couldn\'t find your location yet. Try near a window or step outside for a moment.' }),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return gps;
}

export default function TimeClockTab({ facility, facilityId, me, manager }) {
  const [view, setView] = useState('clock');
  const [settings, setSettings] = useState(undefined);   // undefined = loading, null = not set up
  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('daycare_timeclock_settings').select('*').eq('facility_id', facilityId).maybeSingle();
    setSettings(data || null);
  }, [facilityId]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  const views = [{ id: 'clock', label: 'My clock' }, ...(manager ? [{ id: 'team', label: 'Team' }, { id: 'settings', label: 'Settings' }] : [])];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Time clock</div>
        {views.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {views.map(v => (
              <button key={v.id} className="chip" onClick={() => setView(v.id)}
                style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: view === v.id ? 'var(--accent)' : undefined, color: view === v.id ? '#fff' : undefined }}>{v.label}</button>
            ))}
          </div>
        )}
      </div>
      {settings === undefined ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <>
          {view === 'clock'    && <MyClock facility={facility} facilityId={facilityId} me={me} manager={manager} settings={settings} onSetup={() => setView('settings')}/>}
          {view === 'team'     && manager && <Team facilityId={facilityId}/>}
          {view === 'settings' && manager && <ClockSettings facility={facility} facilityId={facilityId} settings={settings} onSaved={loadSettings}/>}
        </>
      )}
    </div>
  );
}

function pairShifts(asc) {
  const out = []; let open = null;
  for (const p of asc) {
    if (p.punch_type === 'in') { if (open) out.push({ in: open, out: null }); open = p; }
    else if (open) { out.push({ in: open, out: p }); open = null; }
  }
  if (open) out.push({ in: open, out: null });
  return out;
}

// ── My clock (everyone) ──────────────────────────────────────────────────────
function MyClock({ facility, facilityId, me, manager, settings, onSetup }) {
  const gps = useGps(true);
  const [punches, setPunches] = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [now,     setNow]     = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 21 * 86400000).toISOString();
    const { data, error } = await supabase.from('daycare_time_punches')
      .select('id, punch_type, punched_at, within_geofence, source, original_punched_at, voided_at')
      .eq('staff_id', me.id).is('voided_at', null).gte('punched_at', since).order('punched_at');
    if (error) setMsg({ err: errText(error) });
    setPunches(data || []);
  }, [me.id]);
  useEffect(() => { load(); }, [load]);

  const last     = punches?.[punches.length - 1];
  const onClock  = last?.punch_type === 'in' && now - new Date(last.punched_at) < OPEN_LIMIT_MS;
  const forgot   = last?.punch_type === 'in' && !onClock;
  const geo      = settings?.lat != null;
  const dist     = geo && gps && !gps.error ? haversine(gps.lat, gps.lng, settings.lat, settings.lng) : null;
  const inside   = dist != null && dist <= settings.radius_m + Math.min(gps.accuracy || 0, 100);
  const required = geo && settings.require_geofence;
  const blocked  = required && !inside;

  async function punch() {
    setBusy(true); setMsg(null);
    const g = gps && !gps.error ? gps : null;
    const { data, error } = await supabase.rpc('daycare_clock_punch', { p_facility: facilityId, p_lat: g?.lat ?? null, p_lng: g?.lng ?? null, p_accuracy: g?.accuracy ?? null });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: data.type === 'in' ? `Clocked in at ${time(data.punched_at)}.` : `Clocked out at ${time(data.punched_at)}. Have a good evening!` });
    load();
  }

  const shifts = pairShifts(punches || []);
  const mins = s => s.out ? (new Date(s.out.punched_at) - new Date(s.in.punched_at)) / 60000
                   : (s === shifts[shifts.length - 1] && onClock ? (now - new Date(s.in.punched_at)) / 60000 : 0);
  const weekStart = presetRange('this_week')[0];
  const weekMins  = shifts.filter(s => localDate(new Date(s.in.punched_at)) >= weekStart).reduce((t, s) => t + mins(s), 0);

  let where = null;
  if (!geo) where = manager
    ? <>The daycare's location isn't set, so the clock can't check that staff are on site. <button className="bg" style={{ padding: '2px 8px', fontSize: 11 }} onClick={onSetup}>Set it up</button></>
    : null;
  else if (!gps) where = 'Finding your location…';
  else if (gps.error) where = gps.error;
  else where = inside ? `📍 At ${facility?.name || 'the daycare'} (about ${ft(dist)} ft away)`
                      : `📍 About ${ft(dist).toLocaleString()} ft from ${facility?.name || 'the daycare'}.${required ? ` Clock in or out within ${ftRound(settings.radius_m).toLocaleString()} ft.` : ''}`;

  return (
    <div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {forgot && (
        <div className="al al-w">
          You clocked in {weekday(localDate(new Date(last.punched_at)))} at {time(last.punched_at)} and didn't clock out. Ask the director or office to fix it. Clocking in now starts a new shift.
        </div>
      )}
      <div className="card" style={{ padding: '18px 16px', textAlign: 'center', marginBottom: 12 }}>
        {punches === null ? <Spinner size={22}/> : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700 }}>{onClock ? 'On the clock since' : 'You\'re clocked out'}</div>
            {onClock && <div style={{ fontSize: 30, fontWeight: 800, margin: '2px 0' }}>{time(last.punched_at)} <span style={{ fontSize: 15, color: 'var(--text-dim)' }}>· {hours((now - new Date(last.punched_at)) / 60000)} h</span></div>}
            <button className={onClock ? 'bd' : 'bp'} onClick={punch} disabled={busy || blocked || (required && !gps)}
              style={{ fontSize: 18, padding: '14px 36px', margin: '12px auto 10px', display: 'block', minWidth: 200 }}>
              {busy ? <Spinner/> : onClock ? 'Clock out' : 'Clock in'}
            </button>
            {where && <div style={{ fontSize: 12, color: blocked && gps && !gps.error ? 'var(--err-text)' : 'var(--text-dim)', lineHeight: 1.5 }}>{where}</div>}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px 6px' }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Your recent shifts</div>
        <div style={{ fontSize: 12 }}>This week: <strong>{hours(weekMins)} h</strong></div>
      </div>
      {shifts.length === 0 ? <div className="al al-s">No shifts in the last 3 weeks.</div> : (
        <div className="card" style={{ padding: '4px 14px' }}>
          {[...shifts].reverse().map(s => {
            const fixed = [s.in, s.out].some(p => p && (p.source === 'manager' || p.original_punched_at));
            const off = [s.in, s.out].some(p => p && p.within_geofence === false);
            return (
              <div key={s.in.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ minWidth: 110, fontWeight: 700 }}>{weekday(localDate(new Date(s.in.punched_at)))}</span>
                <span style={{ flex: 1 }}>
                  {time(s.in.punched_at)} – {s.out ? time(s.out.punched_at) : (s === shifts[shifts.length - 1] && onClock ? 'now' : <em style={{ color: 'var(--err-text)' }}>no clock-out</em>)}
                  {fixed && <span title="Fixed by the director or office" style={{ fontSize: 11, color: 'var(--text-faint)' }}> · fixed by office</span>}
                  {off && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}> · off site</span>}
                </span>
                <span style={{ fontWeight: 800 }}>{hours(mins(s))} h</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
        Your location is saved only at the moment you clock in or out, so {facility?.name || 'the daycare'} can see the punch was made on site. It isn't tracked in between.
      </div>
    </div>
  );
}

// ── Team (director and office) ───────────────────────────────────────────────
function Team({ facilityId }) {
  const [range,  setRange]  = useState(() => presetRange('this_week'));
  const [rows,   setRows]   = useState(null);
  const [nowOn,  setNowOn]  = useState([]);
  const [staff,  setStaff]  = useState([]);
  const [open,   setOpen]   = useState(null);
  const [fix,    setFix]    = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg,    setMsg]    = useState(null);
  const load = useCallback(async () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const [{ data, error }, { data: recent }, { data: st }] = await Promise.all([
      supabase.rpc('daycare_timeclock_hours', { p_facility: facilityId, p_from: range[0], p_to: range[1] }),
      supabase.rpc('daycare_timeclock_hours', { p_facility: facilityId, p_from: localDate(y), p_to: localDate() }),
      supabase.from('facility_staff').select('id, name, email, role, status').eq('facility_id', facilityId).in('status', ['active', 'invited']).order('name'),
    ]);
    if (error) setMsg({ err: errText(error) });
    setRows(data || []);
    setNowOn((recent || []).filter(r => !r.clock_out && Date.now() - new Date(r.clock_in) < OPEN_LIMIT_MS));
    setStaff(st || []);
  }, [facilityId, range]);
  useEffect(() => { load(); }, [load]);

  const people = {};
  for (const r of rows || []) (people[r.staff_id] ||= { name: r.staff_name, role: r.role, shifts: [] }).shifts.push(r);
  const list = Object.entries(people).map(([id, p]) => {
    const weeks = {};
    for (const s of p.shifts) weeks[mondayOf(s.day)] = (weeks[mondayOf(s.day)] || 0) + (s.minutes || 0);
    const total = p.shifts.reduce((t, s) => t + (s.minutes || 0), 0);
    const ot = Object.values(weeks).reduce((t, w) => t + Math.max(0, w - 2400), 0);
    const missing = p.shifts.filter(s => !s.clock_out && Date.now() - new Date(s.clock_in) >= OPEN_LIMIT_MS).length;
    return { id, ...p, total, ot, missing };
  }).sort((a, b) => a.name.localeCompare(b.name));

  function csv() {
    downloadCsv(`timesheet-${range[0]}-to-${range[1]}.csv`, [
      ['Staff member', 'Role', 'Date', 'Clock in', 'Clock out', 'Hours', 'Off site', 'Fixed by office'],
      ...(rows || []).map(r => [r.staff_name, roleLabel(r.role), r.day, time(r.clock_in), time(r.clock_out), r.minutes != null ? hours(r.minutes) : '', r.off_site ? 'yes' : '', r.edited ? 'yes' : '']),
      [],
      ['Staff member', 'Total hours', 'Regular hours', 'Overtime hours'],
      ...list.map(p => [p.name, hours(p.total), hours(p.total - p.ot), hours(p.ot)]),
    ]);
  }

  return (
    <div>
      <div className="card" style={{ padding: '10px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>On the clock now</div>
        {nowOn.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nobody is clocked in.</div> : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nowOn.map(r => <span key={r.in_id} className="chip" style={{ fontSize: 12 }}>{r.staff_name} · since {time(r.clock_in)}{r.off_site ? ' · off site' : ''}</span>)}
          </div>
        )}
      </div>
      <RangePicker range={range} setRange={setRange}/>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="bg" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setAdding(true)}>+ Add a missed shift</button>
        <button className="bg" style={{ padding: '7px 12px', fontSize: 12 }} onClick={csv} disabled={!rows?.length}>⬇ Download timesheet (CSV)</button>
      </div>
      {!rows ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : list.length === 0 ? <div className="al al-s">No clock-ins in these dates.</div> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            {list.map(p => (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setOpen(o => o === p.id ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{p.name}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{roleLabel(p.role)}</span>
                    {p.missing > 0 && <span style={{ fontSize: 11, color: 'var(--err-text)', fontWeight: 700 }}> · {p.missing} missing clock-out{p.missing === 1 ? '' : 's'}</span>}
                  </span>
                  {p.ot > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn-text, #b7791f)' }}>{hours(p.ot)} h overtime</span>}
                  <span style={{ fontSize: 13, fontWeight: 800, minWidth: 64, textAlign: 'right' }}>{hours(p.total)} h</span>
                </button>
                {open === p.id && p.shifts.map(s => {
                  const live = !s.clock_out && Date.now() - new Date(s.clock_in) < OPEN_LIMIT_MS;
                  return (
                    <div key={s.in_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0 4px 12px', color: 'var(--text-dim)' }}>
                      <span style={{ minWidth: 56 }}>{shortDate(s.day)}</span>
                      <span style={{ flex: 1 }}>
                        {time(s.clock_in)} – {s.clock_out ? time(s.clock_out) : live ? 'on the clock' : <em style={{ color: 'var(--err-text)' }}>no clock-out</em>}
                        {s.off_site && <span title="Punched outside the daycare's radius"> · 📍 off site</span>}
                        {s.edited && <span title="Added or changed by the director or office"> · ✏️ fixed</span>}
                      </span>
                      <span style={{ minWidth: 44, textAlign: 'right' }}>{s.minutes != null ? `${hours(s.minutes)} h` : ''}</span>
                      <button className="bg" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setFix(s)}>Fix</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
        Overtime is hours over 40 in a Monday–Sunday week within these dates. Fixed punches keep the original time and the reason on record.
      </div>
      {fix && <FixShiftModal facilityId={facilityId} shift={fix} onClose={() => setFix(null)} onSaved={t => { setFix(null); setMsg({ ok: t }); load(); }}/>}
      {adding && <AddShiftModal facilityId={facilityId} staff={staff} onClose={() => setAdding(false)} onSaved={t => { setAdding(false); setMsg({ ok: t }); load(); }}/>}
    </div>
  );
}

function FixShiftModal({ facilityId, shift, onClose, onSaved }) {
  const [inAt,   setInAt]   = useState(toInput(shift.clock_in));
  const [outAt,  setOutAt]  = useState(toInput(shift.clock_out));
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState(null);
  const [sure,   setSure]   = useState(false);
  const rpc = (fn, args) => supabase.rpc(fn, args);

  async function run(steps, done) {
    setBusy(true); setError(null);
    for (const step of steps) {
      const { error: err } = await step();
      if (err) { setBusy(false); setError(errText(err)); return; }
    }
    onSaved(done);
  }
  function save(e) {
    e.preventDefault();
    if (reason.trim().length < 3) { setError('Add a short reason. It\'s kept with the punch.'); return; }
    const inD = new Date(inAt), outD = outAt ? new Date(outAt) : null;
    if (isNaN(inD) || (outD && isNaN(outD))) { setError('Check the times.'); return; }
    if (outD && outD <= inD) { setError('Clock-out has to be after clock-in.'); return; }
    if (outD && outD - inD > 24 * 3600000) { setError('That shift is over 24 hours. Check the dates.'); return; }
    const steps = [];
    if (inAt !== toInput(shift.clock_in)) steps.push(() => rpc('daycare_clock_edit', { p_id: shift.in_id, p_at: inD.toISOString(), p_reason: reason }));
    if (shift.out_id && outD && outAt !== toInput(shift.clock_out)) steps.push(() => rpc('daycare_clock_edit', { p_id: shift.out_id, p_at: outD.toISOString(), p_reason: reason }));
    if (shift.out_id && !outD) steps.push(() => rpc('daycare_clock_void', { p_id: shift.out_id, p_reason: reason }));
    if (!shift.out_id && outD) steps.push(() => rpc('daycare_clock_add', { p_facility: facilityId, p_staff: shift.staff_id, p_type: 'out', p_at: outD.toISOString(), p_reason: reason }));
    if (!steps.length) { setError('Nothing changed.'); return; }
    run(steps, `Fixed ${shift.staff_name}'s shift.`);
  }
  function remove() {
    if (reason.trim().length < 3) { setError('Add a short reason. It\'s kept with the punch.'); return; }
    const steps = [() => rpc('daycare_clock_void', { p_id: shift.in_id, p_reason: reason })];
    if (shift.out_id) steps.push(() => rpc('daycare_clock_void', { p_id: shift.out_id, p_reason: reason }));
    run(steps, `Removed the shift. It stays on record as voided.`);
  }
  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>Fix a shift</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{shift.staff_name} · {weekday(shift.day)}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Clock in</label>
        <input className="fi" type="datetime-local" value={inAt} onChange={e => setInAt(e.target.value)}/>
        <label className="fl">Clock out {!shift.out_id && <span style={{ fontWeight: 400 }}>(missing — add it here)</span>}</label>
        <input className="fi" type="datetime-local" value={outAt} onChange={e => setOutAt(e.target.value)}/>
        <label className="fl">Reason</label>
        <input className="fi" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="e.g. Forgot to clock out, left at 5:30"/>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
          {!sure ? <button type="button" className="bd" style={{ padding: '8px 14px' }} onClick={() => setSure(true)} disabled={busy}>Remove shift</button>
                 : <button type="button" className="bd" style={{ padding: '8px 14px' }} onClick={remove} disabled={busy}>Yes, remove it</button>}
        </div>
      </form>
    </Modal>
  );
}

function AddShiftModal({ facilityId, staff, onClose, onSaved }) {
  const [f, setF] = useState({ staff_id: '', day: localDate(), in_t: '08:00', out_t: '', reason: '' });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  async function save(e) {
    e.preventDefault();
    if (!f.staff_id) { setError('Choose who it\'s for.'); return; }
    if (f.reason.trim().length < 3) { setError('Add a short reason. It\'s kept with the punch.'); return; }
    const inD = new Date(`${f.day}T${f.in_t}`);
    let outD = f.out_t ? new Date(`${f.day}T${f.out_t}`) : null;
    if (outD && outD <= inD) outD = new Date(outD.getTime() + 86400000);   // overnight
    if (isNaN(inD) || (outD && isNaN(outD))) { setError('Check the times.'); return; }
    setBusy(true); setError(null);
    const args = { p_facility: facilityId, p_staff: f.staff_id, p_reason: f.reason };
    const { error: e1 } = await supabase.rpc('daycare_clock_add', { ...args, p_type: 'in', p_at: inD.toISOString() });
    if (e1) { setBusy(false); setError(errText(e1)); return; }
    if (outD) {
      const { error: e2 } = await supabase.rpc('daycare_clock_add', { ...args, p_type: 'out', p_at: outD.toISOString() });
      if (e2) { setBusy(false); setError(`Clock-in added, but the clock-out wasn't: ${errText(e2)}`); return; }
    }
    onSaved('Shift added.');
  }
  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>Add a missed shift</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Staff member</label>
        <select className="fi" value={f.staff_id} onChange={e => set('staff_id', e.target.value)}>
          <option value="">Choose…</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name || s.email} · {roleLabel(s.role)}{s.status === 'invited' ? ' (hasn\'t signed in yet)' : ''}</option>)}
        </select>
        <label className="fl">Date</label>
        <input className="fi" type="date" value={f.day} onChange={e => set('day', e.target.value)}/>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Clock in</label><input className="fi" type="time" value={f.in_t} onChange={e => set('in_t', e.target.value)}/></div>
          <div style={{ flex: 1 }}><label className="fl">Clock out <span style={{ fontWeight: 400 }}>(optional)</span></label><input className="fi" type="time" value={f.out_t} onChange={e => set('out_t', e.target.value)}/></div>
        </div>
        <label className="fl">Reason</label>
        <input className="fi" value={f.reason} onChange={e => set('reason', e.target.value)} maxLength={300} placeholder="e.g. Phone died, worked 8–4"/>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Add shift'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Settings (director and office): where the daycare is ─────────────────────
function ensureLeafletLoaded() {
  return new Promise((resolve) => {
    if (window.L) { resolve(window.L); return; }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => { if (window.L) { clearInterval(check); resolve(window.L); } }, 50);
    }
  });
}

function GeofenceMap({ lat, lng, radius, onPick }) {
  const el = useRef(null), map = useRef(null), marker = useRef(null), circle = useRef(null);
  const pick = useRef(onPick); pick.current = onPick;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureLeafletLoaded().then(L => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { center: lat != null ? [lat, lng] : [39.5, -98.35], zoom: lat != null ? 17 : 4 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
      m.on('click', e => pick.current(e.latlng.lat, e.latlng.lng));
      map.current = m; setReady(true);
    });
    return () => { cancelled = true; if (map.current) { map.current.remove(); map.current = null; marker.current = null; circle.current = null; } };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const L = window.L, m = map.current;
    if (!ready || !L || !m || lat == null) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        html: '<div style="width:24px;height:24px;border-radius:50%;background:#E8845C;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:grab"></div>' }) }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current.getLatLng(); pick.current(p.lat, p.lng); });
      circle.current = L.circle([lat, lng], { radius, color: '#E8845C', weight: 2, fillOpacity: 0.12 }).addTo(m);
      m.setView([lat, lng], Math.max(m.getZoom(), 17));
    } else {
      marker.current.setLatLng([lat, lng]); circle.current.setLatLng([lat, lng]);
      if (!m.getBounds().contains([lat, lng])) m.setView([lat, lng], 17);
    }
    circle.current.setRadius(radius);
  }, [ready, lat, lng, radius]);
  return <div ref={el} style={{ height: 300, borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative', zIndex: 0 }}/>;
}

function ClockSettings({ facility, facilityId, settings, onSaved }) {
  const [f, setF] = useState(() => ({ lat: settings?.lat ?? null, lng: settings?.lng ?? null,
    radius_ft: settings ? Math.round(ft(settings.radius_m) / 50) * 50 : 500, require: settings?.require_geofence ?? true }));
  const [busy,   setBusy]   = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [msg,    setMsg]    = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const radiusM = Math.round(f.radius_ft / 3.28084);

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg({ err: 'This device can\'t share its location.' }); return; }
    setLocBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      p => { setLocBusy(false); setF(x => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude }));
             setMsg({ ok: `Pinned your location (accurate to about ${ft(p.coords.accuracy)} ft). Drag the pin if it's off, then save.` }); },
      e => { setLocBusy(false); setMsg({ err: e.code === 1 ? 'Location is off for littleloop. Allow it in your browser, or tap the map instead.' : 'Couldn\'t get your location. Tap the map instead.' }); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  async function save() {
    if (f.lat == null) { setMsg({ err: 'Put the pin on the daycare first.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('daycare_timeclock_settings').upsert(
      { facility_id: facilityId, lat: f.lat, lng: f.lng, radius_m: radiusM, require_geofence: f.require, updated_at: new Date().toISOString() },
      { onConflict: 'facility_id' });
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: 'Saved. Staff clock-ins are now checked against this spot.' });
    onSaved();
  }
  return (
    <div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Where is {facility?.name || 'the daycare'}?</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 10px', lineHeight: 1.6 }}>
          Tap the map on the building or drag the pin. If you're at the daycare now, use your location. Staff can clock in or out inside the circle.
        </div>
        {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
        <GeofenceMap lat={f.lat} lng={f.lng} radius={radiusM} onPick={(lat, lng) => setF(x => ({ ...x, lat, lng }))}/>
        <button className="bg" style={{ padding: '7px 12px', fontSize: 12, marginBottom: 12 }} onClick={useMyLocation} disabled={locBusy}>{locBusy ? <Spinner/> : '📍 Use my location (I\'m at the daycare)'}</button>
        <label className="fl">How close staff need to be: {f.radius_ft.toLocaleString()} ft</label>
        <input type="range" min="100" max="2000" step="50" value={f.radius_ft} onChange={e => set('radius_ft', Number(e.target.value))} style={{ width: '100%', marginBottom: 4 }} aria-label="Radius in feet"/>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>500 ft covers most buildings and parking lots. Phones indoors can be off by 50–150 ft, which the clock allows for.</div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.require} onChange={e => set('require', e.target.checked)} style={{ marginTop: 3 }}/>
          <span><strong>Only allow clocking in and out at the daycare.</strong><br/>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>If this is off, staff can clock in anywhere and punches made away from the daycare are marked "off site" on the timesheet.</span></span>
        </label>
        <button className="bp" onClick={save} disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
      </div>
    </div>
  );
}
