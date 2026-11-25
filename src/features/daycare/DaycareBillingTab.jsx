import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { money, METHODS, CHARGE_TYPES, longDate, shortDate, periodText, shiftPeriod, entryLabel, signed,
         sendStatements, sendReminder, printStatement, printTaxStatement } from './billing';
import { localDate } from './enrollment';
import { errText } from './api';

const VIEWS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'run',      label: 'Run billing' },
  { id: 'tuition',  label: 'Tuition' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'yearend',  label: 'Year-end' },
  { id: 'settings', label: 'Settings' },
];
const childName = c => c ? (c.preferred_name || c.name) : '';
const defaultNext = cycle => {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  if (cycle === 'monthly') return localDate(new Date(t.getFullYear(), t.getMonth() + 1, 1, 12));
  const dow = (t.getDay() + 6) % 7;            // Monday = 0
  t.setDate(t.getDate() - dow + 7);
  return localDate(t);
};

// Billing (director and office): family accounts, statements, tuition, agencies, year-end.
export default function DaycareBillingTab({ facility, facilityId }) {
  const [view, setView] = useState('accounts');
  const [settings, setSettings] = useState(null);
  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('daycare_billing_settings').select('*').eq('facility_id', facilityId).maybeSingle();
    setSettings(data || { facility_id: facilityId, cycle: 'weekly', bill_days_before: 3, due_days: 3, sibling_discount_pct: 0, auto_send: false, _new: true });
  }, [facilityId]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  if (!settings) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  const props = { facility, facilityId, settings, reloadSettings: loadSettings, goTo: setView };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Billing</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <button key={v.id} className="chip" onClick={() => setView(v.id)}
              style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: view === v.id ? 'var(--accent)' : undefined, color: view === v.id ? '#fff' : undefined }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {settings._new && view !== 'settings' && (
        <div className="al al-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span>Start with Settings: weekly or monthly, due days and how families pay.</span>
          <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setView('settings')}>Open settings</button>
        </div>
      )}
      {view === 'accounts' && <Accounts {...props}/>}
      {view === 'run'      && <RunBilling {...props}/>}
      {view === 'tuition'  && <Tuition {...props}/>}
      {view === 'agencies' && <Agencies {...props}/>}
      {view === 'yearend'  && <YearEnd {...props}/>}
      {view === 'settings' && <Settings {...props}/>}
    </div>
  );
}

