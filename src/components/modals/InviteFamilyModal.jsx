import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';

export default function InviteFamilyModal({ open, onClose, sitterId, sitterName, onInvited }) {
  const [familyName,   setFamilyName]   = useState('');
  const [adminEmail,   setAdminEmail]   = useState('');
  const [childrenStr,  setChildrenStr]  = useState('');
  const [loading,      setLoading]      = useState(false);
  const [alert,        setAlert]        = useState(null);

  function close() {
    if (loading) return;
    setFamilyName(''); setAdminEmail(''); setChildrenStr(''); setAlert(null);
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    try {
      // Check if family already exists by admin email
      const { data: existing } = await supabase.from('families')
        .select('id,name,status').eq('admin_email', adminEmail).maybeSingle();

      if (existing) {
        const { data: existingConn } = await supabase.from('family_sitters')
          .select('id,status').eq('family_id', existing.id).eq('sitter_id', sitterId).maybeSingle();

        if (existingConn && existingConn.status !== 'inactive') {
          setAlert({ t: 'i', m: "You're already connected to this family." });
          setLoading(false);
          return;
        }
        if (existingConn) {
          await supabase.from('family_sitters').update({ status: 'active' }).eq('id', existingConn.id);
        } else {
          await supabase.from('family_sitters').insert({ family_id: existing.id, sitter_id: sitterId, status: 'pending' });
        }
        setAlert({ t: 's', m: `You've been connected to the ${existing.name} family!` });
        setTimeout(() => { onInvited(); close(); }, 1800);
        return;
      }

      // Create new family via edge function (bypasses RLS)
      const { data: { session: s } } = await supabase.auth.getSession();
      const childNames = childrenStr.split(',').map(str => str.trim()).filter(Boolean);

      const res = await fetch(
        'https://ukcxammnzhirxjdlqelr.supabase.co/functions/v1/create-family',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s.access_token}`,
          },
          body: JSON.stringify({ mode: 'sitter-invite', familyName, adminEmail, sitterId, childNames }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create family');

      // Send the invite email
      await supabase.functions.invoke('send-invite', {
        body: { familyName, parentEmail: adminEmail, sitterName, sitterId },
      });

      setAlert({ t: 's', m: `${familyName} invited! An email is on its way to ${adminEmail}.` });
      setTimeout(() => { onInvited(); close(); }, 1800);

    } catch (err) {
      setAlert({ t: 'e', m: err.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Invite a Family</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 22, lineHeight: 1.6 }}>The email you enter becomes the family admin.</p>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={submit}>
        <Field label="Family name" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="The Johnson Family" autoComplete="off" required={false}/>
        <Field label="Admin email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="parent@example.com" autoComplete="off"/>
        <div>
          <label className="fl">Children's names <span style={{ opacity: .5 }}>(comma separated, optional)</span></label>
          <input className="fi" value={childrenStr} onChange={e => setChildrenStr(e.target.value)} placeholder="Emma, Jack"/>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="submit" className="bp full" disabled={loading}>
            {loading ? <><Spinner/> Please wait…</> : '📧 Send Invite'}
          </button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
