import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt, fmtDate } from '../../services/format';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// Recurring invoices: the sitter sets a family, amount and cadence once; a daily server job
// (run-recurring-invoices) creates and sends each invoice on schedule. Pro feature.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQS = [
  { id: 'weekly',   label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly',  label: 'Every month' },
];

const parse = s => new Date(s + 'T00:00:00');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => iso(new Date());
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

// Next date after today that falls on the same weekday as `from`.
function nextSameWeekday(from) {
  const target = parse(from).getDay();
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  return iso(d);
}

export function describeSchedule(r) {
  const day = WEEKDAYS[parse(r.next_run_date).getDay()];
  if (r.frequency === 'weekly')   return `Every ${day}`;
  if (r.frequency === 'biweekly') return `Every other ${day}`;
  return `Monthly on the ${ordinal(r.anchor_day || parse(r.next_run_date).getDate())}`;
}

export default function RecurringInvoices({ sitterId, families, familyChildren, isPro, onUpgrade }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | {} (new) | row
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('recurring_invoices').select('*').eq('sitter_id', sitterId).order('created_at');
    setRows(data || []);
    setLoading(false);
  }, [sitterId]);
  useEffect(() => { load(); }, [load]);

  const familyName = id => families.find(f => f.id === id)?.name || 'Family';
  const childName  = (fid, cid) => (familyChildren[fid] || []).find(c => c.id === cid)?.name;

  async function toggleActive(r) {
    await supabase.from('recurring_invoices').update({ active: !r.active }).eq('id', r.id);
    load();
  }
  async function remove(r) {
    await supabase.from('recurring_invoices').delete().eq('id', r.id);
    setConfirmDelete(null);
    load();
  }

  if (loading) return null;

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: rows.length || !isPro ? 12 : 0 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600 }}>🔁 Recurring invoices</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Set it once and littleloop sends the invoice for you.</div>
        </div>
        {isPro && <button className="bp" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setEditing({})}>+ Set up</button>}
      </div>

      {!isPro && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(123,170,238,.08)', border: '1px solid rgba(123,170,238,.25)', fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>Automatic weekly, every-other-week or monthly invoices are part of <strong>Pro</strong>.</span>
          <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onUpgrade}>See Pro</button>
        </div>
      )}

      {isPro && rows.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg)', marginTop: 8, opacity: r.active ? 1 : 0.6, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {familyName(r.family_id)} · {fmt(Number(r.amount))}
              {childName(r.family_id, r.child_id) && <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}> · {childName(r.family_id, r.child_id)}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              {describeSchedule(r)} · {r.active ? `next ${fmtDate(r.next_run_date)}` : 'paused'} · {r.auto_send ? 'sends automatically' : 'saved as draft for you to send'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="bg" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditing(r)}>✏️ Edit</button>
            <button className="bg" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleActive(r)}>{r.active ? '⏸ Pause' : '▶ Resume'}</button>
            <button className="bd" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setConfirmDelete(r)}>🗑️</button>
          </div>
        </div>
      ))}

      {editing && (
        <RecurringModal
          sitterId={sitterId} row={editing.id ? editing : null}
          families={families.filter(f => f.connection_status === 'active')} familyChildren={familyChildren}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }}
        />
      )}
      <Confirm open={!!confirmDelete} title="Delete this recurring invoice?"
        message="Invoices already sent stay as they are. No new ones will be created." danger
        onConfirm={() => remove(confirmDelete)} onCancel={() => setConfirmDelete(null)}/>
    </div>
  );
}

