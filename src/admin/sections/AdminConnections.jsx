import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, AdminTable, AdminSearch, Badge, Btn, AdminModal, AdminConfirm, AdminSpinner } from '../AdminUI';

const STATUS_OPTIONS = ['pending', 'active', 'inactive'];

export default function AdminConnections({ adminRole }) {
  const [connections, setConnections] = useState([]);
  const [sitters,     setSitters]     = useState([]);
  const [families,    setFamilies]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [confirm,     setConfirm]     = useState(null);
  const [showManual,  setShowManual]  = useState(false);
  const [manualSitter,setManualSitter]= useState('');
  const [manualFamily,setManualFamily]= useState('');
  const [saving,      setSaving]      = useState(false);
  const [alert,       setAlert]       = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: conns }, { data: sits }, { data: fams }] = await Promise.all([
      supabase.from('family_sitters')
        .select('id,status,joined_at,family_id,sitter_id,families(name,admin_email),sitters(name,email)')
        .order('joined_at', { ascending: false }),
      supabase.from('sitters').select('id,name').order('name'),
      supabase.from('families').select('id,name').order('name'),
    ]);
    setConnections(conns || []);
    setSitters(sits || []);
    setFamilies(fams || []);
    setLoading(false);
  }

  async function changeStatus(connId, newStatus) {
    await supabase.from('family_sitters').update({ status: newStatus }).eq('id', connId);
    setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: newStatus } : c));
  }

  async function deleteConnection() {
    const conn = confirm.conn;
    setConfirm(null);
    await supabase.from('family_sitters').delete().eq('id', conn.id);
    setConnections(prev => prev.filter(c => c.id !== conn.id));
  }

  async function createConnection() {
    if (!manualSitter || !manualFamily) return;
    setSaving(true);
    setAlert(null);
    // Check if already exists
    const { data: existing } = await supabase.from('family_sitters')
      .select('id,status')
      .eq('sitter_id', manualSitter)
      .eq('family_id', manualFamily)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        setAlert({ t: 'w', m: 'This connection already exists and is active.' });
        setSaving(false);
        return;
      }
      // Reactivate
      await supabase.from('family_sitters').update({ status: 'active' }).eq('id', existing.id);
    } else {
      await supabase.from('family_sitters').insert({
        sitter_id: manualSitter, family_id: manualFamily, status: 'active',
        joined_at: new Date().toISOString(),
      });
    }
    setSaving(false);
    setShowManual(false);
    setManualSitter('');
    setManualFamily('');
    load();
  }

  const filtered = connections
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => !search ||
      c.families?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.sitters?.name?.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return <AdminSpinner/>;

  return (
    <div>
      <AdminHeader title="Connections" subtitle={`${connections.length} family↔sitter links`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['all', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `1px solid ${filter === s ? '#7BAAEE' : 'rgba(255,255,255,.12)'}`, background: filter === s ? 'rgba(58,111,212,.2)' : 'transparent', color: filter === s ? '#7BAAEE' : 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
            <AdminSearch value={search} onChange={setSearch} placeholder="Search…"/>
            <Btn size="md" onClick={() => { setShowManual(true); setAlert(null); }}>+ Connect</Btn>
          </div>
        }
      />

      <AdminTable
        columns={[
          { key: 'sitters',   label: 'Sitter',  render: v => v?.name || '—' },
          { key: 'families',  label: 'Family',  render: v => v?.name || '—' },
          { key: 'status',    label: 'Status',  render: v => <Badge status={v}/> },
          { key: 'joined_at', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
          { key: 'actions',   label: '', render: (_, row) => (
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              {STATUS_OPTIONS.filter(s => s !== row.status).map(s => (
                <Btn key={s} variant={s === 'active' ? 'success' : s === 'inactive' ? 'ghost' : 'ghost'}
                  onClick={() => changeStatus(row.id, s)}>
                  → {s.charAt(0).toUpperCase() + s.slice(1)}
                </Btn>
              ))}
              {adminRole === 'super' && (
                <Btn variant="danger" onClick={() => setConfirm({ action: 'delete', conn: row })}>Remove</Btn>
              )}
            </div>
          )},
        ]}
        rows={filtered}
      />

      {/* Manual connect modal */}
      <AdminModal open={showManual} onClose={() => setShowManual(false)} title="Manually connect sitter to family" width={420}>
        {alert && (
          <div style={{ padding: '8px 12px', borderRadius: 7, marginBottom: 14, fontSize: 12, background: 'rgba(200,120,74,.12)', color: '#F5C098', border: '1px solid rgba(200,120,74,.25)' }}>
            {alert.m}
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Sitter</label>
          <select value={manualSitter} onChange={e => setManualSitter(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none' }}>
            <option value="">Select a sitter…</option>
            {sitters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Family</label>
          <select value={manualFamily} onChange={e => setManualFamily(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none' }}>
            <option value="">Select a family…</option>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn size="md" onClick={createConnection} disabled={saving || !manualSitter || !manualFamily}>
            {saving ? 'Connecting…' : 'Create connection'}
          </Btn>
          <Btn size="md" variant="ghost" onClick={() => setShowManual(false)}>Cancel</Btn>
        </div>
      </AdminModal>

      <AdminConfirm
        open={confirm?.action === 'delete'}
        title="Remove connection?"
        message={`Remove the link between ${confirm?.conn?.sitters?.name} and ${confirm?.conn?.families?.name}? The sitter will lose access to this family's data.`}
        danger
        onConfirm={deleteConnection}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
