import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminHeader, AdminTable, AdminSearch, Badge, Btn, AdminModal, AdminConfirm, AdminField, AdminSpinner } from '../AdminUI';

const ROLE_LABELS = { admin: 'Admin', member: 'Member', feed_only: 'Feed Only', pickup: 'Pickup' };

export default function AdminFamilies({ adminRole }) {
  const [families, setFamilies] = useState([]);
  const [members,  setMembers]  = useState({});  // family_id → members[]
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Edit state
  const [editName,  setEditName]  = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus,setEditStatus]= useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: fams } = await supabase
      .from('families')
      .select('id,name,admin_email,status,created_at,icon')
      .order('name');

    if (fams?.length) {
      const { data: mems } = await supabase
        .from('members')
        .select('id,family_id,name,email,role,status,user_id')
        .in('family_id', fams.map(f => f.id));
      const mmap = {};
      (mems || []).forEach(m => { if (!mmap[m.family_id]) mmap[m.family_id] = []; mmap[m.family_id].push(m); });
      setMembers(mmap);
    }

    setFamilies(fams || []);
    setLoading(false);
  }

  function openEdit(family) {
    setSelected(family);
    setEditName(family.name || '');
    setEditEmail(family.admin_email || '');
    setEditStatus(family.status || 'pending');
    setAlert(null);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('families').update({
      name: editName.trim(), admin_email: editEmail.trim(), status: editStatus,
    }).eq('id', selected.id);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Saved.' });
    setFamilies(prev => prev.map(f => f.id === selected.id ? { ...f, name: editName.trim(), admin_email: editEmail.trim(), status: editStatus } : f));
    setTimeout(() => { setSelected(null); setAlert(null); }, 800);
  }

  async function changeRole(memberId, newRole) {
    await supabase.from('members').update({ role: newRole }).eq('id', memberId);
    setMembers(prev => {
      const updated = { ...prev };
      for (const fid in updated) {
        updated[fid] = updated[fid].map(m => m.id === memberId ? { ...m, role: newRole } : m);
      }
      return updated;
    });
  }

  async function resendMemberInvite(member) {
    const family = families.find(f => f.id === member.family_id);
    const { data: sitter } = await supabase.from('family_sitters')
      .select('sitters(name,id)')
      .eq('family_id', member.family_id).eq('status', 'active').limit(1).maybeSingle();

    await supabase.functions.invoke('send-member-invite', {
      body: { memberEmail: member.email, memberName: member.name, familyName: family?.name, inviterName: sitter?.sitters?.name || 'Your sitter', inviteToken: member.invite_token }
    });
    alert(`Invite resent to ${member.email}`);
  }

  async function deleteFamily() {
    const family = confirm.family;
    setConfirm(null);
    // Delete cascade: members, children, family_sitters all reference family
    await supabase.from('families').delete().eq('id', family.id);
    setFamilies(prev => prev.filter(f => f.id !== family.id));
  }

  async function deleteMember(member) {
    await supabase.from('members').delete().eq('id', member.id);
    setMembers(prev => ({
      ...prev,
      [member.family_id]: (prev[member.family_id] || []).filter(m => m.id !== member.id),
    }));
  }

  const filtered = families.filter(f =>
    !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.admin_email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <AdminSpinner/>;

  return (
    <div>
      <AdminHeader title="Families" subtitle={`${families.length} total`}
        action={<AdminSearch value={search} onChange={setSearch} placeholder="Search families…"/>}
      />

      <AdminTable
        columns={[
          { key: 'icon',        label: '',        render: v => <span style={{ fontSize: 20 }}>{v || '👨‍👩‍👧'}</span> },
          { key: 'name',        label: 'Family' },
          { key: 'admin_email', label: 'Admin email' },
          { key: 'status',      label: 'Status',  render: v => <Badge status={v}/> },
          { key: 'members',     label: 'Members', render: (_, row) => (members[row.id] || []).length },
          { key: 'created_at',  label: 'Created', render: v => new Date(v).toLocaleDateString() },
          { key: 'actions',     label: '', render: (_, row) => (
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <Btn onClick={() => openEdit(row)}>Edit</Btn>
              {adminRole === 'super' && <Btn variant="danger" onClick={() => setConfirm({ action: 'delete', family: row })}>Delete</Btn>}
            </div>
          )},
        ]}
        rows={filtered}
      />

      {/* Edit / detail modal */}
      <AdminModal open={!!selected} onClose={() => setSelected(null)} title={`Family — ${selected?.name}`} width={560}>
        {alert && (
          <div style={{ padding: '8px 12px', borderRadius: 7, marginBottom: 14, fontSize: 12, background: alert.t === 'e' ? 'rgba(192,80,80,.12)' : 'rgba(58,158,122,.12)', color: alert.t === 'e' ? '#F5AAAA' : '#88D8B8', border: `1px solid ${alert.t === 'e' ? 'rgba(192,80,80,.25)' : 'rgba(58,158,122,.25)'}` }}>
            {alert.m}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <AdminField label="Family name" value={editName} onChange={e => setEditName(e.target.value)}/>
          <AdminField label="Admin email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}/>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Status</label>
          <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
            style={{ padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E4EAF4', fontSize: 13, outline: 'none', width: '100%' }}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <Btn size="md" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
          <Btn size="md" variant="ghost" onClick={() => setSelected(null)}>Cancel</Btn>
        </div>

        {/* Members list */}
        {selected && (members[selected.id] || []).length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Members</div>
            {(members[selected.id] || []).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{m.email}</div>
                </div>
                <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                  style={{ padding: '4px 8px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: '#E4EAF4', fontSize: 11, cursor: 'pointer' }}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Badge status={m.status}/>
                {m.status === 'pending' && <Btn variant="ghost" onClick={() => resendMemberInvite(m)}>Resend</Btn>}
                {m.role !== 'admin' && <Btn variant="danger" onClick={() => deleteMember(m)}>Remove</Btn>}
              </div>
            ))}
          </div>
        )}
      </AdminModal>

      <AdminConfirm
        open={confirm?.action === 'delete'}
        title="Delete family?"
        message={`This will permanently delete "${confirm?.family?.name}", all their members, children, and data. Cannot be undone.`}
        danger
        onConfirm={deleteFamily}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
