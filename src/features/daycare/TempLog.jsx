import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { errText } from './api';
import { localDate, addDays } from './enrollment';
import { esc, printWindow } from './learning';

// Fridge and freezer temperature log (licensing inspectors ask for it). Readings are stamped
// with the time and who logged them; a reading over the limit needs a note on what was done.
const LIMIT = { fridge: 41, freezer: 0 };
const KIND = { fridge: { label: 'Fridge', icon: '🧊' }, freezer: { label: 'Freezer', icon: '❄️' } };
const time = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const monthStart = (iso = localDate()) => iso.slice(0, 8) + '01';

export default function TempLog({ facility, facilityId, userId, manager }) {
  const [units,   setUnits]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    const since = new Date(localDate() + 'T00:00:00'); since.setDate(since.getDate() - 7);
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from('daycare_temp_units').select('*').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('daycare_temp_logs').select('*').eq('facility_id', facilityId).gte('logged_at', since.toISOString()).order('logged_at', { ascending: false }),
    ]);
    setUnits(u || []); setLogs(l || []);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  async function remove(u) {
    setRemoving(null);
    const { error } = await supabase.from('daycare_temp_units').update({ active: false }).eq('id', u.id);
    if (error) { setMsg({ err: errText(error) }); return; }
    load();
  }

  async function printMonth() {
    const from = monthStart();
    const last = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0).getDate();   // last day of this month
    const to = from.slice(0, 8) + String(last).padStart(2, '0');
    const { data } = await supabase.from('daycare_temp_logs').select('*').eq('facility_id', facilityId)
      .gte('logged_at', new Date(from + 'T00:00:00').toISOString()).lt('logged_at', new Date(addDays(to, 1) + 'T00:00:00').toISOString()).order('logged_at');
    const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    const byKey = {};
    for (const l of data || []) (byKey[`${localDate(new Date(l.logged_at))}|${l.unit_id}`] ||= []).push(l);
    const cell = (d, u) => (byKey[`${d}|${u.id}`] || []).map(l =>
      `<div class="${l.out_of_range ? 'bad' : ''}">${esc(l.reading_f)}°F · ${esc(time(l.logged_at))} · ${esc(l.logged_by_name || '')}${l.action ? `<div class="act">${esc(l.action)}</div>` : ''}</div>`).join('') || '<span class="none">—</span>';
    const monthName = new Date(from + 'T12:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' });
    printWindow(`Temperature log ${monthName}`, `
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top;text-align:left}
      th{background:#f1f5f9}.bad{color:#b91c1c;font-weight:700}.act{font-weight:400;font-style:italic;color:#475569}.none{color:#94a3b8}`,
      `<h1>Fridge and freezer temperatures: ${esc(monthName)}</h1><div class="sub">${esc(facility?.name || '')} · Fridges at or below ${LIMIT.fridge}°F, freezers at or below ${LIMIT.freezer}°F unless noted</div>
       <table><tr><th style="width:90px">Date</th>${units.map(u => `<th>${esc(u.name)} (≤ ${esc(u.max_f)}°F)</th>`).join('')}</tr>
       ${days.map(d => `<tr><td>${esc(new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</td>${units.map(u => `<td>${cell(d, u)}</td>`).join('')}</tr>`).join('')}</table>`);
  }

  if (!units) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;
  return (
    <div>
      {msg && <div className={`al ${msg.ok ? 'al-s' : 'al-e'}`}>{msg.ok || msg.err}</div>}
      {units.length === 0 && !adding && (
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Add your fridges and freezers</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>Then log a temperature at least once a day. Fridges should stay at or below {LIMIT.fridge}°F, freezers at or below {LIMIT.freezer}°F.</div>
          <button className="bp" onClick={() => setAdding(true)}>+ Add a fridge or freezer</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {units.map(u => <UnitCard key={u.id} unit={u} logs={logs.filter(l => l.unit_id === u.id)} userId={userId} manager={manager} onSaved={load} onRemove={() => setRemoving(u)}/>)}
      </div>
      {adding && <AddUnit facilityId={facilityId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }}/>}
      {units.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!adding && <button className="bg" style={{ fontSize: 12 }} onClick={() => setAdding(true)}>+ Add a fridge or freezer</button>}
          <button className="bg" style={{ fontSize: 12 }} onClick={printMonth}>🖨 Print this month's log</button>
        </div>
      )}
      <Confirm open={!!removing} title={`Remove ${removing?.name}?`} message="It's taken off the list. Its past readings stay in the printed log." danger
        onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)}/>
    </div>
  );
}

