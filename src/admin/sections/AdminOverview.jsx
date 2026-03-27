import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, StatCard, AdminTable, Badge, AdminSpinner } from '../AdminUI';

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [
      { count: sitterCount },
      { count: familyCount },
      { count: memberCount },
      { count: invoiceCount },
      { data: recentSitters },
      { data: pendingInvoices },
      { data: pendingConns },
    ] = await Promise.all([
      supabase.from('sitters').select('id', { count: 'exact', head: true }),
      supabase.from('families').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('invoices').select('id', { count: 'exact', head: true }),
      supabase.from('sitters').select('id,name,email,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('invoices').select('id,invoice_number,status,family_id,sitter_id,families(name)').eq('status', 'sent').order('created_at', { ascending: false }).limit(5),
      supabase.from('family_sitters').select('id,status,families(name),sitters(name)').eq('status', 'pending').limit(10),
    ]);

    setStats({ sitterCount, familyCount, memberCount, invoiceCount });
    setRecent({ recentSitters: recentSitters || [], pendingInvoices: pendingInvoices || [], pendingConns: pendingConns || [] });
    setLoading(false);
  }

  if (loading) return <AdminSpinner/>;

  return (
    <div>
      <AdminHeader title="Overview" subtitle="Platform health at a glance"/>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <StatCard label="Sitters" value={stats.sitterCount} color="#7BAAEE"/>
        <StatCard label="Families" value={stats.familyCount} color="#88D8B8"/>
        <StatCard label="Members" value={stats.memberCount} color="#F5C098"/>
        <StatCard label="Invoices" value={stats.invoiceCount} color="#CFA8FF"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent sitters */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 10 }}>Recent signups</div>
          <AdminTable
            columns={[
              { key: 'name',       label: 'Name' },
              { key: 'email',      label: 'Email' },
              { key: 'created_at', label: 'Joined', render: v => new Date(v).toLocaleDateString() },
            ]}
            rows={recent.recentSitters}
          />
        </div>

        {/* Pending invoices */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 10 }}>Unpaid invoices</div>
          <AdminTable
            columns={[
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'families',       label: 'Family', render: v => v?.name || '—' },
              { key: 'status',         label: 'Status', render: v => <Badge status={v}/> },
            ]}
            rows={recent.pendingInvoices}
          />
        </div>

        {/* Pending connections */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 10 }}>Pending connections</div>
          {recent.pendingConns.length === 0
            ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '20px 0' }}>No pending connections</div>
            : (
              <AdminTable
                columns={[
                  { key: 'sitters',  label: 'Sitter',  render: v => v?.name || '—' },
                  { key: 'families', label: 'Family',  render: v => v?.name || '—' },
                  { key: 'status',   label: 'Status',  render: v => <Badge status={v}/> },
                ]}
                rows={recent.pendingConns}
              />
            )
          }
        </div>
      </div>
    </div>
  );
}