// ── Accounts ─────────────────────────────────────────────────────────────────
function Accounts({ facility, facilityId }) {
  const [rows,   setRows]   = useState(null);
  const [entry,  setEntry]  = useState(null);    // { familyId?, kind }
  const [ledger, setLedger] = useState(null);    // family row
  const [busy,   setBusy]   = useState(null);
  const [msg,    setMsg]    = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('daycare_accounts', { p_facility: facilityId });
    if (error) setMsg({ err: errText(error) });
    setRows(data || []);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  async function remind(r) {
    setBusy(r.family_id); setMsg(null);
    const res = await sendReminder(facilityId, r.family_id);
    setBusy(null);
    setMsg(res.error ? { err: res.error } : { ok: `Reminder sent to ${r.family_name}${res.emailed ? ` (${res.emailed} email${res.emailed === 1 ? '' : 's'})` : ''}.` });
  }

  if (!rows) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;
  const owed = rows.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0);
  const pastDue = rows.reduce((s, r) => s + Number(r.past_due), 0);
  const lateFamilies = rows.filter(r => Number(r.past_due) > 0).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[['Owed to you', money(owed)], ['Past due', money(pastDue)], ['Families past due', lateFamilies]].map(([k, v]) => (
          <div key={k} className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-faint)' }}>{k}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="bp" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEntry({ kind: 'payment' })} disabled={!rows.length}>+ Record a payment</button>
        <button className="bg" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEntry({ kind: 'charge' })} disabled={!rows.length}>+ Charge or credit</button>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {rows.length === 0 && <div className="es"><div className="ic">💵</div><h3>No families yet</h3><p>Families connected to {facility?.name} show up here.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => {
          const late = Number(r.past_due) > 0;
          return (
            <div key={r.family_id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.family_name}{!r.connected && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}> · no longer connected</span>}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {r.last_payment_date ? `Last paid ${money(r.last_payment_amount)} on ${shortDate(r.last_payment_date)}` : 'No payments yet'}
                  {late && r.oldest_unpaid ? ` · unpaid since ${shortDate(r.oldest_unpaid)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 90 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: late ? 'var(--err-text)' : Number(r.balance) < 0 ? 'var(--ok-text)' : 'var(--text)' }}>{money(r.balance)}</div>
                <div style={{ fontSize: 11, color: late ? 'var(--err-text)' : 'var(--text-faint)', fontWeight: late ? 700 : 400 }}>
                  {late ? `${money(r.past_due)} past due` : Number(r.balance) < 0 ? 'credit' : Number(r.balance) > 0 ? 'not due yet' : 'paid up'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEntry({ kind: 'payment', familyId: r.family_id })}>+ Payment</button>
                <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setLedger(r)}>Ledger</button>
                {Number(r.balance) > 0 && (
                  <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => remind(r)} disabled={busy === r.family_id}>{busy === r.family_id ? <Spinner/> : 'Remind'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {entry && <EntryModal facilityId={facilityId} families={rows} preset={entry}
        onClose={() => setEntry(null)} onSaved={t => { setEntry(null); setMsg({ ok: t }); load(); }}/>}
      {ledger && <LedgerModal facilityId={facilityId} family={ledger} onClose={() => { setLedger(null); load(); }}/>}
    </div>
  );
}

function EntryModal({ facilityId, families, preset, agencies = [], onClose, onSaved }) {
  const [f, setF] = useState({ kind: preset.kind, familyId: preset.familyId || '', childId: '', amount: '', date: localDate(),
    method: 'check', reference: '', category: 'other', description: '', fromAgency: !!preset.agency, agency: preset.agency || '' });
  const [kids,  setKids]  = useState([]);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  useEffect(() => {
    if (!f.familyId) { setKids([]); return; }
    supabase.from('children').select('id, name, preferred_name').eq('family_id', f.familyId).order('name').then(({ data }) => setKids(data || []));
  }, [f.familyId]);

  async function save(e) {
    e.preventDefault();
    const amount = Math.round(parseFloat(f.amount) * 100) / 100;
    if (!f.familyId) { setError('Choose the family.'); return; }
    if (!(amount > 0)) { setError('Enter an amount.'); return; }
    if (f.kind === 'charge' && !f.description.trim() && f.category === 'other') { setError('Say what the charge is for.'); return; }
    if (f.fromAgency && !f.agency.trim()) { setError('Name the agency.'); return; }
    const row = { facility_id: facilityId, family_id: f.familyId, child_id: f.childId || null, kind: f.kind, amount, entry_date: f.date,
      payer: f.fromAgency ? 'agency' : 'family', agency: f.fromAgency ? f.agency.trim() : null,
      category: f.kind === 'charge' ? f.category : f.kind, description: f.description.trim() || null,
      method: f.kind === 'payment' ? f.method : null, reference: f.kind === 'payment' ? (f.reference.trim() || null) : null };
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('daycare_ledger').insert(row);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    const fam = families.find(x => x.family_id === f.familyId)?.family_name || 'the family';
    onSaved(`${f.kind === 'payment' ? 'Payment' : f.kind === 'credit' ? 'Credit' : 'Charge'} of ${money(amount)} recorded for ${fam}${f.fromAgency ? ` (${f.agency.trim()})` : ''}.`);
  }

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>
        {f.kind === 'payment' ? 'Record a payment' : f.kind === 'credit' ? 'Add a credit' : 'Add a charge'}
      </div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        {preset.kind !== 'payment' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['charge', 'Charge'], ['credit', 'Credit']].map(([k, l]) => (
              <button key={k} type="button" className="chip" onClick={() => set('kind', k)}
                style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: f.kind === k ? 'var(--accent)' : undefined, color: f.kind === k ? '#fff' : undefined }}>{l}</button>
            ))}
          </div>
        )}
        <label className="fl">Family</label>
        <select className="fi" value={f.familyId} onChange={e => set('familyId', e.target.value)} disabled={!!preset.familyId && !preset.agency}>
          <option value="">Choose…</option>
          {families.map(x => <option key={x.family_id} value={x.family_id}>{x.family_name}</option>)}
        </select>
        {kids.length > 0 && (
          <>
            <label className="fl">Child <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <select className="fi" value={f.childId} onChange={e => set('childId', e.target.value)}>
              <option value="">The whole family</option>
              {kids.map(k => <option key={k.id} value={k.id}>{childName(k)}</option>)}
            </select>
          </>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Amount</label>
            <input className="fi" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00"/></div>
          <div style={{ flex: 1 }}><label className="fl">Date</label>
            <input className="fi" type="date" value={f.date} onChange={e => set('date', e.target.value)}/></div>
        </div>
        {f.kind === 'payment' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="fl">Paid by</label>
              <select className="fi" value={f.method} onChange={e => set('method', e.target.value)}>
                {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select></div>
            <div style={{ flex: 1 }}><label className="fl">Check # or reference</label>
              <input className="fi" value={f.reference} onChange={e => set('reference', e.target.value)} maxLength={60}/></div>
          </div>
        )}
        {f.kind === 'charge' && (
          <>
            <label className="fl">Type</label>
            <select className="fi" value={f.category} onChange={e => set('category', e.target.value)}>
              {CHARGE_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </>
        )}
        <label className="fl">Description <span style={{ fontWeight: 400 }}>{f.kind === 'charge' && f.category === 'other' ? '' : '(optional)'}</span></label>
        <input className="fi" value={f.description} onChange={e => set('description', e.target.value)} maxLength={200}
          placeholder={f.kind === 'credit' ? 'e.g. Closed for snow day' : f.kind === 'charge' ? 'e.g. Picked up at 6:20' : 'Note (optional)'}/>
        {(f.kind === 'payment' || f.fromAgency) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, margin: '2px 0 10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.fromAgency} onChange={e => set('fromAgency', e.target.checked)}/> Paid by a subsidy agency, not the family
          </label>
        )}
        {f.fromAgency && (
          <>
            <label className="fl">Agency</label>
            <input className="fi" value={f.agency} onChange={e => set('agency', e.target.value)} maxLength={120} list="agency-names" placeholder="e.g. State childcare assistance"/>
            <datalist id="agency-names">{agencies.map(a => <option key={a} value={a}/>)}</datalist>
          </>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function LedgerModal({ facilityId, family, onClose }) {
  const [data,  setData]  = useState(null);
  const [voidId, setVoidId] = useState(null);
  const [reason, setReason] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    const [{ data: entries }, { data: sts }] = await Promise.all([
      supabase.from('daycare_ledger').select('*').eq('facility_id', facilityId).eq('family_id', family.family_id)
        .order('entry_date').order('created_at'),
      supabase.from('daycare_statements').select('*').eq('facility_id', facilityId).eq('family_id', family.family_id).order('number', { ascending: false }),
    ]);
    setData({ entries: entries || [], statements: sts || [] });
  }, [facilityId, family.family_id]);
  useEffect(() => { load(); }, [load]);

  async function doVoid(id) {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('daycare_void_entry', { p_id: id, p_reason: reason });
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    setVoidId(null); setReason(''); load();
  }
  async function print(st) {
    const [{ data: lines }, { data: info }] = await Promise.all([
      supabase.from('daycare_ledger').select('*').eq('statement_id', st.id).order('entry_date'),
      supabase.rpc('daycare_billing_info', { p_facility: facilityId }),
    ]);
    printStatement(st, lines, info, family.family_name);
  }

  let run = 0;
  const fam = data?.entries.filter(e => e.payer === 'family') || [];
  const agency = data?.entries.filter(e => e.payer === 'agency') || [];
  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>{family.family_name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>Balance {money(family.balance)}. Entries are never deleted: void one and add the corrected entry.</div>
      {error && <div className="al al-e">{error}</div>}
      {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ maxHeight: '58vh', overflowY: 'auto' }}>
          {fam.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Nothing yet.</div>}
          {fam.map(e => {
            if (!e.voided_at) run += signed(e);
            return (
              <div key={e.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', opacity: e.voided_at ? .55 : 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 52 }}>{shortDate(e.entry_date)}</span>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: e.voided_at ? 'line-through' : 'none' }}>
                    {entryLabel(e)}{e.period_start ? <span style={{ fontSize: 11, color: 'var(--text-faint)' }}> · {periodText(e.period_start, e.period_end)}</span> : null}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: e.kind === 'charge' ? 'var(--text)' : 'var(--ok-text)' }}>{e.kind === 'charge' ? '' : '−'}{money(e.amount)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 64, textAlign: 'right' }}>{e.voided_at ? 'voided' : money(run)}</span>
                </div>
                {e.voided_at && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 60 }}>Voided {shortDate(e.voided_at.slice(0, 10))}{e.voided_by_name ? ` by ${e.voided_by_name}` : ''}: {e.void_reason}</div>}
                {!e.voided_at && voidId !== e.id && (
                  <button onClick={() => { setVoidId(e.id); setReason(''); }} style={{ marginLeft: 60, background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer', textDecoration: 'underline' }}>Void</button>
                )}
                {voidId === e.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, marginLeft: 60 }}>
                    <input className="fi" value={reason} onChange={x => setReason(x.target.value)} maxLength={300} placeholder="Why? e.g. check bounced" style={{ marginBottom: 0, padding: '5px 8px', fontSize: 12 }}/>
                    <button className="bd" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => doVoid(e.id)} disabled={busy || reason.trim().length < 3}>Void</button>
                    <button className="bg" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setVoidId(null)}>Keep</button>
                  </div>
                )}
              </div>
            );
          })}
          {agency.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 4px' }}>Subsidy (billed to the agency, not on the family's statement)</div>
              {agency.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)', opacity: e.voided_at ? .55 : 1 }}>
                  <span style={{ minWidth: 52, color: 'var(--text-faint)' }}>{shortDate(e.entry_date)}</span>
                  <span style={{ flex: 1, textDecoration: e.voided_at ? 'line-through' : 'none' }}>{e.agency}: {entryLabel(e)}</span>
                  <span>{e.kind === 'charge' ? '' : '−'}{money(e.amount)}</span>
                </div>
              ))}
            </>
          )}
          {data.statements.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 4px' }}>Statements</div>
              {data.statements.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ flex: 1 }}>#{s.number} · {longDate(s.statement_date)}{s.period_start ? ` · ${periodText(s.period_start, s.period_end)}` : ''}</span>
                  <span style={{ fontWeight: 700 }}>{money(s.balance_due)}</span>
                  <button className="bg" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => print(s)}>🖨</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      <button className="bg full" style={{ marginTop: 10 }} onClick={onClose} disabled={busy}>Close</button>
    </Modal>
  );
}

// ── Run billing ──────────────────────────────────────────────────────────────
function RunBilling({ facilityId, settings, reloadSettings, goTo }) {
  const [period,  setPeriod]  = useState(() => settings.next_period_start || defaultNext(settings.cycle));
  const [preview, setPreview] = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);
  const load = useCallback(async () => {
    setPreview(null);
    const { data, error } = await supabase.rpc('daycare_billing_run', { p_facility: facilityId, p_period_start: period, p_commit: false });
    if (error) { setMsg({ err: errText(error) }); setPreview({ families: [] }); return; }
    setPreview(data);
  }, [facilityId, period]);
  useEffect(() => { setMsg(null); load(); }, [load]);

  async function create() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('daycare_billing_run', { p_facility: facilityId, p_period_start: period, p_commit: true });
    if (error) { setBusy(false); setMsg({ err: errText(error) }); return; }
    const ids = data?.created || [];
    const sent = ids.length ? await sendStatements(ids) : { sent: [] };
    setBusy(false);
    const emailed = (sent.sent || []).reduce((s, r) => s + (r.emailed || 0), 0);
    setMsg(sent.error ? { warn: `${ids.length} statement${ids.length === 1 ? '' : 's'} made. ${sent.error}` }
      : { ok: `${ids.length} statement${ids.length === 1 ? '' : 's'} made and sent (${emailed} email${emailed === 1 ? '' : 's'}; parents with the app also get a notification).` });
    reloadSettings(); load();
  }

  const fams = preview?.families || [];
  const toMake = fams.filter(f => !f.has_statement);
  const total = toMake.reduce((s, f) => s + Number(f.tuition) + Number(f.other_charges), 0);
  const noPlans = preview && fams.every(f => f.children.length === 0);
  return (
    <div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-faint)' }}>{settings.cycle === 'monthly' ? 'Month' : 'Week'} to bill</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{preview?.period_end ? periodText(period, preview.period_end) : longDate(period)}</div>
        </div>
        <button className="bg" style={{ padding: '6px 11px' }} onClick={() => setPeriod(p => shiftPeriod(p, settings.cycle, -1))} disabled={busy} aria-label="Earlier period">‹</button>
        <button className="bg" style={{ padding: '6px 11px' }} onClick={() => setPeriod(p => shiftPeriod(p, settings.cycle, 1))} disabled={busy} aria-label="Later period">›</button>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : msg.warn ? 'al-w' : 'al-s'}`}>{msg.err || msg.warn || msg.ok}</div>}
      {!preview ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div> : (
        <>
          {noPlans && (
            <div className="al al-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>No child has tuition set yet, so only extra charges and payments would be billed.</span>
              <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => goTo('tuition')}>Set tuition</button>
            </div>
          )}
          {fams.length === 0 && <div className="al al-s">Nothing to bill for this period.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fams.map(f => (
              <div key={f.family_id} className="card" style={{ padding: '10px 14px', opacity: f.has_statement ? .6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{f.family_name}</span>
                  {f.has_statement ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ok-text)' }}>✓ Billed</span>
                    : <span style={{ fontSize: 15, fontWeight: 800 }}>{money(f.balance_due)} due</span>}
                </div>
                {f.children.map(c => (
                  <div key={c.child_id} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-dim)', padding: '2px 0' }}>
                    <span style={{ flex: 1 }}>{c.name}{c.sibling ? ' · sibling discount' : ''}{Number(c.agency) > 0 ? ` · ${c.agency_name} pays ${money(c.agency)}` : ''}{c.already_billed ? ' · already billed' : ''}</span>
                    <span>{Number(c.after_discounts) !== Number(c.tuition) && <s style={{ color: 'var(--text-faint)', marginRight: 6 }}>{money(c.tuition)}</s>}{money(c.family)}</span>
                  </div>
                ))}
                {(Number(f.other_charges) > 0 || Number(f.payments_credits) > 0 || Number(f.previous_balance) !== 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {[Number(f.previous_balance) !== 0 && `Previous balance ${money(f.previous_balance)}`, Number(f.other_charges) > 0 && `other charges ${money(f.other_charges)}`,
                      Number(f.payments_credits) > 0 && `payments/credits −${money(f.payments_credits)}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          {toMake.length > 0 && (
            <button className="bp full" style={{ marginTop: 12 }} onClick={create} disabled={busy}>
              {busy ? <Spinner/> : `Make ${toMake.length} statement${toMake.length === 1 ? '' : 's'} (${money(total)} new charges) and send`}
            </button>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            Each family gets one statement per {settings.cycle === 'monthly' ? 'month' : 'week'}: new tuition plus any charges, payments and credits since their last statement. Running it again never bills a child twice.
            {settings.auto_send ? ` Automatic billing is on: statements go out ${settings.bill_days_before} day${settings.bill_days_before === 1 ? '' : 's'} before each period.` : ''}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tuition ──────────────────────────────────────────────────────────────────
function Tuition({ facilityId, settings }) {
  const [rooms, setRooms] = useState(null);
  const [kids,  setKids]  = useState([]);
  const [plans, setPlans] = useState({});
  const [rates, setRates] = useState({});
  const [msg,   setMsg]   = useState(null);
  const load = useCallback(async () => {
    const [{ data: rm }, { data: en }, { data: pl }, { data: rt }] = await Promise.all([
      supabase.from('classrooms').select('id, name').eq('facility_id', facilityId).eq('active', true).order('sort').order('name'),
      supabase.from('facility_enrollments').select('child_id, classroom_id').eq('facility_id', facilityId).eq('status', 'active'),
      supabase.from('daycare_tuition_plans').select('*').eq('facility_id', facilityId),
      supabase.from('daycare_tuition_rates').select('*').eq('facility_id', facilityId),
    ]);
    const ids = (en || []).map(e => e.child_id);
    const { data: ch } = ids.length ? await supabase.from('children').select('id, name, preferred_name, family_id, families(name)').in('id', ids).order('name') : { data: [] };
    const roomOf = Object.fromEntries((en || []).map(e => [e.child_id, e.classroom_id]));
    setRooms(rm || []);
    setKids((ch || []).map(c => ({ ...c, classroom_id: roomOf[c.id] })));
    setPlans(Object.fromEntries((pl || []).map(p => [p.child_id, p])));
    setRates(Object.fromEntries((rt || []).map(r => [r.classroom_id, r.amount])));
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  async function saveRate(roomId, value) {
    const amount = Math.round(parseFloat(value) * 100) / 100;
    if (value === '' || !(amount >= 0)) return;
    const { error } = await supabase.from('daycare_tuition_rates').upsert({ classroom_id: roomId, facility_id: facilityId, amount });
    if (error) setMsg({ err: errText(error) }); else { setRates(r => ({ ...r, [roomId]: amount })); setMsg({ ok: 'Room rate saved. It fills in for children you set up next.' }); }
  }

  if (!rooms) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;
  const per = settings.cycle === 'monthly' ? 'month' : 'week';
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
        Amounts are per {per} (you bill {settings.cycle}). The sibling discount ({Number(settings.sibling_discount_pct) || 0}%, in Settings) applies to every child after the highest-tuition one in a family.
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {rooms.map(r => {
        const list = kids.filter(k => k.classroom_id === r.id);
        return (
          <div key={r.id} className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Room rate per {per}</span>
              <input className="fi" type="number" min="0" step="0.01" defaultValue={rates[r.id] ?? ''} placeholder="0.00" aria-label={`${r.name} rate`}
                onBlur={e => e.target.value !== String(rates[r.id] ?? '') && saveRate(r.id, e.target.value)} style={{ width: 100, marginBottom: 0, padding: '5px 8px' }}/>
            </div>
            {list.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No children enrolled.</div>}
            {list.map(k => <PlanRow key={k.id} facilityId={facilityId} child={k} plan={plans[k.id]} roomRate={rates[r.id]}
              onSaved={p => setPlans(x => ({ ...x, [k.id]: p }))} onError={t => setMsg({ err: t })}/>)}
          </div>
        );
      })}
    </div>
  );
}

function PlanRow({ facilityId, child, plan, roomRate, onSaved, onError }) {
  const init = () => ({ amount: plan?.amount ?? '', discount_pct: plan?.discount_pct ?? 0, sibling_discount: plan?.sibling_discount ?? true,
    subsidy_amount: plan?.subsidy_amount ?? 0, subsidy_agency: plan?.subsidy_agency || '', active: plan?.active ?? true });
  const [f, setF] = useState(init);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(init()); }, [plan]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Compare as numbers: the database sends "280.00" for a typed "280"
  const norm = x => [x.amount === '' ? '' : Number(x.amount), Number(x.discount_pct) || 0, !!x.sibling_discount,
                     Number(x.subsidy_amount) || 0, (x.subsidy_agency || '').trim(), !!x.active].join('|');
  const dirty = norm(f) !== norm(init());
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    const amount = Math.round(parseFloat(f.amount) * 100) / 100;
    if (!(amount >= 0)) { onError(`Enter ${childName(child)}'s tuition.`); return; }
    const subsidy = Math.round((parseFloat(f.subsidy_amount) || 0) * 100) / 100;
    if (subsidy > 0 && !f.subsidy_agency.trim()) { onError('Name the agency that pays the subsidy.'); return; }
    setBusy(true);
    const { data, error } = await supabase.from('daycare_tuition_plans').upsert({
      facility_id: facilityId, child_id: child.id, amount, discount_pct: Number(f.discount_pct) || 0, sibling_discount: f.sibling_discount,
      subsidy_amount: subsidy, subsidy_agency: f.subsidy_agency.trim() || null, active: f.active,
    }, { onConflict: 'facility_id,child_id' }).select().single();
    setBusy(false);
    if (error) { onError(errText(error)); return; }
    onSaved(data);
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 140, fontSize: 13 }}>
          <strong>{childName(child)}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{child.families?.name}</span>
          {plan && !plan.active && <span style={{ fontSize: 11, color: 'var(--warn-text)' }}> · paused</span>}
          {Number(plan?.subsidy_amount) > 0 && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}> · {plan.subsidy_agency} pays {money(plan.subsidy_amount)}</span>}
        </span>
        {!plan && f.amount === '' && roomRate != null && (
          <button className="bg" style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => set('amount', String(roomRate))}>Use room rate</button>
        )}
        <input className="fi" type="number" min="0" step="0.01" value={f.amount} onChange={e => set('amount', e.target.value)} placeholder="Tuition"
          aria-label={`${childName(child)} tuition`} style={{ width: 100, marginBottom: 0, padding: '5px 8px' }}/>
        <button className="bg" style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => setOpen(o => !o)}>{open ? 'Less' : 'More'}</button>
        {dirty && <button className="bp" style={{ padding: '5px 12px', fontSize: 12 }} onClick={save} disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: 12 }}>
          <label>Discount % <input className="fi" type="number" min="0" max="100" step="0.5" value={f.discount_pct} onChange={e => set('discount_pct', e.target.value)} style={{ width: 70, marginBottom: 0, padding: '4px 6px', display: 'inline-block' }}/></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={f.sibling_discount} onChange={e => set('sibling_discount', e.target.checked)}/> Sibling discount</label>
          <label>Subsidy $ <input className="fi" type="number" min="0" step="0.01" value={f.subsidy_amount} onChange={e => set('subsidy_amount', e.target.value)} style={{ width: 80, marginBottom: 0, padding: '4px 6px', display: 'inline-block' }}/></label>
          <input className="fi" value={f.subsidy_agency} onChange={e => set('subsidy_agency', e.target.value)} maxLength={120} placeholder="Agency that pays it" style={{ flex: 1, minWidth: 140, marginBottom: 0, padding: '4px 6px' }}/>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Bill this child</label>
        </div>
      )}
    </div>
  );
}