function UnitCard({ unit, logs, userId, manager, onSaved, onRemove }) {
  const [reading, setReading] = useState('');
  const [action,  setAction]  = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState(null);
  const today = localDate();
  const todays = logs.filter(l => localDate(new Date(l.logged_at)) === today);
  const last = logs[0];
  const n = Number(reading);
  const high = reading.trim() !== '' && !Number.isNaN(n) && n > Number(unit.max_f);

  async function save(e) {
    e.preventDefault();
    if (!/^-?\d{1,3}(\.\d)?$/.test(reading.trim())) { setErr('Enter the temperature in °F, like 38 or 37.5.'); return; }
    if (high && action.trim().length < 3) { setErr('That\'s over the limit. Write what you did about it.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from('daycare_temp_logs').insert({ unit_id: unit.id, facility_id: unit.facility_id, reading_f: n, action: action.trim() || null });
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    setReading(''); setAction('');
    onSaved();
  }
  async function del(l) {
    const { error } = await supabase.from('daycare_temp_logs').delete().eq('id', l.id);
    if (error) { setErr(errText(error)); return; }
    onSaved();
  }
  const canDelete = l => manager || (l.logged_by === userId && Date.now() - new Date(l.logged_at).getTime() < 3600 * 1000);

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>{KIND[unit.kind].icon}</span>
        <span style={{ flex: 1, minWidth: 140 }}>
          <strong style={{ fontSize: 14 }}>{unit.name}</strong>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>
            {KIND[unit.kind].label} · keep at or below {Number(unit.max_f)}°F
            {last ? ` · last ${Number(last.reading_f)}°F ${localDate(new Date(last.logged_at)) === today ? 'today' : new Date(last.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time(last.logged_at)}` : ' · no readings yet'}
          </span>
        </span>
        {todays.length === 0 ? <span className="sb sb-p">Not checked today</span> : <span className="sb sb-a">✓ Checked today</span>}
        {manager && <button className="bg" style={{ padding: '3px 8px', fontSize: 11 }} onClick={onRemove}>Remove</button>}
      </div>
      {todays.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {todays.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '2px 0', color: l.out_of_range ? 'var(--err-text, #d05050)' : 'var(--text-dim)' }}>
              <span style={{ fontWeight: 800, minWidth: 54 }}>{Number(l.reading_f)}°F</span>
              <span style={{ flex: 1 }}>{time(l.logged_at)} · {l.logged_by_name}{l.out_of_range ? ' · over the limit' : ''}{l.action ? ` · ${l.action}` : ''}</span>
              {canDelete(l) && <button className="bg" style={{ padding: '1px 7px', fontSize: 10 }} onClick={() => del(l)} aria-label="Delete this reading">✕</button>}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={save} style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="fi" inputMode="decimal" value={reading} onChange={e => setReading(e.target.value)} placeholder="°F" aria-label={`Temperature for ${unit.name}`}
            style={{ marginBottom: 0, width: 90 }}/>
          <button type="submit" className="bp" style={{ padding: '7px 14px', fontSize: 12 }} disabled={busy || !reading.trim()}>{busy ? <Spinner size={10}/> : 'Log'}</button>
          {high && <span style={{ fontSize: 12, color: 'var(--err-text, #d05050)', fontWeight: 700 }}>Over {Number(unit.max_f)}°F</span>}
        </div>
        {high && (
          <input className="fi" value={action} onChange={e => setAction(e.target.value)} maxLength={300} style={{ marginTop: 6, marginBottom: 0 }}
            placeholder="What did you do? e.g. checked again in 30 min, moved food to the other fridge, called for repair"/>
        )}
        {err && <div style={{ fontSize: 12, color: 'var(--err-text, #d05050)', marginTop: 4 }}>{err}</div>}
      </form>
    </div>
  );
}

function AddUnit({ facilityId, onClose, onSaved }) {
  const [name,  setName]  = useState('');
  const [kind,  setKind]  = useState('fridge');
  const [max,   setMax]   = useState(String(LIMIT.fridge));
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);
  async function save(e) {
    e.preventDefault();
    if (!name.trim()) { setErr('Give it a name, like "Kitchen fridge".'); return; }
    if (!/^-?\d{1,2}(\.\d)?$/.test(max.trim())) { setErr('The limit should be a temperature like 41.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from('daycare_temp_units').insert({ facility_id: facilityId, name: name.trim(), kind, max_f: Number(max) });
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    onSaved();
  }
  return (
    <form onSubmit={save} className="card" style={{ padding: '12px 14px', marginTop: 8 }}>
      {err && <div className="al al-e">{err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 150 }}>
          <label className="fl">Name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="e.g. Kitchen fridge" style={{ marginBottom: 0 }} autoFocus/>
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <label className="fl">Type</label>
          <select className="fi" value={kind} onChange={e => { setKind(e.target.value); setMax(String(LIMIT[e.target.value])); }} style={{ marginBottom: 0 }}>
            <option value="fridge">Fridge</option><option value="freezer">Freezer</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <label className="fl">Limit °F</label>
          <input className="fi" inputMode="decimal" value={max} onChange={e => setMax(e.target.value)} style={{ marginBottom: 0 }}/>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" className="bp" disabled={busy}>{busy ? <Spinner/> : 'Add'}</button>
        <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
