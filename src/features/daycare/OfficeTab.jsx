import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { money, longDate, shortDate, methodLabel } from './billing';
import { EXPENSE_CATEGORIES, expenseCat, EXPENSE_METHODS, FREQUENCIES, INCOME_LABELS, presetRange,
         hours, monthLabel, downloadCsv } from './office';
import RangePicker from './RangePicker';
import { localDate } from './enrollment';
import { errText } from './api';

const VIEWS = [
  { id: 'expenses',   label: 'Expenses' },
  { id: 'pnl',        label: 'Profit & loss' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'staff',      label: 'Staff hours' },
  { id: 'export',     label: 'QuickBooks' },
];
const RECEIPT_BUCKET = 'daycare-receipts';
const time = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const usDate = iso => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };

// Office (director and office): expenses, profit and loss, attendance and staff hours reports,
// and the QuickBooks export.
export default function OfficeTab({ facility, facilityId }) {
  const [view, setView] = useState('expenses');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Office</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <button key={v.id} className="chip" onClick={() => setView(v.id)}
              style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: view === v.id ? 'var(--accent)' : undefined, color: view === v.id ? '#fff' : undefined }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'expenses'   && <Expenses facilityId={facilityId}/>}
      {view === 'pnl'        && <ProfitLoss facility={facility} facilityId={facilityId}/>}
      {view === 'attendance' && <Attendance facility={facility} facilityId={facilityId}/>}
      {view === 'staff'      && <StaffHours facility={facility} facilityId={facilityId}/>}
      {view === 'export'     && <QuickBooksExport facility={facility} facilityId={facilityId}/>}
    </div>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────────
