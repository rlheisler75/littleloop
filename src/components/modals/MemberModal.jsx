import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AVATARS, ROLE_LABELS } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import { Confirm } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

export default function MemberModal({
  open, onClose, familyId, familyName, member, adminName, onSaved, canEditRole = true,
}) {
  const isEdit = !!member;

  const [name,            setName]            = useState(member?.name || '');
  const [email,           setEmail]           = useState(member?.email || '');
  const [role,            setRole]            = useState(member?.role || 'member');
  const [avatar,          setAv]              = useState(member?.avatar || '👤');
  const [loading,         setLoading]         = useState(false);
  const [alert,           setAlert]           = useState(null);
  const [confirmDel,      setConfirmDel]      = useState(false);
  const [photoUrl,        setPhotoUrl]        = useState(member?.photo_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name || '');
      setEmail(member?.email || '');
      setRole(member?.role || 'member');
      setAv(member?.avatar || '👤');
      setPhotoUrl(member?.photo_url || null);
      setAlert(null);
    }
  }, [open, member]);

  async function save(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('members')
        .update({ name, role, avatar, photo_url: photoUrl })
        .eq('id', member.id));
    } else {
      const { data: newMem, error: insErr } = await supabase.from('members').insert({
        family_id: familyId, name, email, role, avatar, status: 'pending',
      }).select().single();
      error = insErr;
      if (!insErr && newMem) {
        await supabase.functions.invoke('send-member-invite', {
          body: { memberEmail: email, memberName: name, familyName, inviterName: adminName, inviteToken: newMem.invite_token },
        });
      }
    }
    setLoading(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    onSaved();
    onClose();
  }

  async function removeMember() {
    await supabase.from('members').delete().eq('id', member.id);
    onSaved();
    onClose();
    setConfirmDel(false);
  }

  async function handleAvatarUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB'); return; }
    setAvatarUploading(true);
    const ext  = f.name.split('.').pop();
    const path = `members/${member?.id || Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('member-avatars').upload(path, f, { upsert: true, contentType: f.type });
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('member-avatars').getPublicUrl(path);
      setPhotoUrl(urlData?.publicUrl || null);
    }
    setAvatarUploading(false);
  }

  return (
    <>
      <Modal open={open && !confirmDel} onClose={onClose}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
          {isEdit ? 'Edit Member' : 'Add Member'}
        </div>
        {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

        <form onSubmit={save}>
          <Field label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name"/>
          {!isEdit && <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="their@email.com"/>}

          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Avatar</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                {photoUrl
                  ? <img src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar"/>
                  : avatar
                }
              </div>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                  📷 Upload photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload}/>
                </label>
                {avatarUploading && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 8 }}><Spinner size={10}/> Uploading…</span>}
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl(null)}
                    style={{ marginLeft: 8, background: 'none', border: 'none', fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer', textDecoration: 'underline' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {!photoUrl && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AVATARS.map(a => (
                  <button key={a} type="button" onClick={() => setAv(a)}
                    style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${avatar === a ? '#7BAAEE' : 'rgba(255,255,255,.1)'}`, background: avatar === a ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 20 }}>
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {canEditRole && (
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Role</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(ROLE_LABELS).map(([r, l]) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${role === r ? '#7BAAEE' : 'rgba(255,255,255,.12)'}`, background: role === r ? 'rgba(111,163,232,.15)' : 'rgba(255,255,255,.04)', color: role === r ? '#7BAAEE' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-dim)' }}>Admin</strong> — full access ·{' '}
                <strong style={{ color: 'var(--text-dim)' }}>Member</strong> — view all ·{' '}
                <strong style={{ color: 'var(--text-dim)' }}>Feed Only</strong> — feed tab ·{' '}
                <strong style={{ color: 'var(--text-dim)' }}>Pickup</strong> — messages only
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" className="bp full" disabled={loading}>
              {loading ? <Spinner/> : isEdit ? 'Save Changes' : 'Add & Send Invite'}
            </button>
            {isEdit && member?.role !== 'admin' && (
              <button type="button" className="bd" onClick={() => setConfirmDel(true)}>Remove</button>
            )}
            <button type="button" className="bg" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Confirm
        open={confirmDel}
        title="Remove member?"
        message={`Remove ${member?.name} from this family?`}
        danger
        onConfirm={removeMember}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