// ── Agencies ─────────────────────────────────────────────────────────────────
function Agencies({ facilityId }) {
  const [rows, setRows] = useState(null);
  const [fams, setFams] = useState([]);
  const [pay,  setPay]  = useState(null);
  const [msg,  setMsg]  = useState(null);
  const load = useCallback(async () => {
    const [{ data, error }, { data: acc }] = await Promise.all([
      supabase.rpc('daycare_agency_balances', { p_facility: facilityId }),
      supabase.rpc('daycare_accounts', { p_facility: facilityId }),
    ]);
    if (error) setMsg({ err: errText(error) });
    setRows(data || []); setFams(acc || []);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
        When an agency pays part of a child's tuition (set under Tuition), that part is billed here instead of to the family. Bill the agency the way it asks, then record its payments.
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {rows.length === 0 && <div className="es"><div className="ic">🏛️</div><h3>No agency billing yet</h3><p>Add a subsidy to a child under Tuition and it shows up here after the next billing run.</p></div>}
      {rows.map(a => (
        <div key={a.agency} className="card" style={{ padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{a.agency}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Billed {money(a.charged)} · paid {money(a.paid)}{a.last_payment ? ` · last paid ${shortDate(a.last_payment)}` : ''}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{money(a.balance)}</div>
          <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setPay(a.agency)}>+ Payment</button>
        </div>
      ))}
      {pay && <EntryModal facilityId={facilityId} families={fams} agencies={rows.map(r => r.agency)} preset={{ kind: 'payment', agency: pay }}
        onClose={() => setPay(null)} onSaved={t => { setPay(null); setMsg({ ok: t }); load(); }}/>}
    </div>
  );
}

// ── Year-end ─────────────────────────────────────────────────────────────────
function YearEnd({ facilityId, settings, goTo }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(new Date().getMonth() < 2 ? thisYear - 1 : thisYear);
  const [rows, setRows] = useState(null);
  const [msg,  setMsg]  = useState(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc('daycare_tax_summary', { p_facility: facilityId, p_year: year }).then(({ data, error }) => {
      if (error) setMsg({ err: errText(error) });
      setRows(data || []);
    });
  }, [facilityId, year]);
  async function print(familyId) {
    const { data, error } = await supabase.rpc('daycare_tax_statement', { p_facility: facilityId, p_family: familyId, p_year: year });
    if (error) { setMsg({ err: errText(error) }); return; }
    printTaxStatement(data);
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select className="fi" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto', marginBottom: 0, padding: '7px 10px' }} aria-label="Year">
          {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>What each family paid, for their taxes or dependent care FSA. Parents can print their own from the app too.</span>
      </div>
      {!settings.tax_id && (
        <div className="al al-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span>Add your tax ID (EIN) in Settings. Families need it to claim childcare on their taxes.</span>
          <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => goTo('settings')}>Settings</button>
        </div>
      )}
      {msg && <div className="al al-e">{msg.err}</div>}
      {!rows ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : rows.length === 0 ? <div className="al al-s">No family payments recorded in {year}.</div>
        : rows.map(r => (
          <div key={r.family_id} className="card" style={{ padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{r.family_name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{r.payments} payment{r.payments === 1 ? '' : 's'}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{money(r.total_paid)}</span>
            <button className="bg" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => print(r.family_id)}>🖨 Print</button>
          </div>
        ))}
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function Settings({ facilityId, settings, reloadSettings }) {
  const [f, setF] = useState(() => ({
    cycle: settings.cycle, bill_days_before: settings.bill_days_before, due_days: settings.due_days,
    sibling_discount_pct: settings.sibling_discount_pct, payment_instructions: settings.payment_instructions || '',
    legal_name: settings.legal_name || '', tax_id: settings.tax_id || '', auto_send: settings.auto_send,
  }));
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const row = { facility_id: facilityId, cycle: f.cycle, bill_days_before: Number(f.bill_days_before) || 0, due_days: Number(f.due_days) || 0,
      sibling_discount_pct: Number(f.sibling_discount_pct) || 0, payment_instructions: f.payment_instructions.trim() || null,
      legal_name: f.legal_name.trim() || null, tax_id: f.tax_id.trim() || null, auto_send: f.auto_send };
    const { error } = await supabase.from('daycare_billing_settings').upsert(row);
    setBusy(false);
    if (error) { setMsg({ err: errText(error) }); return; }
    setMsg({ ok: 'Saved.' }); reloadSettings();
  }
  const next = settings.next_period_start;
  return (
    <form onSubmit={save} className="card" style={{ padding: '14px 16px', maxWidth: 620 }}>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      <label className="fl">Bill families</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['weekly', 'Weekly (Monday to Sunday)'], ['monthly', 'Monthly']].map(([k, l]) => (
          <button key={k} type="button" className="chip" onClick={() => set('cycle', k)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: f.cycle === k ? 'var(--accent)' : undefined, color: f.cycle === k ? '#fff' : undefined }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}><label className="fl">Send the bill (days before the period)</label>
          <input className="fi" type="number" min="0" max="20" value={f.bill_days_before} onChange={e => set('bill_days_before', e.target.value)}/></div>
        <div style={{ flex: 1, minWidth: 160 }}><label className="fl">Due (days after the bill)</label>
          <input className="fi" type="number" min="0" max="60" value={f.due_days} onChange={e => set('due_days', e.target.value)}/></div>
        <div style={{ flex: 1, minWidth: 160 }}><label className="fl">Sibling discount %</label>
          <input className="fi" type="number" min="0" max="100" step="0.5" value={f.sibling_discount_pct} onChange={e => set('sibling_discount_pct', e.target.value)}/></div>
      </div>
      <label className="fl">How families pay (shown on every bill)</label>
      <textarea className="fi" rows={2} value={f.payment_instructions} onChange={e => set('payment_instructions', e.target.value)} maxLength={1000}
        placeholder="e.g. Cash or check at the front desk, made out to Sunshine Learning Center"/>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200 }}><label className="fl">Legal business name (if different)</label>
          <input className="fi" value={f.legal_name} onChange={e => set('legal_name', e.target.value)} maxLength={150}/></div>
        <div style={{ flex: 1, minWidth: 140 }}><label className="fl">Tax ID (EIN)</label>
          <input className="fi" value={f.tax_id} onChange={e => set('tax_id', e.target.value)} maxLength={20} placeholder="12-3456789"/></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '4px 0 12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.auto_send} onChange={e => set('auto_send', e.target.checked)} style={{ marginTop: 3 }}/>
        <span><strong>Send bills automatically.</strong> Each morning, if a period's bill day has come, littleloop makes and emails the statements. Off means you run billing yourself.</span>
      </label>
      {next && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>Next period starts {longDate(next)}{f.auto_send ? `; its bills go out ${longDate(shiftDays(next, -Number(f.bill_days_before || 0)))}` : ''}.</div>}
      <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Save settings'}</button>
    </form>
  );
}
function shiftDays(iso, n) { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + n); return localDate(x); }
