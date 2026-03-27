import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { applyTheme } from '../../lib/theme';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import ThemePicker from '../../components/ui/ThemePicker';
import { EmailPreferencesCard, PushPreferencesCard } from '../notifications/index';

// ─── Inline editable family name ─────────────────────────────────────────────

export function FamilyNameEditor({ familyId, name, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(name);
  const [saving,  setSaving]  = useState(false);

  async function save() {
    if (!value.trim() || value.trim() === name) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase.from('families').update({ name: value.trim() }).eq('id', familyId);
    setSaving(false);
    if (!error) { onSaved(value.trim()); setEditing(false); }
  }

  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
      <input className="fi" value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 0, padding: '4px 8px' }}
        autoFocus/>
      <button className="bp" style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }} onClick={save} disabled={saving}>
        {saving ? <Spinner size={10}/> : '✓'}
      </button>
      <button className="bg" style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }} onClick={() => { setValue(name); setEditing(false); }}>✕</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setEditing(true)}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>{name}</div>
      <span style={{ fontSize: 12, opacity: .35 }}>✏️</span>
    </div>
  );
}

// ─── Member profile / settings tab ───────────────────────────────────────────

export function MemberProfileTab({ memberId, memberName, onNameChange }) {
  const [theme,         setTheme]         = useState(localStorage.getItem('ll_theme') || 'midnight');
  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAlert,  setProfileAlert]  = useState(null);
  const [curPassword,   setCurPassword]   = useState('');
  const [newPassword,   setNewPassword]   = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [passSaving,    setPassSaving]    = useState(false);
  const [passAlert,     setPassAlert]     = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email || '');
      if (memberId) {
        const { data } = await supabase.from('members').select('name').eq('id', memberId).single();
        setName(data?.name || memberName || '');
      } else {
        setName(memberName || '');
      }
    }
    load();
  }, [memberId]);

  function selectTheme(id) {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem('ll_theme', id);
    if (memberId) supabase.from('members').update({ theme_id: id }).eq('id', memberId);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) { setProfileAlert({ t: 'e', m: 'Name is required.' }); return; }
    setProfileSaving(true);
    setProfileAlert(null);
    try {
      if (memberId) {
        const { error: dbErr } = await supabase.from('members').update({ name: name.trim() }).eq('id', memberId);
        if (dbErr) throw dbErr;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (email.trim() !== user.email) {
        const { error: authErr } = await supabase.auth.updateUser({ email: email.trim() });
        if (authErr) throw authErr;
        setProfileAlert({ t: 's', m: 'Profile updated! Check your new email for a confirmation link.' });
      } else {
        await supabase.auth.updateUser({ data: { name: name.trim() } });
        setProfileAlert({ t: 's', m: 'Profile updated!' });
        onNameChange?.(name.trim());
      }
    } catch (err) {
      setProfileAlert({ t: 'e', m: err.message });
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setPassAlert({ t: 'e', m: 'Password must be at least 8 characters.' }); return; }
    if (newPassword !== confirmPass) { setPassAlert({ t: 'e', m: 'Passwords do not match.' }); return; }
    setPassSaving(true);
    setPassAlert(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPassword });
      if (signInErr) throw new Error('Current password is incorrect.');
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      setPassAlert({ t: 's', m: 'Password changed successfully!' });
      setCurPassword(''); setNewPassword(''); setConfirmPass('');
    } catch (err) {
      setPassAlert({ t: 'e', m: err.message });
    } finally {
      setPassSaving(false);
    }
  }

  return (
    <div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Profile & Settings</div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>👤 Your Profile</div>
        {profileAlert && <div className={`al al-${profileAlert.t}`}>{profileAlert.m}</div>}
        <form onSubmit={saveProfile}>
          <Field label="Display name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/>
          <Field label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
          <button type="submit" className="bp" disabled={profileSaving}>
            {profileSaving ? <><Spinner/> Saving…</> : 'Save Profile'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🔒 Change Password</div>
        {passAlert && <div className={`al al-${passAlert.t}`}>{passAlert.m}</div>}
        <form onSubmit={savePassword}>
          <Field label="Current password" type="password" value={curPassword} onChange={e => setCurPassword(e.target.value)} placeholder="Your current password"/>
          <Field label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
          <Field label="Confirm new password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat new password"/>
          <button type="submit" className="bp" disabled={passSaving}>
            {passSaving ? <><Spinner/> Saving…</> : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🎨 App Theme</div>
        <ThemePicker currentTheme={theme} onSelect={selectTheme}/>
      </div>

      {memberId && <EmailPreferencesCard userId={memberId} isSitter={false}/>}
      {memberId && <PushPreferencesCard userId={memberId} isSitter={false}/>}
    </div>
  );
}