function Expenses({ facilityId }) {
  const [range, setRange] = useState(() => presetRange('this_month'));
  const [rows,  setRows]  = useState(null);
  const [recur, setRecur] = useState([]);
  const [edit,  setEdit]  = useState(null);    // null | {} | expense
  const [editR, setEditR] = useState(null);    // null | {} | recurring
  const [msg,   setMsg]   = useState(null);
  const load = useCallback(async () => {
    const [{ data, error }, { data: rc }] = await Promise.all([
      supabase.from('daycare_expenses').select('*').eq('facility_id', facilityId).gte('expense_date', range[0]).lte('expense_date', range[1])
        .order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('daycare_recurring_expenses').select('*').eq('facility_id', facilityId).order('next_date'),
    ]);
    if (error) setMsg({ err: errText(error) });
    setRows(data || []); setRecur(rc || []);
  }, [facilityId, range]);
  useEffect(() => { load(); }, [load]);

  async function openReceipt(e) {
    const win = window.open('', '_blank');
    const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(e.receipt_path, 300);
    if (error || !data?.signedUrl) { win?.close(); setMsg({ err: 'Couldn\'t open the receipt.' }); return; }
    if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  const total = (rows || []).reduce((s, e) => s + Number(e.amount), 0);
  const byCat = {};
  for (const e of rows || []) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
  return (
    <div>
      <RangePicker range={range} setRange={setRange}/>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button className="bp" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEdit({})}>+ Add expense</button>
        <button className="bg" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEditR({})}>+ Repeating expense</button>
        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800 }}>{money(total)}</span>
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {Object.keys(byCat).length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className="chip" style={{ fontSize: 11 }}>{expenseCat(k).label}: {money(v)}</span>
          ))}
        </div>
      )}
      {!rows ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : rows.length === 0 ? <div className="es"><div className="ic">🧾</div><h3>No expenses in these dates</h3><p>Add what the daycare spends (rent, food, supplies, payroll) to see profit and loss and export to QuickBooks.</p></div>
        : (
          <div className="card" style={{ padding: '4px 14px' }}>
            {rows.map(e => (
              <button key={e.id} onClick={() => setEdit(e)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 52 }}>{shortDate(e.expense_date)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{e.vendor || expenseCat(e.category).label}{e.recurring_id ? ' 🔁' : ''}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[expenseCat(e.category).label, e.description, e.method && methodLabel(e.method)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {e.receipt_path && <span role="button" title="Open the receipt" onClick={ev => { ev.stopPropagation(); openReceipt(e); }} style={{ fontSize: 16 }}>📎</span>}
                <span style={{ fontSize: 14, fontWeight: 800 }}>{money(e.amount)}</span>
              </button>
            ))}
          </div>
        )}
      {recur.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, margin: '16px 0 6px' }}>Repeating expenses (added automatically on their date)</div>
          <div className="card" style={{ padding: '4px 14px' }}>
            {recur.map(r => (
              <button key={r.id} onClick={() => setEditR(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 0', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)', opacity: r.active ? 1 : .5 }}>
                <span style={{ flex: 1, fontSize: 13 }}><strong>{r.vendor || expenseCat(r.category).label}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>· {FREQUENCIES.find(f => f.id === r.frequency)?.label.toLowerCase()} · {r.active ? `next ${longDate(r.next_date)}` : 'paused'}</span></span>
                <span style={{ fontWeight: 800 }}>{money(r.amount)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {edit && <ExpenseModal facilityId={facilityId} expense={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={t => { setEdit(null); setMsg({ ok: t }); load(); }}/>}
      {editR && <RecurringModal facilityId={facilityId} item={editR.id ? editR : null} onClose={() => setEditR(null)} onSaved={t => { setEditR(null); setMsg({ ok: t }); load(); }}/>}
    </div>
  );
}

function ExpenseModal({ facilityId, expense, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ expense_date: expense?.expense_date || localDate(), vendor: expense?.vendor || '', category: expense?.category || 'classroom_supplies',
    amount: expense?.amount ?? '', method: expense?.method || 'card', reference: expense?.reference || '', description: expense?.description || '' }));
  const [file,  setFile]  = useState(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const [sure,  setSure]  = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function save(e) {
    e.preventDefault();
    const amount = Math.round(parseFloat(f.amount) * 100) / 100;
    if (!(amount > 0)) { setError('Enter the amount.'); return; }
    if (file && file.size > 10 * 1024 * 1024) { setError('Receipts can be up to 10 MB.'); return; }
    setBusy(true); setError(null);
    const row = { facility_id: facilityId, expense_date: f.expense_date, vendor: f.vendor.trim() || null, category: f.category, amount,
      method: f.method || null, reference: f.reference.trim() || null, description: f.description.trim() || null };
    let newPath = null;
    if (file) {
      const ext = (file.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || 'jpg').toLowerCase();
      newPath = `${facilityId}/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(RECEIPT_BUCKET).upload(newPath, file, { contentType: file.type || undefined });
      if (upErr) { setBusy(false); setError(`Receipt didn't upload: ${upErr.message}`); return; }
      row.receipt_path = newPath; row.receipt_name = file.name.slice(0, 255);
    }
    const { error: err } = expense
      ? await supabase.from('daycare_expenses').update(row).eq('id', expense.id)
      : await supabase.from('daycare_expenses').insert(row);
    setBusy(false);
    if (err) { if (newPath) supabase.storage.from(RECEIPT_BUCKET).remove([newPath]); setError(errText(err)); return; }
    if (newPath && expense?.receipt_path) supabase.storage.from(RECEIPT_BUCKET).remove([expense.receipt_path]);
    onSaved(`${expense ? 'Saved' : 'Added'} ${money(amount)}${f.vendor.trim() ? ` for ${f.vendor.trim()}` : ''}.`);
  }
  async function remove() {
    setBusy(true);
    const { error: err } = await supabase.from('daycare_expenses').delete().eq('id', expense.id);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    if (expense.receipt_path) supabase.storage.from(RECEIPT_BUCKET).remove([expense.receipt_path]);
    onSaved('Expense deleted.');
  }

  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>{expense ? 'Expense' : 'Add an expense'}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Date</label><input className="fi" type="date" value={f.expense_date} onChange={e => set('expense_date', e.target.value)}/></div>
          <div style={{ flex: 1 }}><label className="fl">Amount</label><input className="fi" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00"/></div>
        </div>
        <label className="fl">Paid to</label>
        <input className="fi" value={f.vendor} onChange={e => set('vendor', e.target.value)} maxLength={120} placeholder="e.g. Costco"/>
        <label className="fl">Category</label>
        <select className="fi" value={f.category} onChange={e => set('category', e.target.value)}>
          {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Paid by</label>
            <select className="fi" value={f.method} onChange={e => set('method', e.target.value)}>
              {EXPENSE_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select></div>
          <div style={{ flex: 1 }}><label className="fl">Check # or reference</label><input className="fi" value={f.reference} onChange={e => set('reference', e.target.value)} maxLength={60}/></div>
        </div>
        <label className="fl">Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input className="fi" value={f.description} onChange={e => set('description', e.target.value)} maxLength={300} placeholder="e.g. Snacks for the week"/>
        <label className="fl">Receipt <span style={{ fontWeight: 400 }}>(photo or PDF, optional)</span></label>
        <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 12, marginBottom: 12 }}/>
        {expense?.receipt_name && !file && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -8, marginBottom: 10 }}>Attached: {expense.receipt_name}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
          {expense && !sure && <button type="button" className="bd" style={{ padding: '8px 14px' }} onClick={() => setSure(true)} disabled={busy}>Delete</button>}
          {expense && sure && <button type="button" className="bd" style={{ padding: '8px 14px' }} onClick={remove} disabled={busy}>Yes, delete</button>}
        </div>
      </form>
    </Modal>
  );
}

