import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import { isFreeLimitError, FREE_LIMIT_MESSAGE } from '../../lib/plan';

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
      // The server matches the email case-insensitively and reuses an existing family
      // (it then asks that family to accept) instead of creating a duplicate.
      const childNames = childrenStr.split(',').map(str => str.trim()).filter(Boolean);
      const { data: result, error } = await supabase.rpc('invite_family', {
        p_family_name: familyName, p_admin_email: adminEmail, p_child_names: childNames,
      });
      if (error) throw new Error(isFreeLimitError(error) ? FREE_LIMIT_MESSAGE : error.message);

      if (result.already) {
        setAlert({ t: 'i', m: result.status === 'active' ? "You're already connected to this family." : "You've already invited this family. They just need to accept." });
        return;
      }

      await supabase.functions.invoke('send-invite', {
        body: { familyName: familyName.trim() || 'your family', parentEmail: adminEmail.trim(), sitterName, sitterId },
      });

      setAlert({ t: 's', m: result.status === 'active'
        ? "You're connected! This family had already asked for you."
        : result.existing
          ? `That family is already on littleloop. We've asked them to accept your invite.`
          : `${familyName} invited! An email is on its way to ${adminEmail}.` });
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
            {loading ? <><Spinner/> Please wait...</> : 'Send Invite'}
          </button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
