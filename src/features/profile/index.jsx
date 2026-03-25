import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { applyTheme } from '../../lib/theme';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import ThemePicker from '../../components/ui/ThemePicker';
import StarRating from '../../components/ui/StarRating';
import { AvailabilityPicker, AvailabilityDisplay } from '../../components/ui/AvailabilityPicker';
import { EmailPreferencesCard, PushPreferencesCard } from '../notifications/index';

// ─── Sitter Profile Tab ───────────────────────────────────────────────────────

export function SitterProfileTab({ sitterId, sitterName, onNameChange }) {
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting,          setDeleting]          = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email || '');
      const { data } = await supabase.from('sitters').select('name').eq('id', sitterId).single();
      setName(data?.name || sitterName || '');
    }
    load();
  }, [sitterId]);

  function selectTheme(id) {
    setTheme(id); applyTheme(id); localStorage.setItem('ll_theme', id);
    supabase.from('sitters').update({ theme_id: id }).eq('id', sitterId);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) { setProfileAlert({ t: 'e', m: 'Name is required.' }); return; }
    setProfileSaving(true); setProfileAlert(null);
    try {
      const { error: dbErr } = await supabase.from('sitters').update({ name: name.trim() }).eq('id', sitterId);
      if (dbErr) throw dbErr;
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
    } catch (err) { setProfileAlert({ t: 'e', m: err.message }); }
    finally { setProfileSaving(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setPassAlert({ t: 'e', m: 'Password must be at least 8 characters.' }); return; }
    if (newPassword !== confirmPass) { setPassAlert({ t: 'e', m: 'Passwords do not match.' }); return; }
    setPassSaving(true); setPassAlert(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPassword });
      if (signInErr) throw new Error('Current password is incorrect.');
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      setPassAlert({ t: 's', m: 'Password changed successfully!' });
      setCurPassword(''); setNewPassword(''); setConfirmPass('');
    } catch (err) { setPassAlert({ t: 'e', m: err.message }); }
    finally { setPassSaving(false); }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      Object.keys(localStorage).filter(k => k.startsWith('ll_')).forEach(k => localStorage.removeItem(k));
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      alert('Error deleting account: ' + err.message);
      setDeleting(false); setShowDeleteConfirm(false); setDeleteConfirmText('');
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
          <button type="submit" className="bp" disabled={profileSaving}>{profileSaving ? <><Spinner/> Saving…</> : 'Save Profile'}</button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🔒 Change Password</div>
        {passAlert && <div className={`al al-${passAlert.t}`}>{passAlert.m}</div>}
        <form onSubmit={savePassword}>
          <Field label="Current password" type="password" value={curPassword} onChange={e => setCurPassword(e.target.value)} placeholder="Your current password"/>
          <Field label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
          <Field label="Confirm new password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat new password"/>
          <button type="submit" className="bp" disabled={passSaving}>{passSaving ? <><Spinner/> Saving…</> : 'Change Password'}</button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🎨 App Theme</div>
        <ThemePicker currentTheme={theme} onSelect={selectTheme}/>
      </div>

      <PublicProfileEditor sitterId={sitterId} sitterName={sitterName}/>
      <EmailPreferencesCard userId={sitterId} isSitter={true}/>
      <PushPreferencesCard userId={sitterId} isSitter={true}/>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14, border: '1px solid rgba(192,80,80,.2)', background: 'rgba(192,80,80,.04)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#F5AAAA' }}>⚠️ Delete Account</div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 16 }}>Permanently deletes your sitter account and all associated data. This cannot be undone.</p>
        {!showDeleteConfirm
          ? <button className="bd" onClick={() => setShowDeleteConfirm(true)}>Delete my account</button>
          : <div>
              <div className="al al-e" style={{ marginBottom: 12 }}>Type <strong>DELETE</strong> to confirm you want to permanently remove your account.</div>
              <input className="fi" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE to confirm" style={{ marginBottom: 10 }}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="bd" disabled={deleteConfirmText !== 'DELETE' || deleting} onClick={deleteAccount}>{deleting ? <><Spinner size={12}/> Deleting…</> : 'Permanently delete'}</button>
                <button className="bg" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>Cancel</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// ─── Public Profile Editor ────────────────────────────────────────────────────

const AGE_RANGES = ['Infants (0-1)', 'Toddlers (1-3)', 'Preschool (3-5)', 'School Age (5-12)', 'Teens (13-17)'];
const CERTS      = ['CPR Certified', 'First Aid', 'Early Childhood Ed', 'Special Needs Experience', 'Pet Friendly', 'Swimming Instructor'];

export function PublicProfileEditor({ sitterId, sitterName }) {
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [alert,          setAlert]          = useState(null);
  const [copied,         setCopied]         = useState(false);
  const [pub,            setPub]            = useState(false);
  const [username,       setUsername]       = useState('');
  const [bio,            setBio]            = useState('');
  const [ageRanges,      setAgeRanges]      = useState([]);
  const [rateMin,        setRateMin]        = useState('');
  const [rateMax,        setRateMax]        = useState('');
  const [avail,          setAvail]          = useState('');
  const [years,          setYears]          = useState('');
  const [certs,          setCerts]          = useState([]);
  const [avatarUrl,      setAvatarUrl]      = useState('');
  const [avatarUploading,setAvatarUploading]= useState(false);

  useEffect(() => {
    async function load() {
      const { data: d } = await supabase.from('sitters')
        .select('public_profile,username,bio,age_ranges,hourly_rate_min,hourly_rate_max,availability,years_experience,certifications,avatar_url')
        .eq('id', sitterId).single();
      if (d) {
        setPub(d.public_profile || false); setUsername(d.username || ''); setBio(d.bio || '');
        setAgeRanges(d.age_ranges || []); setRateMin(d.hourly_rate_min || ''); setRateMax(d.hourly_rate_max || '');
        const raw = d.availability || '';
        try { setAvail(typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : raw); } catch { setAvail(raw); }
        setYears(d.years_experience || ''); setCerts(d.certifications || []); setAvatarUrl(d.avatar_url || '');
      }
      setLoading(false);
    }
    load();
  }, [sitterId]);

  async function uploadAvatar(file) {
    if (!file || !file.type.startsWith('image/')) { setAlert({ t: 'e', m: 'Please select an image file.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setAlert({ t: 'e', m: 'Image must be under 5MB.' }); return; }
    setAvatarUploading(true); setAlert(null);
    const ext = file.name.split('.').pop();
    const { error: upErr } = await supabase.storage.from('sitter-avatars').upload(`${sitterId}/avatar.${ext}`, file, { contentType: file.type, upsert: true });
    if (upErr) { setAlert({ t: 'e', m: upErr.message }); setAvatarUploading(false); return; }
    const { data: urlData } = supabase.storage.from('sitter-avatars').getPublicUrl(`${sitterId}/avatar.${ext}`);
    const finalUrl = (urlData?.publicUrl || '') + '?t=' + Date.now();
    await supabase.from('sitters').update({ avatar_url: finalUrl }).eq('id', sitterId);
    setAvatarUrl(finalUrl); setAvatarUploading(false); setAlert({ t: 's', m: 'Photo updated!' });
  }

  async function save(e) {
    e.preventDefault(); setAlert(null);
    if (pub && !username.trim()) { setAlert({ t: 'e', m: 'A username is required for your public profile.' }); return; }
    if (pub && !/^[a-z0-9_-]+$/.test(username.trim())) { setAlert({ t: 'e', m: 'Username can only contain lowercase letters, numbers, hyphens and underscores.' }); return; }
    setSaving(true);
    const { error } = await supabase.from('sitters').update({
      public_profile: pub, username: username.trim() || null, bio: bio.trim() || null,
      age_ranges: ageRanges.length ? ageRanges : null,
      hourly_rate_min: rateMin ? parseFloat(rateMin) : null, hourly_rate_max: rateMax ? parseFloat(rateMax) : null,
      availability: typeof avail === 'object' ? JSON.stringify(avail) : (avail || null),
      years_experience: years ? parseInt(years) : null, certifications: certs.length ? certs : null,
    }).eq('id', sitterId);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Public profile saved!' });
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><Spinner/></div>;

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🌐 Public Profile</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Let families discover you on littleloop.</div>
      {alert && <div className={`al al-${alert.t}`} style={{ marginBottom: 12 }}>{alert.m}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Make my profile public</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Families can find and view your profile</div>
        </div>
        <div onClick={() => setPub(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', background: pub ? 'var(--accent)' : 'rgba(255,255,255,.1)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 3, left: pub ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }}/>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Profile Photo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile"/> : '➿'}
          </div>
          <label style={{ display: 'inline-block', cursor: 'pointer' }}>
            <span className="bg" style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 8, fontSize: 12, opacity: avatarUploading ? 0.6 : 1 }}>
              {avatarUploading ? <><Spinner size={11}/> Uploading…</> : '📷 Upload Photo'}
            </span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadAvatar(e.target.files[0])}/>
          </label>
        </div>
      </div>

      {pub && (
        <form onSubmit={save}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Username (your profile URL)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>littleloop.xyz/?sitter=</div>
              <input className="fi" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="your-name" style={{ flex: 1 }}/>
            </div>
            {username && <button type="button" onClick={() => { navigator.clipboard.writeText(`https://www.littleloop.xyz/?sitter=${username}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="bg" style={{ marginTop: 6, fontSize: 11, padding: '4px 10px' }}>{copied ? '✓ Copied!' : '🔗 Copy profile link'}</button>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Bio</label>
            <textarea className="fi" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell families about yourself…" rows={4} style={{ resize: 'vertical' }}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Hourly Rate</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>$</div>
              <input className="fi" type="number" value={rateMin} onChange={e => setRateMin(e.target.value)} placeholder="Min" style={{ width: 80 }}/>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>–</div>
              <input className="fi" type="number" value={rateMax} onChange={e => setRateMax(e.target.value)} placeholder="Max" style={{ width: 80 }}/>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>/hr</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Years of Experience</label>
            <input className="fi" type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="e.g. 3" style={{ width: 120 }}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Availability</label>
            <AvailabilityPicker value={avail} onChange={v => setAvail(v)}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Age Ranges</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AGE_RANGES.map(r => <div key={r} onClick={() => setAgeRanges(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: ageRanges.includes(r) ? 'var(--accent)' : 'var(--card-bg)', border: `1px solid ${ageRanges.includes(r) ? 'var(--accent)' : 'var(--border)'}`, color: ageRanges.includes(r) ? '#fff' : 'var(--text-dim)' }}>{r}</div>)}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Certifications & Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CERTS.map(c => <div key={c} onClick={() => setCerts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: certs.includes(c) ? 'rgba(60,180,100,.2)' : 'var(--card-bg)', border: `1px solid ${certs.includes(c) ? 'rgba(60,180,100,.5)' : 'var(--border)'}`, color: certs.includes(c) ? '#5EE89A' : 'var(--text-dim)' }}>{c}</div>)}
            </div>
          </div>
          <button type="submit" className="bp" disabled={saving}>{saving ? <><Spinner/> Saving…</> : 'Save Public Profile'}</button>
        </form>
      )}
    </div>
  );
}

// ─── Public Sitter Profile page ───────────────────────────────────────────────

export function PublicSitterProfile({ username }) {
  const [sitter,   setSitter]   = useState(null);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: s, error } = await supabase.from('sitters')
        .select('id,name,city,state,bio,age_ranges,hourly_rate_min,hourly_rate_max,availability,years_experience,certifications,avatar_url,public_profile')
        .eq('username', username).eq('public_profile', true).maybeSingle();
      if (!s || error) { setNotFound(true); setLoading(false); return; }
      setSitter(s);
      const { data: r } = await supabase.from('sitter_reviews').select('*').eq('sitter_id', s.id).order('created_at', { ascending: false });
      setReviews(r || []);
      setLoading(false);
    }
    load();
  }, [username]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={28}/></div>;
  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 40 }}>➿</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Profile not found</div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>This sitter profile doesn't exist or isn't public.</div>
      <button className="bp" onClick={() => window.location.href = '/?browse'} style={{ marginTop: 8 }}>Browse Sitters</button>
    </div>
  );

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button className="bg" onClick={() => window.location.href = '/?browse'} style={{ padding: '6px 10px', fontSize: 12 }}>← Browse</button>
        <div style={{ flex: 1 }}/>
        <button className="bp" onClick={() => window.location.href = '/?portal=parent'} style={{ fontSize: 12 }}>Join littleloop</button>
      </div>

      <div className="card" style={{ padding: '24px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, overflow: 'hidden' }}>
            {sitter.avatar_url ? <img src={sitter.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '➿'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600 }}>{sitter.name}</div>
            {(sitter.city || sitter.state) && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>📍 {[sitter.city, sitter.state].filter(Boolean).join(', ')}</div>}
            {avgRating && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><StarRating value={Math.round(avgRating)} size={14}/><span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{avgRating} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span></div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sitter.years_experience && <div style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 12 }}>🏅 {sitter.years_experience} yr{sitter.years_experience !== 1 ? 's' : ''} experience</div>}
          {(sitter.hourly_rate_min || sitter.hourly_rate_max) && <div style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 12 }}>💰 ${sitter.hourly_rate_min || '?'}–${sitter.hourly_rate_max || '?'}/hr</div>}
        </div>
        {sitter.availability && <div style={{ marginTop: 8 }}><AvailabilityDisplay value={sitter.availability}/></div>}
        {sitter.bio && <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, marginTop: 12 }}>{sitter.bio}</p>}
      </div>

      {sitter.age_ranges?.length > 0 && <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>👶 Works With</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sitter.age_ranges.map(r => <div key={r} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: 'rgba(58,111,212,.15)', border: '1px solid rgba(58,111,212,.3)', color: 'var(--accent)' }}>{r}</div>)}</div></div>}
      {sitter.certifications?.length > 0 && <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>✅ Certifications & Skills</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sitter.certifications.map(c => <div key={c} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: 'rgba(60,180,100,.15)', border: '1px solid rgba(60,180,100,.3)', color: '#5EE89A' }}>{c}</div>)}</div></div>}

      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: reviews.length ? 12 : 0 }}>⭐ Reviews {reviews.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>({reviews.length})</span>}</div>
        {reviews.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>No reviews yet.</div>
          : reviews.map(r => (
            <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <StarRating value={r.rating} size={13}/>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{r.reviewer_name || 'A family'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
              {r.review_text && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>{r.review_text}</p>}
            </div>
          ))
        }
      </div>

      <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ready to connect with {sitter.name.split(' ')[0]}?</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>Join littleloop to send a message and manage your childcare all in one place.</div>
        <button className="bp" onClick={() => window.location.href = '/?portal=parent'}>Get Started — it's free</button>
      </div>
    </div>
  );
}

// ─── Browse Sitters page ──────────────────────────────────────────────────────

export function BrowseSitters() {
  const [sitters,  setSitters]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('sitters')
        .select('id,name,city,state,bio,age_ranges,hourly_rate_min,hourly_rate_max,availability,years_experience,certifications,username,avatar_url')
        .eq('public_profile', true).order('name');
      setSitters(data || []); setFiltered(data || []); setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(sitters); return; }
    const q = search.toLowerCase();
    setFiltered(sitters.filter(s => s.name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.state?.toLowerCase().includes(q) || s.bio?.toLowerCase().includes(q)));
  }, [search, sitters]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600 }}><span className="leaf">➿</span> Find a Sitter</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Browse available sitters in your area</div>
        </div>
        <button className="bp" onClick={() => window.location.href = '/?portal=parent'} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Sign Up Free</button>
      </div>

      <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, city, or state…" style={{ marginBottom: 16, fontSize: 14 }}/>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={24}/></div>
        : filtered.length === 0
          ? <div className="card" style={{ padding: 32, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No sitters found</div><div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{search ? 'Try a different search.' : 'No sitters have created public profiles yet.'}</div></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(s => (
                <div key={s.id} className="card fc" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => window.location.href = `/?sitter=${s.username}`}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, overflow: 'hidden' }}>
                      {s.avatar_url ? <img src={s.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '➿'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                      {(s.city || s.state) && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>📍 {[s.city, s.state].filter(Boolean).join(', ')}</div>}
                      {s.bio && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.bio}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {s.years_experience && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>🏅 {s.years_experience}yr exp</span>}
                        {(s.hourly_rate_min || s.hourly_rate_max) && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>💰 ${s.hourly_rate_min || '?'}–${s.hourly_rate_max || '?'}/hr</span>}
                        {s.age_ranges?.slice(0, 2).map(r => <span key={r} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(58,111,212,.1)', border: '1px solid rgba(58,111,212,.2)', color: 'var(--accent)' }}>{r}</span>)}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text-faint)', flexShrink: 0 }}>›</div>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      <div style={{ textAlign: 'center', marginTop: 32, padding: '20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 10 }}>Are you a sitter? Create your free public profile.</div>
        <button className="bp" onClick={() => window.location.href = '/?portal=sitter'}>Sign Up as a Sitter</button>
      </div>
    </div>
  );
}
