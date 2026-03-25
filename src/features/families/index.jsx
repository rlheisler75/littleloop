import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { invokeNotification, sendPushNotification } from '../../services/push';
import { FamilyNameEditor } from '../members/MemberProfileTab';
import { CheckInButton, MultiCheckInButton } from '../children/CheckInButton';
import SessionsList from '../children/SessionsList';
import { ScheduleManager } from '../schedule/index';
import { ChildProfileModal } from '../../components/modals/ChildModal';
import InviteFamilyModal from '../../components/modals/InviteFamilyModal';
import { Confirm } from '../../components/ui/Modal';
import SectionLabel from '../../components/ui/SectionLabel';
import Spinner from '../../components/ui/Spinner';

// ─── Connection Requests (sitter side) ───────────────────────────────────────

export function ConnectionRequests({ sitterId, onUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { load(); }, [sitterId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('family_sitters')
      .select('id,family_id,families(id,name,admin_email)')
      .eq('sitter_id', sitterId).eq('status', 'requested');
    setRequests(data || []);
    setLoading(false);
  }

  async function respond(id, familyId, accept) {
    if (accept) {
      await supabase.from('family_sitters').update({ status: 'active' }).eq('id', id);
      await supabase.from('families').update({ status: 'active' }).eq('id', familyId).eq('status', 'pending');
      // Notify family the request was accepted
      const req = requests.find(r => r.id === id);
      if (req?.families?.id) {
        invokeNotification({ body: { type: 'connection_accepted', payload: { familyId: req.families.id } } }).catch(console.error);
        supabase.from('members').select('user_id').eq('family_id', req.families.id).eq('role', 'admin').eq('status', 'active').limit(1)
          .then(({ data: admins }) => {
            const ids = (admins || []).map(m => m.user_id).filter(Boolean);
            if (ids.length) sendPushNotification(ids, 'Connection accepted! 🎉', 'Your sitter accepted your connection request.', '/?portal=parent', 'connection_accepted');
          });
      }
    } else {
      await supabase.from('family_sitters').update({ status: 'inactive' }).eq('id', id);
    }
    setRequests(r => r.filter(req => req.id !== id));
    onUpdate?.();
  }

  if (loading || !requests.length) return null;

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 14, border: '1px solid rgba(111,163,232,.2)', background: 'rgba(111,163,232,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🤝</span>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600 }}>Connection Requests</span>
        <span style={{ background: '#3A6FD4', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{requests.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.families?.name || 'A family'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>wants to connect with you</div>
            </div>
            <button className="bp" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => respond(r.id, r.family_id, true)}>✓ Accept</button>
            <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => respond(r.id, r.family_id, false)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sitter family detail view ────────────────────────────────────────────────

export function SitterFamilyDetail({ family, children, sitterId, sitterName, onDeactivate }) {
  const [selectedChild,  setSelectedChild]  = useState(null);
  const [confirmRemove,  setConfirmRemove]  = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [alert,          setAlert]          = useState(null);
  const [editEmail,      setEditEmail]      = useState(false);
  const [newEmail,       setNewEmail]       = useState(family.admin_email || '');
  const [emailSaving,    setEmailSaving]    = useState(false);
  const [etas,           setEtas]           = useState([]);

  useEffect(() => {
    async function loadEtas() {
      const { data } = await supabase.from('eta_notifications').select('*')
        .eq('family_id', family.id).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      setEtas(data || []);
    }
    loadEtas();
    const ch = supabase.channel(`eta-${family.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eta_notifications', filter: `family_id=eq.${family.id}` }, () => loadEtas())
      .subscribe();
    const timer = setInterval(() => setEtas(prev => prev.filter(e => new Date(e.expires_at) > new Date())), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [family.id]);

  async function deactivate() {
    setLoading(true);
    const { error } = await supabase.from('family_sitters').update({ status: 'inactive' }).eq('family_id', family.id).eq('sitter_id', sitterId);
    setLoading(false);
    setConfirmRemove(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    onDeactivate();
  }

  async function saveEmailAndResend() {
    if (!newEmail.trim() || newEmail.trim() === family.admin_email) { setEditEmail(false); return; }
    setEmailSaving(true);
    const trimmed = newEmail.trim();
    const { error: upErr } = await supabase.from('families').update({ admin_email: trimmed }).eq('id', family.id);
    if (upErr) { setAlert({ t: 'e', m: upErr.message }); setEmailSaving(false); return; }
    await supabase.from('members').update({ email: trimmed, name: trimmed.split('@')[0] }).eq('family_id', family.id).eq('status', 'pending');
    family.admin_email = trimmed;
    const { error: fnErr } = await supabase.functions.invoke('send-invite', { body: { familyName: family.name, parentEmail: trimmed, sitterName, sitterId } });
    setEmailSaving(false);
    setEditEmail(false);
    setAlert(fnErr ? { t: 'w', m: 'Email updated but invite failed to send. Try resending.' } : { t: 's', m: 'Email updated and invite resent!' });
    setTimeout(() => setAlert(null), 3000);
  }

  async function resendInvite() {
    setLoading(true);
    const { error } = await supabase.functions.invoke('send-invite', { body: { familyName: family.name, parentEmail: family.admin_email, sitterName, sitterId } });
    setLoading(false);
    setAlert(error ? { t: 'e', m: 'Failed to resend invite.' } : { t: 's', m: 'Invite resent!' });
    setTimeout(() => setAlert(null), 3000);
  }

  return (
    <div className="slide-in">
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      {etas.map(eta => {
        const etaTime  = new Date(eta.eta_time);
        const minsLeft = Math.max(0, Math.round((etaTime - Date.now()) / 60000));
        return (
          <div key={eta.id} style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(58,158,122,.12)', border: '1px solid rgba(94,207,170,.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚗</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#5ECFAA' }}>{eta.member_name} is on the way!</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{minsLeft > 0 ? `~${minsLeft} min away · ` : 'Arriving soon · '}{etaTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FamilyNameEditor familyId={family.id} name={family.name} onSaved={n => { family.name = n; setAlert({ t: 's', m: 'Family name updated!' }); setTimeout(() => setAlert(null), 2000); }}/>
          {editEmail
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input className="fi" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEmailAndResend(); if (e.key === 'Escape') setEditEmail(false); }} style={{ marginBottom: 0, padding: '4px 8px', fontSize: 12 }} autoFocus/>
                <button className="bp" style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }} onClick={saveEmailAndResend} disabled={emailSaving}>{emailSaving ? <Spinner size={10}/> : 'Save & Resend'}</button>
                <button className="bg" style={{ padding: '4px 8px', fontSize: 11, flexShrink: 0 }} onClick={() => { setNewEmail(family.admin_email); setEditEmail(false); }}>✕</button>
              </div>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{family.admin_email}</span>
                {family.status === 'pending' && <>
                  <button onClick={() => setEditEmail(true)} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--accent,#7BAAEE)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>edit</button>
                  <button onClick={resendInvite} disabled={loading} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--accent,#7BAAEE)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{loading ? 'sending…' : 'resend invite'}</button>
                </>}
              </div>
          }
        </div>
        <span className={`sb sb-${family.status === 'active' ? 'a' : family.status === 'pending' ? 'p' : 'i'}`} style={{ flexShrink: 0, marginLeft: 8 }}>
          {family.status === 'active' ? '✅ Active' : family.status === 'pending' ? '⏳ Pending' : '⬜ Inactive'}
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionLabel>Children</SectionLabel>
          {children.length > 1 && <MultiCheckInButton children={children} familyId={family.id} currentUserId={sitterId} checkerName={sitterName || 'Sitter'} isSitter={true}/>}
        </div>
        {children.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No children added yet</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {children.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `${c.color || '#8B78D4'}12`, borderRadius: 14, border: `1px solid ${c.color || '#8B78D4'}33` }}>
                  <button onClick={() => setSelectedChild(c)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', flex: 1, minWidth: 0, padding: 0 }}>
                    <span style={{ fontSize: 22 }}>{c.avatar || '🌟'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  </button>
                  <CheckInButton child={c} familyId={family.id} currentUserId={sitterId} checkerName={sitterName || 'Sitter'} isSitter={true}/>
                </div>
              ))}
            </div>
          )
        }
        <SessionsList familyId={family.id} childrenMap={{}} showTitle={true}/>
      </div>

      <ScheduleManager sitterId={sitterId} familyId={family.id} familyName={family.name}/>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16 }}>
        <button className="bd" onClick={() => setConfirmRemove(true)} disabled={loading}>🔕 Remove from my families</button>
      </div>

      <ChildProfileModal open={!!selectedChild} onClose={() => setSelectedChild(null)} child={selectedChild} sitterId={sitterId} canEdit={false} isParent={false}/>
      <Confirm open={confirmRemove} title="Remove family?" message={`This will disconnect you from ${family.name}. Their data stays intact.`} danger onConfirm={deactivate} onCancel={() => setConfirmRemove(false)}/>
    </div>
  );
}

// ─── Families Tab (sitter) ────────────────────────────────────────────────────

export function FamiliesTab({ sitterId, sitterName }) {
  const [families,   setFamilies]   = useState([]);
  const [kids,       setKids]       = useState({});
  const [selected,   setSelected]   = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: fsRows } = await supabase.from('family_sitters').select('status,families(*)').eq('sitter_id', sitterId).neq('status', 'inactive').order('joined_at', { ascending: false });
    const fams = (fsRows || []).map(r => r.families).filter(Boolean);
    setFamilies(fams);
    if (fams.length) {
      const { data: kds } = await supabase.from('children').select('*').in('family_id', fams.map(f => f.id));
      const g = {};
      (kds || []).forEach(k => { if (!g[k.family_id]) g[k.family_id] = []; g[k.family_id].push(k); });
      setKids(g);
    }
    setLoading(false);
  }, [sitterId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (families.length && !selected) setSelected(families[0].id); }, [families]);

  const selFam = families.find(f => f.id === selected);
  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  return (
    <div>
      <ConnectionRequests sitterId={sitterId} onUpdate={load}/>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600 }}>
          Families <span style={{ fontSize: 14, color: 'var(--text-faint)', fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>({families.length})</span>
        </div>
        <button className="bp" onClick={() => setShowInvite(true)}>+ Invite Family</button>
      </div>

      {families.length === 0
        ? <div className="es"><div className="ic">👨‍👩‍👧</div><h3>No families yet</h3><p>Invite your first family to get started.</p><button className="bp" onClick={() => setShowInvite(true)}>+ Invite your first family</button></div>
        : selected && selFam
          ? <div>
              <button className="bg" style={{ marginBottom: 12, fontSize: 12, padding: '6px 12px' }} onClick={() => setSelected(null)}>← All Families</button>
              <div className="card" style={{ padding: 22 }}>
                <SitterFamilyDetail family={selFam} children={kids[selected] || []} sitterId={sitterId} sitterName={sitterName} onDeactivate={() => { setSelected(null); load(); }}/>
              </div>
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {families.map(f => (
                <div key={f.id} className={`fc ${selected === f.id ? 'active' : ''}`} onClick={() => setSelected(f.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                    <span className={`sb sb-${f.status === 'active' ? 'a' : 'p'}`} style={{ fontSize: 9 }}>{f.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>{(kids[f.id] || []).length} child{(kids[f.id] || []).length !== 1 ? 'ren' : ''}</div>
                </div>
              ))}
            </div>
      }

      <InviteFamilyModal open={showInvite} onClose={() => setShowInvite(false)} sitterId={sitterId} sitterName={sitterName} onInvited={load}/>
    </div>
  );
}
