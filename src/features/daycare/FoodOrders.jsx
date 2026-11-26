import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { errText } from './api';
import { localDate, addDays } from './enrollment';
import { weekStart } from './learning';
import { money, longDate } from './billing';
import { EXPENSE_METHODS } from './office';
import { loadMenus } from './kitchen';

// Food orders to vendors: draft → ordered → received (or canceled). The director/office can add a
// received order to Office → Expenses as Food, once.
const STATUS = {
  draft:    { label: 'Draft',    cls: 'sb-p' },
  ordered:  { label: 'Ordered',  cls: 'sb-p' },
  received: { label: 'Received', cls: 'sb-a' },
  canceled: { label: 'Canceled', cls: 'sb-i' },
};

export default function FoodOrders({ facilityId, manager }) {
  const [orders,  setOrders]  = useState(null);
  const [filter,  setFilter]  = useState('open');
  const [editing, setEditing] = useState(null);   // order row, or {} for new
  const [expense, setExpense] = useState(null);   // order to add to expenses
  const [cancel,  setCancel]  = useState(null);
  const [open,    setOpen]    = useState(null);   // expanded order id
  const [msg,     setMsg]     = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('daycare_food_orders').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(100);
    if (error) setMsg({ err: errText(error) });
    setOrders(data || []);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(o, status) {
    setMsg(null);
    const { error } = await supabase.from('daycare_food_orders').update({ status }).eq('id', o.id);
    if (error) { setMsg({ err: errText(error) }); return; }
    load();
  }
  async function toggleItem(o, i) {
    const items = o.items.map((it, j) => j === i ? { ...it, done: !it.done } : it);
    setOrders(os => os.map(x => x.id === o.id ? { ...x, items } : x));
    const { error } = await supabase.from('daycare_food_orders').update({ items }).eq('id', o.id);
    if (error) { setMsg({ err: errText(error) }); load(); }
  }

  const shown = (orders || []).filter(o => filter === 'all' || (filter === 'open' ? ['draft', 'ordered'].includes(o.status) : o.status === 'received'));
  const vendors = [...new Set((orders || []).map(o => o.vendor))].sort();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['open', 'Open'], ['received', 'Received'], ['all', 'All']].map(([id, label]) => (
          <button key={id} className="chip" onClick={() => setFilter(id)}
            style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filter === id ? 'var(--accent)' : undefined, color: filter === id ? '#fff' : undefined }}>{label}</button>
        ))}
        <span style={{ flex: 1 }}/>
        <button className="bp" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditing({})}>+ New order</button>
      </div>
      {msg && <div className={`al ${msg.ok ? 'al-s' : 'al-e'}`}>{msg.ok || msg.err}</div>}

      {!orders ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={22}/></div>
        : shown.length === 0 ? <div className="al al-s">{filter === 'open' ? 'No open orders.' : 'No orders here yet.'}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(o => {
              const done = o.items.filter(i => i.done).length;
              return (
                <div key={o.id} className="card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setOpen(x => x === o.id ? null : o.id)} style={{ flex: 1, minWidth: 180, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
                      <strong style={{ fontSize: 14 }}>{o.vendor}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>
                        {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        {o.status === 'ordered' && o.items.length > 0 && done > 0 && ` · ${done} checked in`}
                        {o.needed_by && o.status !== 'received' && ` · needed by ${longDate(o.needed_by)}`}
                        {o.total != null && ` · ${money(o.total)}`}
                        {o.received_at ? ` · received ${new Date(o.received_at).toLocaleDateString()}${o.received_by_name ? ` by ${o.received_by_name}` : ''}` : ` · by ${o.created_by_name || 'staff'}`}
                      </span>
                    </button>
                    <span className={`sb ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                    {o.expense_id && <span className="chip" style={{ fontSize: 11 }}>✓ In expenses</span>}
                  </div>
                  {open === o.id && (
                    <div style={{ marginTop: 8 }}>
                      {o.items.map((it, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0', cursor: o.status === 'ordered' ? 'pointer' : 'default' }}>
                          {o.status === 'ordered' && <input type="checkbox" checked={!!it.done} onChange={() => toggleItem(o, i)} aria-label={`Received ${it.name}`}/>}
                          <span style={{ flex: 1, textDecoration: it.done && o.status === 'ordered' ? 'line-through' : 'none' }}>{it.name}</span>
                          <span style={{ color: 'var(--text-faint)' }}>{it.qty}</span>
                        </label>
                      ))}
                      {o.note && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{o.note}</div>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {['draft', 'ordered'].includes(o.status) && <button className="bg" style={sm} onClick={() => setEditing(o)}>Edit</button>}
                    {o.status === 'draft' && <button className="bg" style={sm} onClick={() => setStatus(o, 'ordered')}>Mark ordered</button>}
                    {['draft', 'ordered'].includes(o.status) && <button className="bp" style={sm} onClick={() => setStatus(o, 'received')}>Mark received</button>}
                    {['draft', 'ordered'].includes(o.status) && <button className="bg" style={sm} onClick={() => setCancel(o)}>Cancel order</button>}
                    {o.status === 'received' && !o.expense_id && manager && <button className="bp" style={sm} onClick={() => setExpense(o)}>Add to expenses</button>}
                    {o.status === 'received' && !o.expense_id && <button className="bg" style={sm} onClick={() => setStatus(o, 'ordered')}>Not received yet</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {editing && <OrderModal facilityId={facilityId} order={editing.id ? editing : null} vendors={vendors} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }}/>}
      {expense && <ExpenseModal order={expense} onClose={() => setExpense(null)} onSaved={() => { setExpense(null); setMsg({ ok: 'Added to Office → Expenses as Food.' }); load(); }}/>}
      <Confirm open={!!cancel} title={`Cancel the ${cancel?.vendor} order?`} message="It stays in the list as canceled." danger
        onConfirm={() => { setStatus(cancel, 'canceled'); setCancel(null); }} onCancel={() => setCancel(null)}/>
    </div>
  );
}
const sm = { padding: '5px 10px', fontSize: 12 };

function OrderModal({ facilityId, order, vendors, onClose, onSaved }) {
  const [vendor, setVendor] = useState(order?.vendor || '');
  const [needed, setNeeded] = useState(order?.needed_by || '');
  const [items,  setItems]  = useState(order?.items?.length ? order.items : [{ name: '', qty: '' }]);
  const [note,   setNote]   = useState(order?.note || '');
  const [total,  setTotal]  = useState(order?.total != null ? String(order.total) : '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const setItem = (i, k, v) => setItems(its => its.map((it, j) => j === i ? { ...it, [k]: v } : it));

  async function fromMenu() {
    const mon = weekStart(addDays(localDate(), 7));   // next week's menu
    let menus = await loadMenus(facilityId, mon, addDays(mon, 4));
    if (!Object.keys(menus).length) menus = await loadMenus(facilityId, weekStart(), addDays(weekStart(), 4));
    const names = [...new Set(Object.values(menus).flatMap(r => (r.foods || []).map(f => f.name)))].sort();
    if (!names.length) { setError('No menu planned for this week or next yet.'); return; }
    const have = new Set(items.map(i => i.name.trim().toLowerCase()).filter(Boolean));
    setItems(its => [...its.filter(i => i.name.trim()), ...names.filter(n => !have.has(n.toLowerCase())).map(n => ({ name: n, qty: '' }))].slice(0, 100));
    setError(null);
  }

  async function save(e) {
    e.preventDefault();
    const clean = items.map(i => ({ name: i.name.trim().slice(0, 80), qty: (i.qty || '').trim().slice(0, 30), ...(i.done ? { done: true } : {}) })).filter(i => i.name);
    if (!vendor.trim()) { setError('Who is the order from?'); return; }
    if (total && !/^\d{1,6}(\.\d{1,2})?$/.test(total.trim())) { setError('The total should be an amount like 125.40.'); return; }
    setSaving(true); setError(null);
    const row = { vendor: vendor.trim(), needed_by: needed || null, items: clean, note: note.trim() || null, total: total.trim() ? Number(total) : null };
    const { error: err } = order
      ? await supabase.from('daycare_food_orders').update(row).eq('id', order.id)
      : await supabase.from('daycare_food_orders').insert({ ...row, facility_id: facilityId });
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved();
  }

  return (
    <Modal open onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 12 }}>{order ? 'Edit order' : 'New food order'}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label className="fl">Vendor</label>
            <input className="fi" list="ll-vendors" value={vendor} onChange={e => setVendor(e.target.value)} maxLength={100} placeholder="e.g. Sysco, Walmart" required/>
            <datalist id="ll-vendors">{vendors.map(v => <option key={v} value={v}/>)}</datalist>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="fl">Needed by <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input className="fi" type="date" value={needed} onChange={e => setNeeded(e.target.value)}/>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label className="fl" style={{ marginBottom: 0 }}>Items</label>
          <button type="button" className="bg" style={{ padding: '3px 10px', fontSize: 11 }} onClick={fromMenu}>+ Foods from the menu</button>
        </div>
        <div style={{ maxHeight: '34vh', overflowY: 'auto', margin: '6px 0 10px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input className="fi" value={it.name} onChange={e => setItem(i, 'name', e.target.value)} maxLength={80} placeholder="Item" aria-label={`Item ${i + 1}`} style={{ marginBottom: 0, flex: 2 }}/>
              <input className="fi" value={it.qty || ''} onChange={e => setItem(i, 'qty', e.target.value)} maxLength={30} placeholder="How much" aria-label={`Amount for item ${i + 1}`} style={{ marginBottom: 0, flex: 1 }}/>
              <button type="button" className="bg" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setItems(its => its.length > 1 ? its.filter((_, j) => j !== i) : [{ name: '', qty: '' }])} aria-label={`Remove item ${i + 1}`}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="bg" style={{ padding: '4px 10px', fontSize: 12, marginBottom: 12 }} disabled={items.length >= 100} onClick={() => setItems(its => [...its, { name: '', qty: '' }])}>+ Add item</button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label className="fl">Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input className="fi" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="e.g. Deliver to the side door"/>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label className="fl">Total <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input className="fi" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00"/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseModal({ order, onClose, onSaved }) {
  const received = order.received_at ? localDate(new Date(order.received_at)) : localDate();
  const [amount, setAmount] = useState(order.total != null ? Number(order.total).toFixed(2) : '');
  const [date,   setDate]   = useState(received);
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function save(e) {
    e.preventDefault();
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError('Enter the amount paid, like 125.40.'); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.rpc('daycare_food_order_expense', { p_id: order.id, p_amount: Number(amount), p_date: date || null, p_method: method || null });
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved();
  }

  return (
    <Modal open onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600 }}>Add to expenses</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>{order.vendor} · Food and snacks · shows in Office → Expenses and the profit and loss</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label className="fl">Amount paid</label>
            <input className="fi" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required/>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="fl">Date</label>
            <input className="fi" type="date" value={date} max={localDate()} onChange={e => setDate(e.target.value)}/>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="fl">Paid by</label>
            <select className="fi" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="">Not sure</option>
              {EXPENSE_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Add expense'}</button>
          <button type="button" className="bg" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