function RecurringModal({ facilityId, item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ vendor: item?.vendor || '', category: item?.category || 'rent', amount: item?.amount ?? '', method: item?.method || 'ach',
    frequency: item?.frequency || 'monthly', next_date: item?.next_date || localDate(), description: item?.description || '', active: item?.active ?? true }));
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  async function save(e) {
    e.preventDefault();
    const amount = Math.round(parseFloat(f.amount) * 100) / 100;
    if (!(amount > 0)) { setError('Enter the amount.'); return; }
    setBusy(true); setError(null);
    const row = { facility_id: facilityId, vendor: f.vendor.trim() || null, category: f.category, amount, method: f.method || null,
      frequency: f.frequency, next_date: f.next_date, description: f.description.trim() || null, active: f.active };
    const { error: err } = item
      ? await supabase.from('daycare_recurring_expenses').update(row).eq('id', item.id)
      : await supabase.from('daycare_recurring_expenses').insert(row);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    onSaved(`${item ? 'Saved' : 'Added'}. It's added to expenses automatically each time it comes due, starting ${longDate(f.next_date)}.`);
  }
  async function remove() {
    setBusy(true);
    const { error: err } = await supabase.from('daycare_recurring_expenses').delete().eq('id', item.id);
    setBusy(false);
    if (err) { setError(errText(err)); return; }
    onSaved('Repeating expense removed. Expenses it already added stay.');
  }
  return (
    <Modal open onClose={() => !busy && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>{item ? 'Repeating expense' : 'Add a repeating expense'}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Paid to</label>
        <input className="fi" value={f.vendor} onChange={e => set('vendor', e.target.value)} maxLength={120} placeholder="e.g. Landlord, Payroll service"/>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">Category</label>
            <select className="fi" value={f.category} onChange={e => set('category', e.target.value)}>{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="fl">Amount</label><input className="fi" type="number" min="0.01" step="0.01" value={f.amount} onChange={e => set('amount', e.target.value)}/></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="fl">How often</label>
            <select className="fi" value={f.frequency} onChange={e => set('frequency', e.target.value)}>{FREQUENCIES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="fl">{item ? 'Next date' : 'First date'}</label><input className="fi" type="date" value={f.next_date} onChange={e => set('next_date', e.target.value)}/></div>
        </div>
        <label className="fl">Paid by</label>
        <select className="fi" value={f.method} onChange={e => set('method', e.target.value)}>{EXPENSE_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '0 0 12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)}/> Keep adding it
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="bp full" disabled={busy}>{busy ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={busy}>Cancel</button>
          {item && <button type="button" className="bd" style={{ padding: '8px 14px' }} onClick={remove} disabled={busy}>Remove</button>}
        </div>
      </form>
    </Modal>
  );
}

// ── Profit and loss ──────────────────────────────────────────────────────────
function ProfitLoss({ facility, facilityId }) {
  const [range, setRange] = useState(() => presetRange('this_year'));
  const [rows,  setRows]  = useState(null);
  const [msg,   setMsg]   = useState(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc('daycare_pnl', { p_facility: facilityId, p_from: range[0], p_to: range[1] }).then(({ data, error }) => {
      if (error) setMsg({ err: errText(error) });
      setRows(data || []);
    });
  }, [facilityId, range]);

  if (!rows) return <><RangePicker range={range} setRange={setRange}/><div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div></>;
  const months = [...new Set(rows.map(r => r.month))].sort();
  const showMonths = months.length > 1 && months.length <= 12;
  const lines = section => {
    const cats = [...new Set(rows.filter(r => r.section === section).map(r => r.category))];
    return cats.map(cat => ({ cat, label: section === 'income' ? (INCOME_LABELS[cat] || cat) : expenseCat(cat).label,
      byMonth: Object.fromEntries(months.map(m => [m, rows.filter(r => r.section === section && r.category === cat && r.month === m).reduce((s, r) => s + Number(r.amount), 0)])),
      total: rows.filter(r => r.section === section && r.category === cat).reduce((s, r) => s + Number(r.amount), 0) }))
      .sort((a, b) => b.total - a.total);
  };
  const inc = lines('income'), exp = lines('expense');
  const sum = (list, m) => list.reduce((s, l) => s + (m ? l.byMonth[m] : l.total), 0);
  const net = m => sum(inc, m) - sum(exp, m);
  const cellStyle = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };

  function csv() {
    const head = ['', ...(showMonths ? months.map(monthLabel) : []), 'Total'];
    const row = (label, l, getter) => [label, ...(showMonths ? months.map(m => getter(m).toFixed(2)) : []), getter(null).toFixed(2)];
    downloadCsv(`profit-and-loss-${range[0]}-to-${range[1]}.csv`, [
      [`${facility?.name || 'Daycare'}: profit and loss (cash basis), ${range[0]} to ${range[1]}`], head, ['Income'],
      ...inc.map(l => row(l.label, l, m => m ? l.byMonth[m] : l.total)), row('Total income', null, m => sum(inc, m)), ['Expenses'],
      ...exp.map(l => row(l.label, l, m => m ? l.byMonth[m] : l.total)), row('Total expenses', null, m => sum(exp, m)), row('Net profit', null, m => net(m)),
    ]);
  }

  const Row = ({ label, get, bold, color }) => (
    <tr style={{ fontWeight: bold ? 800 : 400, color }}>
      <td style={{ padding: '6px 8px' }}>{label}</td>
      {showMonths && months.map(m => <td key={m} style={cellStyle}>{money(get(m))}</td>)}
      <td style={{ ...cellStyle, fontWeight: 800 }}>{money(get(null))}</td>
    </tr>
  );
  return (
    <div>
      <RangePicker range={range} setRange={setRange}/>
      {msg && <div className="al al-e">{msg.err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        {[['Money in', sum(inc)], ['Money out', sum(exp)], ['Net', net(null)]].map(([k, v]) => (
          <div key={k} className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-faint)' }}>{k}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k === 'Net' ? (v < 0 ? 'var(--err-text)' : 'var(--ok-text)') : 'var(--text)' }}>{money(v)}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <div className="al al-s">No payments or expenses in these dates.</div> : (
        <div className="card" style={{ padding: '6px 8px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}></th>
              {showMonths && months.map(m => <th key={m} style={cellStyle}>{monthLabel(m)}</th>)}
              <th style={cellStyle}>Total</th></tr></thead>
            <tbody>
              <tr><td colSpan={months.length + 2} style={{ padding: '8px 8px 2px', fontWeight: 800 }}>Income</td></tr>
              {inc.map(l => <Row key={l.cat} label={l.label} get={m => m ? l.byMonth[m] : l.total}/>)}
              <Row label="Total income" get={m => sum(inc, m)} bold/>
              <tr><td colSpan={months.length + 2} style={{ padding: '10px 8px 2px', fontWeight: 800 }}>Expenses</td></tr>
              {exp.map(l => <Row key={l.cat} label={l.label} get={m => m ? l.byMonth[m] : l.total}/>)}
              <Row label="Total expenses" get={m => sum(exp, m)} bold/>
              <Row label="Net profit" get={m => net(m)} bold color={net(null) < 0 ? 'var(--err-text)' : 'var(--ok-text)'}/>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="bg" style={{ fontSize: 12 }} onClick={csv} disabled={!rows.length}>⬇ Download CSV</button>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Cash basis: payments when they're received and expenses when they're paid. Unpaid bills aren't income yet.</span>
      </div>
    </div>
  );
}

// ── Attendance ───────────────────────────────────────────────────────────────
function Attendance({ facility, facilityId }) {
  const [range, setRange] = useState(() => presetRange('this_month'));
  const [rows,  setRows]  = useState(null);
  const [open,  setOpen]  = useState(null);
  const [msg,   setMsg]   = useState(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc('daycare_attendance', { p_facility: facilityId, p_from: range[0], p_to: range[1] }).then(({ data, error }) => {
      if (error) setMsg({ err: errText(error) });
      setRows(data || []);
    });
  }, [facilityId, range]);
  const kids = {};
  for (const r of rows || []) (kids[r.child_id] ||= { name: r.child_name, family: r.family_name, room: r.classroom_name, days: [] }).days.push(r);
  const list = Object.entries(kids).sort((a, b) => a[1].name.localeCompare(b[1].name));

  function csv() {
    downloadCsv(`attendance-${range[0]}-to-${range[1]}.csv`, [
      ['Child', 'Family', 'Classroom', 'Date', 'In', 'Out', 'Hours'],
      ...(rows || []).map(r => [r.child_name, r.family_name, r.classroom_name, r.day, time(r.first_in), time(r.last_out), hours(r.minutes)]),
    ]);
  }
  return (
    <div>
      <RangePicker range={range} setRange={setRange}/>
      {msg && <div className="al al-e">{msg.err}</div>}
      {!rows ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : list.length === 0 ? <div className="al al-s">No check-ins in these dates.</div> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            {list.map(([id, k]) => (
              <div key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setOpen(o => o === id ? null : id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                  <span style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{k.name}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{[k.room, k.family].filter(Boolean).join(' · ')}</span></span>
                  <span style={{ fontSize: 12 }}>{k.days.length} day{k.days.length === 1 ? '' : 's'}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, minWidth: 70, textAlign: 'right' }}>{hours(k.days.reduce((s, d) => s + d.minutes, 0))} h</span>
                </button>
                {open === id && k.days.map(d => (
                  <div key={d.day} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '3px 0 3px 12px', color: 'var(--text-dim)' }}>
                    <span style={{ minWidth: 90 }}>{longDate(d.day)}</span>
                    <span style={{ flex: 1 }}>{time(d.first_in)} – {d.last_out ? time(d.last_out) : <em>no check-out</em>}</span>
                    <span>{hours(d.minutes)} h</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="bg" style={{ fontSize: 12 }} onClick={csv} disabled={!rows?.length}>⬇ Download CSV</button>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>From {facility?.name}'s check-ins and check-outs. Useful for subsidy attendance and licensing.</span>
      </div>
    </div>
  );
}

// ── Staff hours ──────────────────────────────────────────────────────────────
function StaffHours({ facilityId }) {
  const [range,  setRange]  = useState(() => presetRange('last_week'));
  const [source, setSource] = useState('clock');   // clock = time clock punches; rooms = "I'm in this room" sign-ins
  const [rows,   setRows]   = useState(null);
  const [open,   setOpen]   = useState(null);
  const [msg,    setMsg]    = useState(null);
  useEffect(() => {
    setRows(null); setMsg(null);
    const args = { p_facility: facilityId, p_from: range[0], p_to: range[1] };
    if (source === 'clock') {
      supabase.rpc('daycare_timeclock_hours', args).then(({ data, error }) => {
        if (error) setMsg({ err: errText(error) });
        const byDay = {};   // one row per person per day (shifts added up)
        for (const r of data || []) {
          const x = byDay[r.staff_id + '|' + r.day] ||= { staff_id: r.staff_id, staff_name: r.staff_name, role: r.role, day: r.day, minutes: 0, still_open: false };
          x.minutes += r.minutes || 0;
          if (!r.clock_out) x.still_open = true;
        }
        setRows(Object.values(byDay));
      });
    } else {
      supabase.rpc('daycare_staff_hours', args).then(({ data, error }) => {
        if (error) setMsg({ err: errText(error) });
        setRows(data || []);
      });
    }
  }, [facilityId, range, source]);
  const staff = {};
  for (const r of rows || []) (staff[r.staff_id] ||= { name: r.staff_name, role: r.role, days: [] }).days.push(r);
  const list = Object.entries(staff).sort((a, b) => a[1].name.localeCompare(b[1].name));
  function csv() {
    downloadCsv(`staff-hours-${range[0]}-to-${range[1]}.csv`, [
      ['Staff member', 'Role', 'Date', 'Hours', source === 'clock' ? 'Missing clock-out' : 'Still signed in'],
      ...(rows || []).map(r => [r.staff_name, r.role, r.day, hours(r.minutes), r.still_open ? 'yes' : '']),
    ]);
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[['clock', 'Time clock'], ['rooms', 'Room sign-ins']].map(([id, label]) => (
          <button key={id} className="chip" onClick={() => setSource(id)}
            style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, background: source === id ? 'var(--accent)' : undefined, color: source === id ? '#fff' : undefined }}>{label}</button>
        ))}
      </div>
      <RangePicker range={range} setRange={setRange}/>
      {msg && <div className="al al-e">{msg.err}</div>}
      {!rows ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : list.length === 0 ? <div className="al al-s">{source === 'clock' ? 'No clock-ins in these dates.' : 'No room sign-ins in these dates.'}</div> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            {list.map(([id, s]) => (
              <div key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setOpen(o => o === id ? null : id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                  <span style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{s.name}</strong> <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{s.role}</span></span>
                  <span style={{ fontSize: 12 }}>{s.days.length} day{s.days.length === 1 ? '' : 's'}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, minWidth: 70, textAlign: 'right' }}>{hours(s.days.reduce((x, d) => x + d.minutes, 0))} h</span>
                </button>
                {open === id && s.days.map(d => (
                  <div key={d.day} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '3px 0 3px 12px', color: 'var(--text-dim)' }}>
                    <span style={{ flex: 1 }}>{longDate(d.day)}{d.still_open ? (source === 'clock' ? ' · no clock-out' : ' · still signed in to a room') : ''}</span>
                    <span>{hours(d.minutes)} h</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="bg" style={{ fontSize: 12 }} onClick={csv} disabled={!rows?.length}>⬇ Download CSV for payroll</button>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{source === 'clock'
          ? 'From the Clock tab. Fix a missed or wrong punch in Clock → Team.'
          : 'From “I’m in this room” sign-ins on the Today board. Time spent outside a room (office, breaks) isn’t counted.'}</span>
      </div>
    </div>
  );
}

// ── QuickBooks export ────────────────────────────────────────────────────────
function QuickBooksExport({ facility, facilityId }) {
  const [range, setRange] = useState(() => presetRange('last_month'));
  const [busy,  setBusy]  = useState(null);
  const [msg,   setMsg]   = useState(null);
  async function fetchAll() {
    const [{ data: pays, error: e1 }, { data: exps, error: e2 }] = await Promise.all([
      supabase.from('daycare_ledger').select('entry_date, amount, payer, agency, method, reference, description, families(name)')
        .eq('facility_id', facilityId).eq('kind', 'payment').is('voided_at', null).gte('entry_date', range[0]).lte('entry_date', range[1]).order('entry_date'),
      supabase.from('daycare_expenses').select('expense_date, amount, vendor, category, method, reference, description')
        .eq('facility_id', facilityId).gte('expense_date', range[0]).lte('expense_date', range[1]).order('expense_date'),
    ]);
    if (e1 || e2) throw new Error(errText(e1 || e2));
    return { pays: pays || [], exps: exps || [] };
  }
  async function bankFile() {
    setBusy('bank'); setMsg(null);
    try {
      const { pays, exps } = await fetchAll();
      const lines = [
        ...pays.map(p => ({ d: p.entry_date, desc: p.payer === 'agency' ? `${p.agency} subsidy payment` : `${p.families?.name || 'Family'} payment${p.reference ? ` #${p.reference}` : ''}`, amt: Number(p.amount) })),
        ...exps.map(x => ({ d: x.expense_date, desc: [x.vendor, expenseCat(x.category).label].filter(Boolean).join(' - '), amt: -Number(x.amount) })),
      ].sort((a, b) => a.d.localeCompare(b.d));
      if (!lines.length) { setMsg({ err: 'Nothing to export in these dates.' }); setBusy(null); return; }
      downloadCsv(`quickbooks-bank-${range[0]}-to-${range[1]}.csv`, [['Date', 'Description', 'Amount'], ...lines.map(l => [usDate(l.d), l.desc, l.amt.toFixed(2)])]);
      setMsg({ ok: `${lines.length} transactions exported.` });
    } catch (e) { setMsg({ err: e.message }); }
    setBusy(null);
  }
  async function detailFile() {
    setBusy('detail'); setMsg(null);
    try {
      const { pays, exps } = await fetchAll();
      const lines = [
        ...pays.map(p => [usDate(p.entry_date), 'Payment received', p.payer === 'agency' ? p.agency : (p.families?.name || ''), p.payer === 'agency' ? 'Subsidy Income' : 'Tuition Income',
                          p.description || '', methodLabel(p.method), p.reference || '', Number(p.amount).toFixed(2)]),
        ...exps.map(x => [usDate(x.expense_date), 'Expense', x.vendor || '', expenseCat(x.category).qb, x.description || '', methodLabel(x.method) || x.method || '', x.reference || '', (-Number(x.amount)).toFixed(2)]),
      ].sort((a, b) => new Date(a[0]) - new Date(b[0]));
      if (!lines.length) { setMsg({ err: 'Nothing to export in these dates.' }); setBusy(null); return; }
      downloadCsv(`books-detail-${range[0]}-to-${range[1]}.csv`, [['Date', 'Type', 'Name', 'Account', 'Memo', 'Method', 'Reference', 'Amount'], ...lines]);
      setMsg({ ok: `${lines.length} transactions exported.` });
    } catch (e) { setMsg({ err: e.message }); }
    setBusy(null);
  }
  return (
    <div>
      <RangePicker range={range} setRange={setRange}/>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>QuickBooks Online bank file</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 10px', lineHeight: 1.6 }}>
          Payments received and expenses, as Date / Description / Amount. In QuickBooks: Banking → Upload transactions → pick this file, then categorize or match each line.
        </div>
        <button className="bp" onClick={bankFile} disabled={!!busy}>{busy === 'bank' ? <Spinner/> : '⬇ Download bank file'}</button>
      </div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Detailed file for your accountant</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 10px', lineHeight: 1.6 }}>
          Every payment and expense with the family or vendor, a suggested QuickBooks account, method and reference. Opens in Excel.
        </div>
        <button className="bg" onClick={detailFile} disabled={!!busy}>{busy === 'detail' ? <Spinner/> : '⬇ Download detailed file'}</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>Exports {facility?.name}'s books for the dates above. Tuition billed but not yet paid isn't included (cash basis).</div>
    </div>
  );
}
