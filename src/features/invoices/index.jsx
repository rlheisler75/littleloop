import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { fmt, fmtDate, printInvoice } from '../../services/format';
import { PAYMENT_TYPES } from '../../lib/constants';
import { InvoiceModal } from '../../components/modals/InvoiceModal';
import PaymentSettingsModal from '../../components/modals/PaymentSettingsModal';
import { Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// ─── Pay Buttons (family side) ────────────────────────────────────────────────

export function PayButtons({ sitter, invoice }) {
  const [items,      setItems]      = useState(null);
  const [payMethods, setPayMethods] = useState(sitter?.payment_methods || null);

  useEffect(() => {
    supabase.from('invoice_items').select('amount,hours,rate,rate_type').eq('invoice_id', invoice.id)
      .then(({ data }) => setItems(data || []));
  }, [invoice.id]);

  useEffect(() => {
    if (payMethods || !invoice.sitter_id) return;
    supabase.from('sitters').select('payment_methods').eq('id', invoice.sitter_id).single()
      .then(({ data }) => { if (data) setPayMethods(data.payment_methods || []); });
  }, [invoice.sitter_id]);

  const total   = items ? items.reduce((s, i) => s + (parseFloat(i.amount) || (i.rate_type === 'hourly' ? parseFloat(i.hours || 0) * parseFloat(i.rate || 0) : parseFloat(i.rate || 0))), 0) : 0;
  const enabled = (payMethods || []).filter(m => m.enabled);
  if (!enabled.length || !items) return null;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Pay {fmt(total)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {enabled.map(m => {
          const pt      = PAYMENT_TYPES.find(p => p.id === m.type);
          if (!pt) return null;
          const link    = pt.deeplink ? pt.deeplink(m.handle, total.toFixed(2), invoice.invoice_number) : null;
          const weblink = pt.weblink  ? pt.weblink(m.handle, total.toFixed(2), invoice.invoice_number) : link;
          const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
          const href     = (isMobile && link) ? link : (weblink || link);
          return href
            ? <a key={m.type} href={href} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'rgba(255,255,255,.8)', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                {pt.icon} {pt.label}{m.handle ? ` (${m.handle})` : ''}
              </a>
            : <div key={m.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>
                {pt.icon} {pt.label}{m.handle ? `: ${m.handle}` : ''}
              </div>;
        })}
      </div>
    </div>
  );
}

// ─── Sitter Invoices Tab ──────────────────────────────────────────────────────

export function SitterInvoicesTab({ sitterId, sitterName }) {
  const [invoices,       setInvoices]       = useState([]);
  const [families,       setFamilies]       = useState([]);
  const [familyChildren, setFamilyChildren] = useState({});
  const [familyMembers,  setFamilyMembers]  = useState({});
  const [sitter,         setSitter]         = useState(null);
  const [showNew,        setShowNew]        = useState(false);
  const [editInv,        setEditInv]        = useState(null);
  const [showSettings,   setShowSettings]   = useState(false);
  const [filter,         setFilter]         = useState('all');
  const [loading,        setLoading]        = useState(true);
  const [confirmPaid,    setConfirmPaid]    = useState(null);
  const [confirmUnpaid,  setConfirmUnpaid]  = useState(null);
  const [reminderSent,   setReminderSent]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: fams }, { data: invs }, { data: sit }] = await Promise.all([
      supabase.from('family_sitters').select('status,families(*)').eq('sitter_id', sitterId).neq('status', 'inactive'),
      supabase.from('invoices').select('*').eq('sitter_id', sitterId).order('created_at', { ascending: false }),
      supabase.from('sitters').select('*').eq('id', sitterId).single(),
    ]);
    const unwrapped = (fams || []).map(r => ({ ...r.families, connection_status: r.status })).filter(Boolean);
    setFamilies(unwrapped);
    setInvoices(invs || []);
    setSitter(sit ? { ...sit, name: sit.name || sitterName || 'Care Provider' } : { name: sitterName || 'Care Provider' });
    if (unwrapped.length) {
      const [{ data: kids }, { data: mems }] = await Promise.all([
        supabase.from('children').select('*').in('family_id', unwrapped.map(f => f.id)),
        supabase.from('members').select('*').in('family_id', unwrapped.map(f => f.id)),
      ]);
      const kg = {}, mg = {};
      (kids || []).forEach(k => { if (!kg[k.family_id]) kg[k.family_id] = []; kg[k.family_id].push(k); });
      (mems || []).forEach(m => { if (!mg[m.family_id]) mg[m.family_id] = []; mg[m.family_id].push(m); });
      setFamilyChildren(kg);
      setFamilyMembers(mg);
    }
    setLoading(false);
  }, [sitterId]);

  useEffect(() => { load(); }, [load]);

  async function markPaid(inv) {
    await supabase.from('invoices').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }).eq('id', inv.id);
    setConfirmPaid(null);
    invokeNotification({ body: { type: 'invoice_paid', payload: { familyId: inv.family_id, invoiceNumber: inv.invoice_number, sitterName } } });
    supabase.from('members').select('user_id').eq('family_id', inv.family_id).in('role', ['admin', 'member']).eq('status', 'active')
      .then(({ data: mems }) => {
        const ids = (mems || []).map(m => m.user_id).filter(Boolean);
        if (ids.length) sendPushNotification(ids, 'Invoice marked paid ✅', `Invoice ${inv.invoice_number} has been marked as paid.`, '/?portal=parent', 'invoice_paid');
      });
    load();
  }

  async function unmarkPaid(inv) {
    await supabase.from('invoices').update({ status: 'sent', paid_date: null }).eq('id', inv.id);
    setConfirmUnpaid(null);
    load();
  }

  async function sendReminder(inv) {
    const fam = families.find(f => f.id === inv.family_id);
    if (!fam) return;
    invokeNotification({ body: { type: 'invoice_reminder', payload: { familyEmail: fam.admin_email, familyName: fam.name, sitterName, invoiceNumber: inv.invoice_number, invoiceId: inv.id, dueDate: inv.due_date ? fmtDate(inv.due_date) : null } } });
    const { data: members } = await supabase.from('members').select('user_id').eq('family_id', fam.id).in('role', ['admin', 'member']);
    if (members?.length) sendPushNotification(members.map(m => m.user_id), `Invoice reminder from ${sitterName}`, `Invoice ${inv.invoice_number} is due`, '/?portal=parent', 'invoice_reminder');
    setReminderSent(inv.id);
    setTimeout(() => setReminderSent(null), 3000);
  }

  async function openPrint(inv) {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order');
    const family = families.find(f => f.id === inv.family_id) || { name: '—' };
    const admin  = (familyMembers[inv.family_id] || []).find(m => m.role === 'admin');
    printInvoice(inv, items || [], { ...(sitter || {}), name: sitter?.name || sitterName || 'Care Provider' }, family, admin);
  }

  const filtered     = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const statusColors = { draft: '#B0B8C8', sent: '#7BAAEE', paid: '#88D8B8' };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600 }}>Invoices</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="bg" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setShowSettings(true)}>⚙️ Settings</button>
          <button className="bp" onClick={() => setShowNew(true)}>+ New Invoice</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'draft', 'sent', 'paid'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${filter === s ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: filter === s ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: filter === s ? '#7BAAEE' : 'rgba(255,255,255,.4)', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="es"><div className="ic">💰</div><h3>No invoices yet</h3><p>Create your first invoice for a family.</p><button className="bp" onClick={() => setShowNew(true)}>+ Create Invoice</button></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(inv => {
              const fam = families.find(f => f.id === inv.family_id);
              return (
                <div key={inv.id} className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{inv.invoice_number}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${statusColors[inv.status]}22`, color: statusColors[inv.status], textTransform: 'capitalize' }}>{inv.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fam?.name} · Issued {fmtDate(inv.issued_date)}</div>
                      {inv.due_date  && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Due {fmtDate(inv.due_date)}</div>}
                      {inv.paid_date && <div style={{ fontSize: 11, color: '#88D8B8' }}>Paid {fmtDate(inv.paid_date)}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="bg" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openPrint(inv)}>🖨️ PDF</button>
                      {inv.status !== 'paid' && <button className="bg" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditInv(inv)}>✏️ Edit</button>}
                      {inv.status === 'sent' && <button className="bp" style={{ padding: '5px 10px', fontSize: 11, background: 'linear-gradient(135deg,#3A9E7A,#2A7A5A)' }} onClick={() => setConfirmPaid(inv)}>✅ Mark Paid</button>}
                      {inv.status === 'sent' && <button className="bg" style={{ padding: '5px 10px', fontSize: 11, color: reminderSent === inv.id ? '#5EE89A' : 'inherit' }} onClick={() => sendReminder(inv)}>{reminderSent === inv.id ? '✓ Sent!' : '🔔 Remind'}</button>}
                      {inv.status === 'paid' && <button className="bg" style={{ padding: '5px 10px', fontSize: 11, color: '#F5AAAA' }} onClick={() => setConfirmUnpaid(inv)}>↩ Unmark Paid</button>}
                      {inv.status === 'draft' && <button className="bd" style={{ padding: '5px 10px', fontSize: 11 }} onClick={async () => { await supabase.from('invoices').delete().eq('id', inv.id); load(); }}>🗑️</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      <InvoiceModal open={showNew || !!editInv} onClose={() => { setShowNew(false); setEditInv(null); }} sitterId={sitterId} sitterName={sitterName || ''} families={families} allFamilyChildren={familyChildren} onSaved={load} editInvoice={editInv || null}/>
      <PaymentSettingsModal open={showSettings} onClose={() => setShowSettings(false)} sitterId={sitterId} onSaved={load}/>
      <Confirm open={!!confirmPaid} title="Mark as paid?" message={`Mark ${confirmPaid?.invoice_number} as paid today?`} onConfirm={() => markPaid(confirmPaid)} onCancel={() => setConfirmPaid(null)}/>
      <Confirm open={!!confirmUnpaid} title="Unmark as paid?" message={`Mark ${confirmUnpaid?.invoice_number} back to sent? This will remove the paid date.`} danger onConfirm={() => unmarkPaid(confirmUnpaid)} onCancel={() => setConfirmUnpaid(null)}/>
    </div>
  );
}

// ─── Family Invoices Tab ──────────────────────────────────────────────────────

export function FamilyInvoicesTab({ familyId, currentUserId }) {
  const [invoices, setInvoices] = useState([]);
  const [sitter,   setSitter]   = useState(null);
  const [family,   setFamily]   = useState(null);
  const [member,   setMember]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: invs }, { data: fam }, { data: mem }, { data: fsRows }] = await Promise.all([
        supabase.from('invoices').select('*').eq('family_id', familyId).in('status', ['sent', 'paid']).order('created_at', { ascending: false }),
        supabase.from('families').select('*').eq('id', familyId).single(),
        supabase.from('members').select('*').eq('family_id', familyId).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('family_sitters').select('sitters(*)').eq('family_id', familyId).eq('status', 'active').limit(1),
      ]);
      setInvoices(invs || []);
      setFamily(fam);
      setSitter(fsRows?.[0]?.sitters || null);
      setMember(mem);
      setLoading(false);
    }
    load();
  }, [familyId, currentUserId]);

  async function openPrint(inv) {
    const [{ data: items }, { data: sit }] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order'),
      supabase.from('sitters').select('name,legal_name,address_line1,address_line2,city,state,zip').eq('id', inv.sitter_id).single(),
    ]);
    printInvoice(inv, items || [], sit || sitter || {}, family || { name: '—' }, member);
  }

  const statusColors = { sent: '#7BAAEE', paid: '#88D8B8' };
  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Invoices</div>
      {invoices.length === 0
        ? <div className="es"><div className="ic">💰</div><h3>No invoices yet</h3><p>Your sitter hasn't sent any invoices yet.</p></div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {invoices.map(inv => (
              <div key={inv.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{inv.invoice_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${statusColors[inv.status]}22`, color: statusColors[inv.status], textTransform: 'capitalize' }}>{inv.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Issued {fmtDate(inv.issued_date)}</div>
                    {inv.due_date  && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Due {fmtDate(inv.due_date)}</div>}
                    {inv.paid_date && <div style={{ fontSize: 11, color: '#88D8B8' }}>Paid {fmtDate(inv.paid_date)}</div>}
                  </div>
                  <button className="bg" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openPrint(inv)}>🖨️ PDF</button>
                </div>
                {inv.status === 'sent' && <PayButtons sitter={sitter} invoice={inv}/>}
                {inv.status === 'paid' && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(88,216,184,.1)', border: '1px solid rgba(88,216,184,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#88D8B8' }}>Payment Received</div>
                      {inv.paid_date && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Marked paid on {fmtDate(inv.paid_date)}</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
