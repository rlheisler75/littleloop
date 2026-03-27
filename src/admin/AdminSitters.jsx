import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, AdminTable, AdminSearch, Badge, Btn, AdminModal, AdminConfirm, AdminField, AdminSpinner } from '../AdminUI';

export default function AdminSitters({ adminRole }) {
  const [sitters,  setSitters]  = useState([]);
  const [families, setFamilies] = useState({});  // sitter_id → [family names]
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);  // sitter being edited
  const [confirm,  setConfirm]  = useState(null);  // { action, sitter }
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Edit form state
  const [editName,  setEditName]  = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: sittersData } = await supabase
      .from('sitters')
      .select('id,name,email,created_at,onboarded')
      .order('name');

    if (sittersData?.length) {
      const { data: fsRows } = await supabase
        .from('family_sitters')
        .select('sitter_id,status,families(name)')
        .in('sitter_id', sittersData.map(s => s.id))
        .neq('status', 'inactive');

      const fmap = {};
      (fsRows || []).forEach(r => {
        if (!fmap[r.sitter_id]) fmap[r.sitter_id] = [];
        fmap[r.sitter_id].push({ name: r.families?.name, status: r.status });
      });
      setFamilies(fmap);
    }

    setSitters(sittersData || []);
    setLoading(false);
  }

  function openEdit(sitter) {
    setSelected(sitter);
    setEditName(sitter.name || '');
    setEditEmail(sitter.email || '');
    setAlert(null);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('sitters')
      .update({ name: editName.trim(), email: editEmail.trim() })
      .eq('id', selected.id);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Saved.' });
    setSitters(prev => prev.map(s => s.id === selected.id ? { ...s, name: editName.trim(), email: editEmail.trim() } : s));
    setTimeout(() => { setSelected(null); setAlert(null); }, 800);
  }

  async function deleteSitter() {
    const sitter = confirm.sitter;
    setConfirm(null);
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { userId: sitter.id, type: 'sitter' },
      headers: { 'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || '' },
    });
    if (error) {
      // Fallback: delete from sitters table directly (cascade handles the rest)
      await supabase.from('sitters').delete().eq('id', sitter.id);
    }
    setSitters(prev => prev.filter(s => s.id !== sitter.id));
  }

  async function resendInvites(sitter) {
    // Get all pending families for this sitter and resend
    const { data: pending } = await supabase.from('family_sitters')
      .select('families(id,name,admin_email)')
      .eq('sitter_id', sitter.id)
      .eq('status', 'pending');

    if (!pending?.length) { alert('No pending families to re-invite.'); return; }

    for (const row of pending) {
      await supabase.functions.invoke('send-invite', {
        body: { familyName: row.families.name, parentEmail: row.families.admin_email, sitterName: sitter.name, sitterId: sitter.id }
      });
    }
    alert(`Re-sent invites to ${pending.length} family${pending.length !== 1 ? 's' : ''}.`);
  }

  const filtered = sitters.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <AdminSpinner/>;

  return (
    <div>
      <AdminHeader title="Sitters" subtitle={`${sitters.length} total`}
        action={<AdminSearch value={search} onChange={setSearch} placeholder="Search sitters…"/>}
      />

      <AdminTable
        columns={[
          { key: 'name',      label: 'Name' },
          { key: 'email',     label: 'Email' },
          { key: 'onboarded', label: 'Onboarded', render: v => v ? '✅' : '⏳' },
          { key: 'families',  label: 'Families', render: (_, row) => {
            const fams = families[row.id] || [];
            if (!fams.length) return <span style={{ color: 'rgba(255,255,255,.25)' }}>None</span>;
            return fams.map(f => f.name).join(', ');
          }},
          { key: 'created_at', label: 'Joined', render: v => new Date(v).toLocaleDateString() },
          { key: 'actions', label: '', render: (_, row) => (
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <Btn onClick={() => openEdit(row)}>Edit</Btn>
              <Btn variant="ghost" onClick={() => resendInvites(row)}>Resend</Btn>
              {adminRole === 'super' && <Btn variant="danger" onClick={() => setConfirm({ action: 'delete', sitter: row })}>Delete</Btn>}
            </div>
          )},
        ]}
        rows={filtered}
      />

      {/* Edit modal */}
      <AdminModal open={!!selected} onClose={() => setSelected(null)} title={`Edit sitter — ${selected?.name}`}>
        {alert && (
          <div style={{ padding: '8px 12px', borderRadius: 7, marginBottom: 14, fontSize: 12, background: alert.t === 'e' ? 'rgba(192,80,80,.12)' : 'rgba(58,158,122,.12)', color: alert.t === 'e' ? '#F5AAAA' : '#88D8B8', border: `1px solid ${alert.t === 'e' ? 'rgba(192,80,80,.25)' : 'rgba(58,158,122,.25)'}` }}>
            {alert.m}
          </div>
        )}

        <AdminField label="Display name" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name"/>
        <AdminField label="Email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@example.com"/>

        {/* Families overview */}
        {selected && (families[selected.id] || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Connected families</div>
            {(families[selected.id] || []).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 7, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{f.name}</span>
                <Badge status={f.status}/>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn size="md" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
          <Btn size="md" variant="ghost" onClick={() => setSelected(null)}>Cancel</Btn>
        </div>
      </AdminModal>

      {/* Delete confirm */}
      <AdminConfirm
        open={confirm?.action === 'delete'}
        title="Delete sitter account?"
        message={`This will permanently delete ${confirm?.sitter?.name}'s account, all their invoices, posts, and family connections. This cannot be undone.`}
        danger
        onConfirm={deleteSitter}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
