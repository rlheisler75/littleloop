import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, AdminTable, AdminSearch, Badge, Btn, AdminModal, AdminConfirm, AdminSpinner } from '../AdminUI';

const STATUS_OPTIONS = ['draft', 'sent', 'paid'];

export default function AdminInvoices({ adminRole }) {
  const [invoices, setInvoices] = useState([]);
  const [items,    setItems]    = useState({});  // invoice_id → items[]
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('id,invoice_number,status,issued_date,due_date,paid_date,notes,family_id,sitter_id,families(name),sitters(name)')
      .order('invoice_number');
    setInvoices(data || []);
    setLoading(false);
  }

  async function openDetail(invoice) {
    setSelected(invoice);
    setAlert(null);
    if (!items[invoice.id]) {
      const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order');
      setItems(prev => ({ ...prev, [invoice.id]: data || [] }));
    }
  }

  async function changeStatus(invoiceId, newStatus) {
    setSaving(true);
    const patch = { status: newStatus };
    if (newStatus === 'paid') patch.paid_date = new Date().toISOString().slice(0, 10);
    if (newStatus !== 'paid') patch.paid_date = null;
    const { error } = await supabase.from('invoices').update(patch).eq('id', invoiceId);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, ...patch } : i));
    if (selected?.id === invoiceId) setSelected(prev => ({ ...prev, ...patch }));
    setAlert({ t: 's', m: 'Status updated.' });
    setTimeout(() => setAlert(null), 2000);
  }

  async function updateItemAmount(itemId, newAmount) {
    const amount = parseFloat(newAmount) || 0;
    await supabase.from('invoice_items').update({ amount, rate: amount }).eq('id', itemId);
    setItems(prev => ({
      ...prev,
      [selected.id]: (prev[selected.id] || []).map(it => it.id === itemId ? { ...it, amount, rate: amount } : it),
    }));
  }

  async function deleteInvoice() {
    const inv = confirm.invoice;
    setConfirm(null);
    await supabase.from('invoice_items').delete().eq('invoice_id', inv.id);
    await supabase.from('invoices').delete().eq('id', inv.id);
    setInvoices(prev => prev.filter(i => i.id !== inv.id));
    if (selected?.id === inv.id) setSelected(null);
  }

  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  const invoiceTotal = (invoice) => {
    const its = items[invoice.id] || [];
    return its.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  };

  const filtered = invoices
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => !search ||
      i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.families?.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.sitters?.name?.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return <AdminSpinner/>;

  return (
    <div>
      <AdminHeader title="Invoices" subtitle={`${invoices.length} total`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['all', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `1px solid ${filter === s ? '#7BAAEE' : 'rgba(255,255,255,.12)'}`, background: filter === s ? 'rgba(58,111,212,.2)' : 'transparent', color: filter === s ? '#7BAAEE' : 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
            <AdminSearch value={search} onChange={setSearch} placeholder="Search invoices…"/>
          </div>
        }
      />

      <AdminTable
        columns={[
          { key: 'invoice_number', label: 'Invoice' },
          { key: 'sitters',        label: 'Sitter',  render: v => v?.name || '—' },
          { key: 'families',       label: 'Family',  render: v => v?.name || '—' },
          { key: 'status',         label: 'Status',  render: v => <Badge status={v}/> },
          { key: 'issued_date',    label: 'Issued',  render: v => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—' },
          { key: 'paid_date',      label: 'Paid',    render: v => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—' },
          { key: 'actions',        label: '', render: (_, row) => (
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <Btn onClick={() => openDetail(row)}>View</Btn>
              {adminRole === 'super' && row.status !== 'paid' && (
                <Btn variant="danger" onClick={() => setConfirm({ action: 'delete', invoice: row })}>Delete</Btn>
              )}
            </div>
          )},
        ]}
        rows={filtered}
        onRowClick={openDetail}
      />

      {/* Invoice detail modal */}
      <AdminModal open={!!selected} onClose={() => setSelected(null)} title={`${selected?.invoice_number} — ${selected?.families?.name}`} width={600}>
        {alert && (
          <div style={{ padding: '8px 12px', borderRadius: 7, marginBottom: 14, fontSize: 12, background: alert.t === 'e' ? 'rgba(192,80,80,.12)' : 'rgba(58,158,122,.12)', color: alert.t === 'e' ? '#F5AAAA' : '#88D8B8', border: `1px solid ${alert.t === 'e' ? 'rgba(192,80,80,.25)' : 'rgba(58,158,122,.25)'}` }}>
            {alert.m}
          </div>
        )}

        {/* Header info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            ['Sitter',   selected?.sitters?.name],
            ['Family',   selected?.families?.name],
            ['Issued',   selected?.issued_date ? new Date(selected.issued_date + 'T00:00:00').toLocaleDateString() : '—'],
            ['Due',      selected?.due_date ? new Date(selected.due_date + 'T00:00:00').toLocaleDateString() : '—'],
            ['Paid',     selected?.paid_date ? new Date(selected.paid_date + 'T00:00:00').toLocaleDateString() : '—'],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13 }}>{val || '—'}</div>
            </div>
          ))}
          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Status</div>
            <Badge status={selected?.status}/>
          </div>
        </div>

        {/* Status change */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Change status</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <Btn key={s} variant={selected?.status === s ? 'primary' : 'ghost'} disabled={saving || selected?.status === s}
                onClick={() => changeStatus(selected.id, s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Btn>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Line items</div>
          {(selected && items[selected.id] || []).length === 0
            ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '12px 0' }}>No line items</div>
            : (selected && items[selected.id] || []).map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{it.child_name} · {it.rate_type}</div>
                  {it.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{it.description}</div>}
                </div>
                {it.rate_type === 'hourly' && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{it.hours}h</span>}
                <input
                  type="number" step="0.01" defaultValue={Math.abs(parseFloat(it.amount) || 0)}
                  onBlur={e => updateItemAmount(it.id, it.rate_type === 'credit' ? -Math.abs(parseFloat(e.target.value)) : e.target.value)}
                  style={{ width: 90, padding: '4px 8px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: it.rate_type === 'credit' ? '#88D8B8' : '#E4EAF4', fontSize: 13, textAlign: 'right' }}
                />
              </div>
            ))
          }
          {selected && items[selected.id]?.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#7BAAEE', marginTop: 8 }}>
              Total: {fmt(invoiceTotal(selected))}
            </div>
          )}
        </div>

        {adminRole === 'super' && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
            <Btn variant="danger" onClick={() => { setSelected(null); setConfirm({ action: 'delete', invoice: selected }); }}>Delete invoice</Btn>
          </div>
        )}
      </AdminModal>

      <AdminConfirm
        open={confirm?.action === 'delete'}
        title="Delete invoice?"
        message={`Delete ${confirm?.invoice?.invoice_number}? This removes all line items and cannot be undone.`}
        danger
        onConfirm={deleteInvoice}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