function RecurringModal({ sitterId, row, families, familyChildren, onClose, onSaved }) {
  const [familyId,  setFamilyId]  = useState(row?.family_id || families[0]?.id || '');
  const [childId,   setChildId]   = useState(row?.child_id || '');
  const [amount,    setAmount]    = useState(row ? String(row.amount) : '');
  const [frequency, setFrequency] = useState(row?.frequency || 'weekly');
  const [nextDate,  setNextDate]  = useState(row?.next_run_date || '');
  const [dueDays,   setDueDays]   = useState(row?.due_days ?? 0);
  const [autoSend,  setAutoSend]  = useState(row?.auto_send ?? true);
  const [desc,      setDesc]      = useState(row?.description || '');
  const [hint,      setHint]      = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);

  const kids = familyChildren[familyId] || [];

  // New schedule: pre-fill from this family's most recent invoice.
  useEffect(() => {
    if (row || !familyId) return;
    (async () => {
      const { data: inv } = await supabase.from('invoices').select('id,issued_date,due_date')
        .eq('sitter_id', sitterId).eq('family_id', familyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inv) { setHint(null); setChildId(kids[0]?.id || ''); return; }
      const { data: items } = await supabase.from('invoice_items').select('amount,child_id').eq('invoice_id', inv.id);
      const total = (items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      if (total > 0) setAmount(String(total));
      setChildId(items?.[0]?.child_id || kids[0]?.id || '');
      setNextDate(nextSameWeekday(inv.issued_date));
      if (inv.due_date) setDueDays(Math.max(0, Math.round((parse(inv.due_date) - parse(inv.issued_date)) / 86400000)));
      setHint(`Filled in from your last invoice (${fmtDate(inv.issued_date)}).`);
    })();
  }, [familyId]);

  async function save(e) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!familyId)            return setError('Pick a family.');
    if (!(amt > 0))           return setError('Enter an amount.');
    if (!nextDate)            return setError('Pick the date of the next invoice.');
    if (nextDate < todayIso()) return setError('The next invoice date can’t be in the past.');
    setSaving(true);
    const payload = {
      sitter_id: sitterId, family_id: familyId, child_id: childId || null, amount: amt,
      description: desc.trim() || null, frequency, next_run_date: nextDate,
      anchor_day: frequency === 'monthly' ? parse(nextDate).getDate() : null,
      due_days: Number(dueDays) || 0, auto_send: autoSend, active: true,
    };
    const { error: err } = row
      ? await supabase.from('recurring_invoices').update(payload).eq('id', row.id)
      : await supabase.from('recurring_invoices').insert(payload);
    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
  }

  const preview = nextDate ? describeSchedule({ frequency, next_run_date: nextDate, anchor_day: parse(nextDate).getDate() }) : null;

  return (
    <Modal open onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
        {row ? 'Edit recurring invoice' : 'Set up a recurring invoice'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Invoices go out around 8am on the scheduled day.</p>
      {error && <div className="al al-e">{error}</div>}
      {hint && !error && <div className="al al-i">{hint}</div>}

      {families.length === 0
        ? <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Connect with a family first, then you can bill them automatically.</p>
        : (
        <form onSubmit={save}>
          <label className="fl">Family</label>
          <select className="fi" value={familyId} onChange={e => setFamilyId(e.target.value)} disabled={!!row}>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          {kids.length > 0 && <>
            <label className="fl">Child (shown on the invoice)</label>
            <select className="fi" value={childId} onChange={e => setChildId(e.target.value)}>
              <option value="">No specific child</option>
              {kids.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
            </select>
          </>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className="fl">Amount ($)</label>
              <input className="fi" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="250.00"/>
            </div>
            <div>
              <label className="fl">How often</label>
              <select className="fi" value={frequency} onChange={e => setFrequency(e.target.value)}>
                {FREQS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Next invoice date</label>
              <input className="fi" type="date" min={todayIso()} value={nextDate} onChange={e => setNextDate(e.target.value)}/>
            </div>
            <div>
              <label className="fl">Due</label>
              <select className="fi" value={dueDays} onChange={e => setDueDays(e.target.value)}>
                <option value={0}>Same day</option>
                <option value={1}>Next day</option>
                <option value={3}>In 3 days</option>
                <option value={7}>In 1 week</option>
                <option value={14}>In 2 weeks</option>
              </select>
            </div>
          </div>

          <label className="fl">Note on the invoice (optional)</label>
          <input className="fi" value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} placeholder="Weekly childcare"/>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0 16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#7BAAEE' }}/>
            Send it to the family automatically (otherwise it’s saved as a draft for you to review)
          </label>

          {preview && amount && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
              📅 {fmt(parseFloat(amount) || 0)} · {preview}, starting {fmtDate(nextDate)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : row ? 'Save changes' : 'Start recurring invoice'}</button>
            <button type="button" className="bg" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
