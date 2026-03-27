import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PAYMENT_TYPES } from '../../lib/constants';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { fmt, fmtDateTime, fmtTime, fmtHours } from '../../services/format';
import { Modal } from '../ui/Modal';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

// ─── Line Item Row ────────────────────────────────────────────────────────────

export function LineItemRow({ item, children, onChange, onRemove, index }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label className="fl">{item.rate_type === 'flat' ? 'Start date' : 'Date'}</label>
          <input className="fi" type="date" value={item.service_date} onChange={e => onChange(index, { service_date: e.target.value })} style={{ marginBottom: 0 }}/>
        </div>
        <div>
          <label className="fl">Child</label>
          <select className="fi" value={item.child_id || ''} onChange={e => {
            const c = children.find(x => x.id === e.target.value);
            onChange(index, { child_id: e.target.value, child_name: c?.name || '' });
          }} style={{ marginBottom: 0 }}>
            <option value="">Select child…</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
          </select>
        </div>
      </div>

      {item.rate_type === 'flat' && (
        <div style={{ marginBottom: 8 }}>
          <label className="fl">End date</label>
          <input className="fi" type="date" value={item.end_date || ''} onChange={e => onChange(index, { end_date: e.target.value })} style={{ marginBottom: 0 }} min={item.service_date}/>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="fl">Type</label>
          <select className="fi" value={item.rate_type} onChange={e => onChange(index, { rate_type: e.target.value, hours: e.target.value === 'flat' ? null : item.hours })} style={{ marginBottom: 0 }}>
            <option value="hourly">Hourly</option>
            <option value="flat">Flat</option>
          </select>
        </div>
        {item.rate_type === 'hourly' && (
          <div>
            <label className="fl">Hours</label>
            <input className="fi" type="number" step="0.25" min="0" value={item.hours || ''} onChange={e => onChange(index, { hours: parseFloat(e.target.value) || 0 })} style={{ marginBottom: 0 }}/>
          </div>
        )}
        <div>
          <label className="fl">Rate ($)</label>
          <input className="fi" type="number" step="0.01" min="0" value={item.rate || ''} onChange={e => onChange(index, { rate: parseFloat(e.target.value) || 0 })} style={{ marginBottom: 0 }}/>
        </div>
        <div style={{ paddingBottom: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#88D8B8', textAlign: 'right', minWidth: 60 }}>
            {fmt(item.rate_type === 'hourly' ? (item.hours || 0) * item.rate : item.rate)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <input className="fi" value={item.description || ''} onChange={e => onChange(index, { description: e.target.value })} placeholder="Notes (optional)" style={{ marginBottom: 0, fontSize: 12, flex: 1, marginRight: 8 }}/>
        <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: .4, padding: 4, flexShrink: 0 }}>🗑️</button>
      </div>
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────

export function InvoiceModal({ open, onClose, sitterId, sitterName, families, allFamilyChildren, onSaved, editInvoice }) {
  const isEdit = !!editInvoice;

  const [familyId,     setFamilyId]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [dueDate,      setDueDate]      = useState('');
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [alert,        setAlert]        = useState(null);
  const [sessions,     setSessions]     = useState([]);
  const [showSessions, setShowSessions] = useState(false);

  function blankItem() {
    return { service_date: new Date().toISOString().slice(0, 10), end_date: '', child_id: '', child_name: '', rate_type: 'hourly', hours: 0, rate: 0, amount: 0, description: '' };
  }

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setFamilyId(editInvoice.family_id);
      setNotes(editInvoice.notes || '');
      setDueDate(editInvoice.due_date || '');
      supabase.from('invoice_items').select('*').eq('invoice_id', editInvoice.id).order('sort_order')
        .then(({ data }) => setItems(data || []));
    } else {
      setFamilyId(families[0]?.id || '');
      setNotes('');
      setDueDate('');
      setItems([blankItem()]);
    }
    setAlert(null);
  }, [open, editInvoice]);

  useEffect(() => {
    if (!familyId || isEdit) return;
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    supabase.from('sessions')
      .select('*,children:child_id(id,name,avatar)')
      .eq('family_id', familyId).eq('is_open', false)
      .gte('checked_in_at', monthAgo.toISOString())
      .order('checked_in_at', { ascending: false })
      .then(({ data }) => setSessions(data || []));
  }, [familyId]);

  function updateItem(i, patch) {
    setItems(its => its.map((it, idx) => {
      if (idx !== i) return it;
      const merged = { ...it, ...patch };
      // Coerce to numbers — input fields hand back strings before parseFloat fires
      const hours = parseFloat(merged.hours) || 0;
      const rate  = parseFloat(merged.rate)  || 0;
      merged.amount = merged.rate_type === 'hourly' ? hours * rate : rate;
      return merged;
    }));
  }

  function importSessions() {
    const imported = sessions.map(s => ({
      service_date: s.checked_in_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      end_date:     s.checked_out_at?.slice(0, 10) || '',
      child_id:     s.child_id || '',
      child_name:   s.children?.name || '',
      rate_type:    'hourly',
      hours:        Math.round((s.hours || 0) * 100) / 100,
      rate:         0,
      amount:       0,
      description:  `${s.children?.name || 'Child'} · ${fmtDateTime(s.checked_in_at)} ${fmtTime(s.checked_in_at)}–${fmtTime(s.checked_out_at)}`,
    }));
    setItems(imported.length ? imported : [blankItem()]);
    setShowSessions(false);
    setAlert({ t: 'i', m: `Imported ${imported.length} session${imported.length !== 1 ? 's' : ''}. Fill in the hourly rate for each.` });
  }

  async function save(status = 'draft') {
    if (!familyId)      { setAlert({ t: 'e', m: 'Select a family.' }); return; }
    if (!items.length)  { setAlert({ t: 'e', m: 'Add at least one line item.' }); return; }
    const unset = items.find(it => !it.child_id || !it.service_date || (it.rate_type === 'hourly' && !it.hours) || !it.rate);
    if (unset)          { setAlert({ t: 'e', m: 'Fill in all line item fields.' }); return; }

    setLoading(true);
    setAlert(null);
    try {
      let invId = editInvoice?.id;

      if (!isEdit) {
        const { data: numData } = await supabase.rpc('next_invoice_number', { p_sitter_id: sitterId });
        const { data: inv, error: invErr } = await supabase.from('invoices').insert({
          invoice_number: numData, family_id: familyId, sitter_id: sitterId,
          status, notes: notes || null, due_date: dueDate || null,
        }).select().single();
        if (invErr) throw invErr;
        invId = inv.id;

        const total        = items.reduce((s, it) => s + (it.amount || 0), 0);
        const fmtTotal     = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
        const selectedFam  = families.find(f => f.id === familyId);
        invokeNotification({ body: { type: 'new_invoice', payload: { familyId, sitterName, invoiceNumber: numData, amount: fmtTotal, familyName: selectedFam?.name || '' } } });
        supabase.from('members').select('user_id').eq('family_id', familyId).in('role', ['admin', 'member']).eq('status', 'active')
          .then(({ data: mems }) => {
            const ids = (mems || []).map(m => m.user_id).filter(Boolean);
            sendPushNotification(ids, `New invoice from ${sitterName}`, `${fmtTotal} — tap to view`, '/?portal=parent', 'new_invoice');
          });
      } else {
        const { error } = await supabase.from('invoices').update({ status, notes: notes || null, due_date: dueDate || null }).eq('id', invId);
        if (error) throw error;
        await supabase.from('invoice_items').delete().eq('invoice_id', invId);
      }

      const { error: itemErr } = await supabase.from('invoice_items').insert(
        items.map((it, i) => ({
          invoice_id:   invId,
          service_date: it.service_date,
          end_date:     it.end_date || null,
          child_id:     it.child_id || null,
          child_name:   it.child_name,
          rate_type:    it.rate_type,
          hours:        it.hours || null,
          rate:         it.rate,
          amount:       it.amount,
          description:  it.description || null,
          sort_order:   i,
        }))
      );
      if (itemErr) throw itemErr;
      onSaved();
      onClose();
    } catch (err) {
      setAlert({ t: 'e', m: err.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  const total          = items.reduce((s, it) => s + (it.amount || 0), 0);
  const familyChildren = allFamilyChildren[familyId] || [];

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
        {isEdit ? 'Edit Invoice' : 'New Invoice'}
      </div>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      <div style={{ marginBottom: 14 }}>
        <label className="fl">Family</label>
        <select className="fi" value={familyId} onChange={e => setFamilyId(e.target.value)} disabled={isEdit}>
          {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div>
          <label className="fl">Due date (optional)</label>
          <input className="fi" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ marginBottom: 0 }}/>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <SectionLabel>Line Items</SectionLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="bp" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setItems(its => [...its, blankItem()])}>+ Add Item</button>
            {!isEdit && sessions.length > 0 && (
              <button type="button" className="bg" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setShowSessions(!showSessions)}>
                📋 Import Sessions ({sessions.length})
              </button>
            )}
          </div>
        </div>

        {showSessions && (
          <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-dim)' }}>Recent sessions (last 30 days)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
              {sessions.map(s => (
                <div key={s.checkin_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 11 }}>
                  <span style={{ fontSize: 16 }}>{s.children?.avatar || '🧒'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{s.children?.name}</span>
                    <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>{fmtDateTime(s.checked_in_at)} · {fmtHours(s.hours)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="bp" style={{ width: '100%', fontSize: 12 }} onClick={importSessions}>
              Import All as Line Items
            </button>
          </div>
        )}

        {items.map((it, i) => (
          <LineItemRow key={i} item={it} index={i} children={familyChildren} onChange={updateItem} onRemove={i => setItems(its => its.filter((_, idx) => idx !== i))}/>
        ))}
        <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#88D8B8', marginTop: 8 }}>Total: {fmt(total)}</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="fl">Notes (optional)</label>
        <textarea className="fi" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes…" style={{ resize: 'vertical', marginBottom: 0 }}/>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="bp" onClick={() => save('draft')} disabled={loading}>{loading ? <Spinner/> : 'Save Draft'}</button>
        <button className="bp" onClick={() => save('sent')} disabled={loading} style={{ background: 'linear-gradient(135deg,#3A9E7A,#2A7A5A)' }}>{loading ? <Spinner/> : 'Save & Send'}</button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
