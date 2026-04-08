import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { applyTheme } from '../../lib/theme';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import ThemePicker from '../../components/ui/ThemePicker';
import StarRating from '../../components/ui/StarRating';
import { AvailabilityPicker, AvailabilityDisplay } from '../../components/ui/AvailabilityPicker';
import { EmailPreferencesCard, PushPreferencesCard } from '../notifications/index';
import SitterAvatar from '../../components/ui/SitterAvatar';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_RANGES = [
  { id: 'infants',    label: 'Infants',     sub: '0–1 yr',   icon: '👶' },
  { id: 'toddlers',   label: 'Toddlers',    sub: '1–3 yrs',  icon: '🧒' },
  { id: 'preschool',  label: 'Preschool',   sub: '3–5 yrs',  icon: '🎒' },
  { id: 'school_age', label: 'School Age',  sub: '5–12 yrs', icon: '📚' },
  { id: 'teens',      label: 'Teens',       sub: '13–17 yrs',icon: '🎮' },
];

const SERVICES = [
  'Light cleaning', 'Meal prep', 'Homework help', 'Grocery shopping',
  'Laundry', 'Craft assistance', 'Swimming supervision', 'Transportation',
  'Overnight care', 'Weekend care', 'After school care', 'Before school care',
  'Pet care', 'Tutoring', 'Music lessons support',
];

const CERTIFICATIONS = [
  { id: 'cpr',        label: 'CPR Certified',          icon: '❤️‍🔥' },
  { id: 'first_aid',  label: 'First Aid',              icon: '🩹' },
  { id: 'ece',        label: 'Early Childhood Ed',     icon: '🎓' },
  { id: 'special',    label: 'Special Needs Exp.',     icon: '♿' },
  { id: 'swimming',   label: 'Swimming Instructor',    icon: '🏊' },
  { id: 'nanny_cert', label: 'Certified Nanny',        icon: '⭐' },
];

const COMFORTABLE_WITH = [
  'Pets', 'Multiple children', 'Special needs', 'Newborns',
  'Non-smokers only', 'Twins', 'Medically complex children',
];

const LANGUAGES = ['English', 'Spanish', 'French', 'Mandarin', 'Portuguese', 'Arabic', 'Hindi', 'ASL'];

const RESPONSE_TIMES = ['Within an hour', 'Within a few hours', 'Same day', 'Within 2 days'];

// ─── Sitter Profile Tab (account settings) ────────────────────────────────────

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
  const [showDel,       setShowDel]       = useState(false);
  const [delText,       setDelText]       = useState('');
  const [deleting,      setDeleting]      = useState(false);

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
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) throw error;
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
    if (newPassword.length < 8)    { setPassAlert({ t: 'e', m: 'Password must be at least 8 characters.' }); return; }
    if (newPassword !== confirmPass){ setPassAlert({ t: 'e', m: 'Passwords do not match.' }); return; }
    setPassSaving(true); setPassAlert(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPassword });
      if (signInErr) throw new Error('Current password is incorrect.');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
    } catch (err) { alert('Error deleting account: ' + err.message); setDeleting(false); setShowDel(false); setDelText(''); }
  }

  return (
    <div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Account Settings</div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>👤 Your Account</div>
        {profileAlert && <div className={`al al-${profileAlert.t}`}>{profileAlert.m}</div>}
        <form onSubmit={saveProfile}>
          <Field label="Display name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/>
          <Field label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
          <button type="submit" className="bp" disabled={profileSaving}>{profileSaving ? <><Spinner/> Saving…</> : 'Save'}</button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🔒 Change Password</div>
        {passAlert && <div className={`al al-${passAlert.t}`}>{passAlert.m}</div>}
        <form onSubmit={savePassword}>
          <Field label="Current password" type="password" value={curPassword} onChange={e => setCurPassword(e.target.value)}/>
          <Field label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
          <Field label="Confirm new password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}/>
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
        <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 16 }}>Permanently deletes your account and all data. Cannot be undone.</p>
        {!showDel
          ? <button className="bd" onClick={() => setShowDel(true)}>Delete my account</button>
          : <div>
              <div className="al al-e" style={{ marginBottom: 12 }}>Type <strong>DELETE</strong> to confirm.</div>
              <input className="fi" value={delText} onChange={e => setDelText(e.target.value)} placeholder="Type DELETE to confirm" style={{ marginBottom: 10 }}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="bd" disabled={delText !== 'DELETE' || deleting} onClick={deleteAccount}>{deleting ? <><Spinner size={12}/> Deleting…</> : 'Permanently delete'}</button>
                <button className="bg" onClick={() => { setShowDel(false); setDelText(''); }}>Cancel</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// ─── Public Profile Editor ────────────────────────────────────────────────────

export function PublicProfileEditor({ sitterId, sitterName }) {
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [alert,           setAlert]           = useState(null);
  const [copied,          setCopied]          = useState(false);
  const [activeTab,       setActiveTab]       = useState('basics');

  // Toggle
  const [pub, setPub] = useState(false);

  // Basics
  const [username,        setUsername]        = useState('');
  const [tagline,         setTagline]         = useState('');
  const [bio,             setBio]             = useState('');
  const [city,            setCity]            = useState('');
  const [state,           setState_]          = useState('');
  const [rateMin,         setRateMin]         = useState('');
  const [rateMax,         setRateMax]         = useState('');
  const [years,           setYears]           = useState('');
  const [responseTime,    setResponseTime]    = useState('');
  const [education,       setEducation]       = useState('');

  // Photos
  const [avatarUrl,       setAvatarUrl]       = useState('');
  const [headlineUrl,     setHeadlineUrl]     = useState('');
  const [gallery,         setGallery]         = useState([]);
  const [uploading,       setUploading]       = useState(null);

  // Qualifications
  const [ageRanges,       setAgeRanges]       = useState([]);
  const [certs,           setCerts]           = useState([]);
  const [services,        setServices]        = useState([]);
  const [comfortable,     setComfortable]     = useState([]);
  const [languages,       setLanguages]       = useState([]);
  const [hasCar,          setHasCar]          = useState(false);
  const [canDrive,        setCanDrive]        = useState(false);
  const [bgCheck,         setBgCheck]         = useState(false);
  const [bgCheckDate,     setBgCheckDate]     = useState('');

  // Availability
  const [avail, setAvail] = useState({});

  useEffect(() => {
    async function load() {
      const { data: d } = await supabase.from('sitters')
        .select('*').eq('id', sitterId).single();
      if (d) {
        setPub(d.public_profile || false);
        setUsername(d.username || '');
        setTagline(d.tagline || '');
        setBio(d.bio || '');
        setCity(d.city || '');
        setState_(d.state || '');
        setRateMin(d.hourly_rate_min || '');
        setRateMax(d.hourly_rate_max || '');
        setYears(d.years_experience || '');
        setResponseTime(d.response_time || '');
        setEducation(d.education || '');
        setAvatarUrl(d.avatar_url || '');
        setHeadlineUrl(d.headline_photo_url || '');
        setGallery(d.photo_gallery || []);
        setAgeRanges(d.age_ranges || []);
        setCerts(d.certifications || []);
        setServices(d.services || []);
        setComfortable(d.comfortable_with || []);
        setLanguages(d.languages || []);
        setHasCar(d.has_car || false);
        setCanDrive(d.can_drive_kids || false);
        setBgCheck(d.background_check || false);
        setBgCheckDate(d.background_check_date || '');
        try { setAvail(typeof d.availability === 'string' ? JSON.parse(d.availability || '{}') : (d.availability || {})); }
        catch { setAvail({}); }
      }
      setLoading(false);
    }
    load();
  }, [sitterId]);

  async function uploadPhoto(file, type) {
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { setAlert({ t: 'e', m: 'Image must be under 5MB.' }); return; }
    setUploading(type);
    const ext  = file.name.split('.').pop();
    const path = type === 'avatar'   ? `${sitterId}/avatar.${ext}`
               : type === 'headline' ? `${sitterId}/headline.${ext}`
               : `${sitterId}/gallery_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('sitter-avatars').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { setAlert({ t: 'e', m: error.message }); setUploading(null); return; }
    const { data: { publicUrl } } = supabase.storage.from('sitter-avatars').getPublicUrl(path);
    const url = publicUrl + '?t=' + Date.now();
    if (type === 'avatar') {
      await supabase.from('sitters').update({ avatar_url: url }).eq('id', sitterId);
      setAvatarUrl(url);
    } else if (type === 'headline') {
      setHeadlineUrl(url);
    } else {
      setGallery(prev => [...prev, url]);
    }
    setUploading(null);
    setAlert({ t: 's', m: 'Photo uploaded!' });
  }

  async function removeGalleryPhoto(url) {
    setGallery(prev => prev.filter(u => u !== url));
  }

  async function save(e) {
    e?.preventDefault(); setAlert(null);
    if (pub && !username.trim())                                   { setAlert({ t: 'e', m: 'A username is required for your public profile.' }); return; }
    if (pub && !/^[a-z0-9_-]+$/.test(username.trim()))            { setAlert({ t: 'e', m: 'Username: lowercase letters, numbers, hyphens and underscores only.' }); return; }
    setSaving(true);
    const { error } = await supabase.from('sitters').update({
      public_profile: pub,
      username:           username.trim() || null,
      tagline:            tagline.trim()  || null,
      bio:                bio.trim()      || null,
      city:               city.trim()     || null,
      state:              state.trim()    || null,
      hourly_rate_min:    rateMin ? parseFloat(rateMin) : null,
      hourly_rate_max:    rateMax ? parseFloat(rateMax) : null,
      years_experience:   years ? parseInt(years) : null,
      response_time:      responseTime   || null,
      education:          education.trim()|| null,
      headline_photo_url: headlineUrl    || null,
      photo_gallery:      gallery.length  ? gallery : null,
      age_ranges:         ageRanges.length ? ageRanges : null,
      certifications:     certs.length    ? certs    : null,
      services:           services.length ? services : null,
      comfortable_with:   comfortable.length ? comfortable : null,
      languages:          languages.length   ? languages   : null,
      has_car:            hasCar,
      can_drive_kids:     canDrive,
      background_check:   bgCheck,
      background_check_date: bgCheckDate || null,
      availability: JSON.stringify(avail),
    }).eq('id', sitterId);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Public profile saved!' });
    setTimeout(() => setAlert(null), 3000);
  }

  function toggle(list, setList, val) {
    setList(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><Spinner/></div>;

  const TABS = [
    { id: 'basics',    label: 'Basics' },
    { id: 'photos',    label: 'Photos' },
    { id: 'quals',     label: 'Qualifications' },
    { id: 'schedule',  label: 'Availability' },
  ];

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🌐 Public Profile</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Let families discover you on littleloop.</div>

      {alert && <div className={`al al-${alert.t}`} style={{ marginBottom: 12 }}>{alert.m}</div>}

      {/* Public toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Make my profile public</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Families can find and view your profile</div>
        </div>
        <Toggle isOn={pub} onToggle={() => setPub(v => !v)}/>
      </div>

      {/* Profile link */}
      {pub && username && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: 'rgba(58,111,212,.08)', borderRadius: 10, border: '1px solid rgba(58,111,212,.2)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            littleloop.xyz/?sitter={username}
          </span>
          <button onClick={() => { navigator.clipboard.writeText(`https://littleloop.xyz/?sitter=${username}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="bg" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>
            {copied ? '✓ Copied!' : '🔗 Copy link'}
          </button>
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === t.id ? 'var(--accent,#7BAAEE)' : 'var(--text-faint)', borderBottom: `2px solid ${activeTab === t.id ? 'var(--accent,#7BAAEE)' : 'transparent'}`, marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BASICS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'basics' && (
        <div>
          <Field label="Username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="your-name (used in your profile URL)"/>
          <Field label="Headline" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Your Favorite Babysitter's Favorite Babysitter"/>
          <div style={{ marginBottom: 14 }}>
            <label className="fl">About me</label>
            <textarea className="fi" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell families about yourself, your experience, your approach…" rows={5} style={{ resize: 'vertical' }}/>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'right' }}>{bio.length}/600</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Field label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Springfield" required={false}/>
            <Field label="State" value={state} onChange={e => setState_(e.target.value)} placeholder="MO" required={false}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="fl">Rate from ($/hr)</label>
              <input className="fi" type="number" value={rateMin} onChange={e => setRateMin(e.target.value)} placeholder="8"/>
            </div>
            <div>
              <label className="fl">Rate to ($/hr)</label>
              <input className="fi" type="number" value={rateMax} onChange={e => setRateMax(e.target.value)} placeholder="20"/>
            </div>
            <div>
              <label className="fl">Years experience</label>
              <input className="fi" type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="3"/>
            </div>
          </div>
          <Field label="Education" value={education} onChange={e => setEducation(e.target.value)} placeholder="e.g. BS in Early Childhood Education, State University" required={false}/>
          <div style={{ marginBottom: 14 }}>
            <label className="fl">Typical response time</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {RESPONSE_TIMES.map(r => (
                <button key={r} type="button" onClick={() => setResponseTime(responseTime === r ? '' : r)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${responseTime === r ? '#7BAAEE' : 'var(--border)'}`, background: responseTime === r ? 'rgba(111,163,232,.15)' : 'transparent', color: responseTime === r ? '#7BAAEE' : 'var(--text-faint)', fontSize: 11, cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="fl">Languages spoken</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LANGUAGES.map(l => (
                <button key={l} type="button" onClick={() => toggle(languages, setLanguages, l)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${languages.includes(l) ? '#7BAAEE' : 'var(--border)'}`, background: languages.includes(l) ? 'rgba(111,163,232,.15)' : 'transparent', color: languages.includes(l) ? '#7BAAEE' : 'var(--text-faint)', fontSize: 11, cursor: 'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTOS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'photos' && (
        <div>
          {/* Profile photo */}
          <div style={{ marginBottom: 20 }}>
            <label className="fl">Profile photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--card-bg)', border: '2px solid var(--border)', flexShrink: 0 }}>
                <SitterAvatar url={avatarUrl} name={sitterName} size={80} radius="0"/>
              </div>
              <div>
                <label style={{ cursor: 'pointer' }}>
                  <span className="bg" style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, fontSize: 12, opacity: uploading === 'avatar' ? .6 : 1 }}>
                    {uploading === 'avatar' ? <><Spinner size={11}/> Uploading…</> : '📷 Upload photo'}
                  </span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files[0], 'avatar')}/>
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Square photo works best · max 5MB</div>
              </div>
            </div>
          </div>

          {/* Headline / cover photo */}
          <div style={{ marginBottom: 20 }}>
            <label className="fl">Cover / banner photo</label>
            <div style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', aspectRatio: '3 / 1', position: 'relative', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {headlineUrl
                ? <img src={headlineUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>No cover photo yet</div>
              }
            </div>
            <label style={{ cursor: 'pointer' }}>
              <span className="bg" style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, fontSize: 12, opacity: uploading === 'headline' ? .6 : 1 }}>
                {uploading === 'headline' ? <><Spinner size={11}/> Uploading…</> : '🖼️ Upload cover photo'}
              </span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files[0], 'headline')}/>
            </label>
          </div>

          {/* Gallery */}
          <div>
            <label className="fl">Photo gallery (up to 8)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {gallery.map((url, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  <button onClick={() => removeGalleryPhoto(url)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
              {gallery.length < 8 && (
                <label style={{ aspectRatio: '1', borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 24 }}>{uploading === 'gallery' ? '⏳' : '+'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Add photo</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files[0], 'gallery')}/>
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QUALIFICATIONS TAB ─────────────────────────────────────── */}
      {activeTab === 'quals' && (
        <div>
          {/* Age ranges */}
          <div style={{ marginBottom: 18 }}>
            <label className="fl">Children I work with</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AGE_RANGES.map(r => (
                <button key={r.id} type="button" onClick={() => toggle(ageRanges, setAgeRanges, r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1px solid ${ageRanges.includes(r.id) ? '#7BAAEE' : 'var(--border)'}`, background: ageRanges.includes(r.id) ? 'rgba(111,163,232,.15)' : 'var(--card-bg)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: ageRanges.includes(r.id) ? '#7BAAEE' : 'var(--text-dim)' }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div style={{ marginBottom: 18 }}>
            <label className="fl">Certifications & training</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CERTIFICATIONS.map(c => (
                <button key={c.id} type="button" onClick={() => toggle(certs, setCerts, c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1px solid ${certs.includes(c.id) ? 'rgba(60,180,100,.4)' : 'var(--border)'}`, background: certs.includes(c.id) ? 'rgba(60,180,100,.12)' : 'var(--card-bg)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 15 }}>{c.icon}</span>
                  <span style={{ fontSize: 12, color: certs.includes(c.id) ? '#5EE89A' : 'var(--text-dim)' }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div style={{ marginBottom: 18 }}>
            <label className="fl">Services I offer</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SERVICES.map(s => (
                <button key={s} type="button" onClick={() => toggle(services, setServices, s)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${services.includes(s) ? '#7BAAEE' : 'var(--border)'}`, background: services.includes(s) ? 'rgba(111,163,232,.15)' : 'var(--card-bg)', color: services.includes(s) ? '#7BAAEE' : 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Comfortable with */}
          <div style={{ marginBottom: 18 }}>
            <label className="fl">Comfortable with</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COMFORTABLE_WITH.map(c => (
                <button key={c} type="button" onClick={() => toggle(comfortable, setComfortable, c)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${comfortable.includes(c) ? 'rgba(200,120,74,.4)' : 'var(--border)'}`, background: comfortable.includes(c) ? 'rgba(200,120,74,.12)' : 'var(--card-bg)', color: comfortable.includes(c) ? '#F5C098' : 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Transportation */}
          <div style={{ marginBottom: 18 }}>
            <label className="fl">Transportation</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ToggleRow label="I have a car" sub="Can commute to families" isOn={hasCar} onToggle={() => setHasCar(v => !v)}/>
              <ToggleRow label="I can drive kids" sub="Happy to transport children when needed" isOn={canDrive} onToggle={() => setCanDrive(v => !v)}/>
            </div>
          </div>

          {/* Background check */}
          <div>
            <label className="fl">Background check</label>
            <ToggleRow label="I have a background check" sub="Families value this" isOn={bgCheck} onToggle={() => setBgCheck(v => !v)}/>
            {bgCheck && (
              <div style={{ marginTop: 8 }}>
                <label className="fl">Date completed</label>
                <input className="fi" type="date" value={bgCheckDate} onChange={e => setBgCheckDate(e.target.value)} style={{ maxWidth: 180 }}/>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AVAILABILITY TAB ───────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Let families know when you're generally available.</div>
          <AvailabilityPicker value={avail} onChange={v => setAvail(v)}/>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="bp" onClick={save} disabled={saving}>{saving ? <><Spinner/> Saving…</> : 'Save Profile'}</button>
      </div>
    </div>
  );
}

// ─── Public Sitter Profile page ───────────────────────────────────────────────

export function PublicSitterProfile({ username, session = null }) {
  const [sitter,     setSitter]     = useState(null);
  const [reviews,    setReviews]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [lightbox,   setLightbox]   = useState(null);
  const [connStatus, setConnStatus] = useState(null);   // null | 'requested' | 'active'
  const [familyId,   setFamilyId]   = useState(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: s, error } = await supabase.from('sitters')
        .select('id,name,tagline,city,state,bio,age_ranges,hourly_rate_min,hourly_rate_max,availability,years_experience,certifications,services,comfortable_with,languages,has_car,can_drive_kids,background_check,background_check_date,response_time,education,avatar_url,headline_photo_url,photo_gallery,public_profile')
        .eq('username', username).eq('public_profile', true).maybeSingle();
      if (!s || error) { setNotFound(true); setLoading(false); return; }
      setSitter(s);

      const { data: r } = await supabase.from('sitter_reviews').select('*').eq('sitter_id', s.id).order('created_at', { ascending: false });
      setReviews(r || []);

      // If logged in as parent, check connection status
      if (session) {
        const { data: mem } = await supabase.from('members').select('family_id').eq('user_id', session.user.id).maybeSingle();
        if (mem?.family_id) {
          setFamilyId(mem.family_id);
          const { data: conn } = await supabase.from('family_sitters').select('status')
            .eq('family_id', mem.family_id).eq('sitter_id', s.id).maybeSingle();
          setConnStatus(conn?.status || null);
        }
      }

      setLoading(false);
    }
    load();
  }, [username, session]);

  async function requestConnection() {
    if (!familyId || !sitter) return;
    setRequesting(true);
    const { data: existing } = await supabase.from('family_sitters').select('id,status')
      .eq('family_id', familyId).eq('sitter_id', sitter.id).maybeSingle();
    if (existing) {
      await supabase.from('family_sitters').update({ status: 'requested' }).eq('id', existing.id);
    } else {
      await supabase.from('family_sitters').insert({ family_id: familyId, sitter_id: sitter.id, status: 'requested', initiated_by: 'family' });
    }
    setConnStatus('requested');
    setRequesting(false);
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={28}/></div>;
  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
      <div style={{ fontSize: 40 }}>➿</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Profile not found</div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>This sitter profile doesn't exist or isn't public.</div>
      <button className="bp" onClick={() => window.location.href = '/?browse'} style={{ marginTop: 8 }}>Browse Sitters</button>
    </div>
  );

  const avgRating  = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const certMap    = Object.fromEntries(CERTIFICATIONS.map(c => [c.id, c]));
  const ageMap     = Object.fromEntries(AGE_RANGES.map(r => [r.id, r]));
  const bioShort   = sitter.bio?.slice(0, 240);
  const hasBioMore = sitter.bio?.length > 240;

  // Determine CTA based on auth state
  const isLoggedInFamily = session && familyId;
  const isLoggedInSitter = session && !familyId;

  function renderCTA() {
    if (isLoggedInSitter) {
      // Viewing as a sitter — just show back link
      return null;
    }
    if (!session) {
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Interested in {sitter.name.split(' ')[0]}?</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Join littleloop to connect and manage your childcare in one place.</div>
          <button className="bp" onClick={() => window.location.href = '/?portal=parent'} style={{ fontSize: 13 }}>Get Started — it's free</button>
        </>
      );
    }
    if (connStatus === 'active') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#88D8B8' }}>You're connected with {sitter.name.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Message them from the Messages tab</div>
          </div>
        </div>
      );
    }
    if (connStatus === 'requested') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5C098' }}>Connection request sent</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Waiting for {sitter.name.split(' ')[0]} to accept</div>
          </div>
        </div>
      );
    }
    // Logged in family, not yet connected
    return (
      <>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Interested in {sitter.name.split(' ')[0]}?</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Send a connection request to get started.</div>
        <button className="bp" onClick={requestConnection} disabled={requesting} style={{ fontSize: 13 }}>
          {requesting ? <><Spinner size={12}/> Sending…</> : '🤝 Request Connection'}
        </button>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 40px', position: 'relative', zIndex: 1 }}>
      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={lightbox} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      {/* Cover photo */}
      <div style={{ height: 200, background: sitter.headline_photo_url ? 'transparent' : 'linear-gradient(135deg,#0C1420,#1A2E4A)', position: 'relative', overflow: 'hidden' }}>
        {sitter.headline_photo_url && <img src={sitter.headline_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.6))' }}/>
        <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 8 }}>
          <button className="bg" onClick={() => window.location.href = '/?browse'} style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.15)' }}>← Back</button>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 14 }}>
          <button className="bp" onClick={() => window.location.href = '/?portal=parent'} style={{ fontSize: 12 }}>Join littleloop</button>
        </div>
      </div>

      {/* Profile header */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: -44, marginBottom: 16 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid var(--body-bg,#0C1420)', overflow: 'hidden', background: 'var(--card-bg)', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => sitter.avatar_url && setLightbox(sitter.avatar_url)}>
            <SitterAvatar url={sitter.avatar_url} name={sitter.name} size={88} radius="0"/>
          </div>
          <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{sitter.name}</h1>
            {sitter.tagline && <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '3px 0 0', fontStyle: 'italic' }}>{sitter.tagline}</p>}
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {(sitter.city || sitter.state) && <Stat icon="📍" text={[sitter.city, sitter.state].filter(Boolean).join(', ')}/>}
          {(sitter.hourly_rate_min || sitter.hourly_rate_max) && <Stat icon="💰" text={`from $${sitter.hourly_rate_min || sitter.hourly_rate_max}/hr`}/>}
          {sitter.years_experience > 0 && <Stat icon="🏅" text={`${sitter.years_experience} yr${sitter.years_experience !== 1 ? 's' : ''} experience`}/>}
          {avgRating && <Stat icon="⭐" text={`${avgRating} (${reviews.length} review${reviews.length !== 1 ? 's' : ''})`}/>}
          {sitter.response_time && <Stat icon="⚡" text={sitter.response_time}/>}
          {sitter.background_check && <Stat icon="✅" text="Background checked" color="#88D8B8"/>}
          {sitter.has_car && <Stat icon="🚗" text="Has car"/>}
        </div>

        {/* CTA */}
        <div style={{ marginBottom: 20, padding: '16px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--border)', textAlign: 'center' }}>
          {renderCTA()}
        </div>

        {/* About */}
        {sitter.bio && (
          <ProfileSection title="About">
            <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-dim)', margin: 0 }}>
              {expanded ? sitter.bio : bioShort}
              {hasBioMore && !expanded && '…'}
            </p>
            {hasBioMore && (
              <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--accent,#7BAAEE)', fontSize: 12, cursor: 'pointer', padding: '6px 0 0', fontWeight: 600 }}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </ProfileSection>
        )}

        {/* Services */}
        {sitter.services?.length > 0 && (
          <ProfileSection title="Services">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sitter.services.map(s => <Chip key={s} label={s}/>)}
            </div>
          </ProfileSection>
        )}

        {/* Works with */}
        {sitter.age_ranges?.length > 0 && (
          <ProfileSection title="Works with">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {sitter.age_ranges.map(id => {
                const r = ageMap[id];
                if (!r) return <Chip key={id} label={id}/>;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16 }}>{r.icon}</span>
                    <div><div style={{ fontSize: 12, fontWeight: 500 }}>{r.label}</div><div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{r.sub}</div></div>
                  </div>
                );
              })}
            </div>
          </ProfileSection>
        )}

        {/* Certifications */}
        {sitter.certifications?.length > 0 && (
          <ProfileSection title="Certifications">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sitter.certifications.map(id => {
                const c = certMap[id];
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(60,180,100,.08)', border: '1px solid rgba(60,180,100,.2)' }}>
                    <span style={{ fontSize: 14 }}>{c?.icon || '✅'}</span>
                    <span style={{ fontSize: 12, color: '#5EE89A' }}>{c?.label || id}</span>
                  </div>
                );
              })}
            </div>
          </ProfileSection>
        )}

        {/* Details grid */}
        {(sitter.education || sitter.languages?.length || sitter.comfortable_with?.length || sitter.has_car || sitter.can_drive_kids) && (
          <ProfileSection title="Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sitter.education && <DetailRow icon="🎓" label="Education" value={sitter.education}/>}
              {sitter.languages?.length > 0 && <DetailRow icon="🗣️" label="Languages" value={sitter.languages.join(', ')}/>}
              {sitter.has_car && <DetailRow icon="🚗" label="Transportation" value={sitter.can_drive_kids ? 'Has car · can drive kids' : 'Has car'}/>}
              {sitter.comfortable_with?.length > 0 && <DetailRow icon="😊" label="Comfortable with" value={sitter.comfortable_with.join(', ')}/>}
            </div>
          </ProfileSection>
        )}

        {/* Availability */}
        {sitter.availability && (() => {
          try {
            const av = typeof sitter.availability === 'string' ? JSON.parse(sitter.availability) : sitter.availability;
            const hasAny = Object.values(av).some(v => Array.isArray(v) && v.length > 0);
            if (!hasAny) return null;
            return <ProfileSection title="Availability"><AvailabilityDisplay value={av}/></ProfileSection>;
          } catch { return null; }
        })()}

        {/* Gallery */}
        {sitter.photo_gallery?.length > 0 && (
          <ProfileSection title="Photos">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {sitter.photo_gallery.map((url, i) => (
                <div key={i} onClick={() => setLightbox(url)} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in' }}>
                  <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ))}
            </div>
          </ProfileSection>
        )}

        {/* Reviews */}
        <ProfileSection title={`Reviews${reviews.length ? ` (${reviews.length})` : ''}`}>
          {reviews.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No reviews yet.</div>
            : reviews.map(r => (
              <div key={r.id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <StarRating value={r.rating} size={13}/>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.reviewer_name || 'A family'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
                {r.review_text && <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>{r.review_text}</p>}
              </div>
            ))
          }
        </ProfileSection>

      </div>
    </div>
  );
}

// ─── Browse Sitters page ──────────────────────────────────────────────────────

export function BrowseSitters({ session = null, familyId = null, familyName = '', onConnected }) {
  const [sitters,     setSitters]     = useState([]);
  const [connections, setConnections] = useState({});  // sitter_id → status
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterAge,   setFilterAge]   = useState('');
  const [filterSvc,   setFilterSvc]   = useState('');
  const [requesting,  setRequesting]  = useState({});

  const isLoggedInFamily = !!(session && familyId);
  const isPublic         = !session;

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('sitters')
        .select('id,name,tagline,city,state,bio,age_ranges,hourly_rate_min,hourly_rate_max,years_experience,certifications,services,avatar_url,username,background_check')
        .eq('public_profile', true).order('name');
      setSitters(data || []);

      // If logged-in family, load existing connection statuses
      if (isLoggedInFamily && data?.length) {
        const { data: conns } = await supabase.from('family_sitters')
          .select('sitter_id,status')
          .eq('family_id', familyId)
          .in('sitter_id', data.map(s => s.id));
        const map = {};
        (conns || []).forEach(c => { map[c.sitter_id] = c.status; });
        setConnections(map);
      }
      setLoading(false);
    }
    load();
  }, [familyId]);

  async function requestConnection(sitter) {
    if (!familyId) return;
    setRequesting(r => ({ ...r, [sitter.id]: true }));
    const existing = connections[sitter.id];
    if (existing && existing !== 'inactive') {
      setRequesting(r => ({ ...r, [sitter.id]: false }));
      return;
    }
    const { error } = existing
      ? await supabase.from('family_sitters').update({ status: 'requested' }).eq('family_id', familyId).eq('sitter_id', sitter.id)
      : await supabase.from('family_sitters').insert({ family_id: familyId, sitter_id: sitter.id, status: 'requested', initiated_by: 'family' });
    if (!error) {
      setConnections(c => ({ ...c, [sitter.id]: 'requested' }));
      onConnected?.();
    }
    setRequesting(r => ({ ...r, [sitter.id]: false }));
  }

  const filtered = sitters.filter(s => {
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase()) && !s.city?.toLowerCase().includes(search.toLowerCase()) && !s.bio?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAge && !s.age_ranges?.includes(filterAge)) return false;
    if (filterSvc && !s.services?.includes(filterSvc)) return false;
    return true;
  });

  const STATUS_LABEL = { active: 'Connected ✓', requested: 'Requested…', pending: 'Pending' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: isLoggedInFamily ? 22 : 28, fontWeight: 600 }}>Find a Sitter ➿</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Browse independent sitters in your area</div>
        </div>
        {isPublic && <button className="bp" onClick={() => window.location.href = '/?portal=parent'} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Sign Up Free</button>}
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, city, or keyword…" style={{ flex: 1, minWidth: 180, marginBottom: 0, fontSize: 13 }}/>
        <select className="fi" value={filterAge} onChange={e => setFilterAge(e.target.value)} style={{ width: 160, marginBottom: 0, fontSize: 12 }}>
          <option value="">All ages</option>
          {AGE_RANGES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
        </select>
        <select className="fi" value={filterSvc} onChange={e => setFilterSvc(e.target.value)} style={{ width: 180, marginBottom: 0, fontSize: 12 }}>
          <option value="">All services</option>
          {SERVICES.slice(0, 10).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={24}/></div>
        : filtered.length === 0
          ? <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No sitters found</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{search || filterAge || filterSvc ? 'Try adjusting your search.' : 'No sitters have created public profiles yet.'}</div>
            </div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(s => {
                const connStatus = connections[s.id];
                return (
                  <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 0 }}>
                      {/* Avatar column */}
                      <div onClick={() => s.username && window.open(`/?sitter=${s.username}`, '_blank')}
                        style={{ width: 76, flexShrink: 0, cursor: s.username ? 'pointer' : 'default', alignSelf: 'stretch', overflow: 'hidden' }}>
                        <SitterAvatar url={s.avatar_url} name={s.name} size={76} radius="0"
                          style={{ width: 76, height: '100%', minHeight: 120 }}/>
                      </div>

                      {/* Info — stacked column for mobile */}
                      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Name + rate */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                          <button onClick={() => s.username && window.open(`/?sitter=${s.username}`, '_blank')}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: s.username ? 'pointer' : 'default', textAlign: 'left', minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>{s.name}</div>
                          </button>
                          {(s.hourly_rate_min || s.hourly_rate_max) && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7BAAEE', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              from ${s.hourly_rate_min || s.hourly_rate_max}/hr
                            </div>
                          )}
                        </div>
                        {/* Tagline */}
                        {s.tagline && <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic', lineHeight: 1.3 }}>{s.tagline}</div>}
                        {/* Bio — 2 lines max */}
                        {s.bio && <div style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>{s.bio}</div>}
                        {/* Tags */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {s.years_experience > 0 && <Tag label={`🏅 ${s.years_experience}yr`}/>}
                          {s.background_check && <Tag label="✅ Checked" color="rgba(60,180,100,.15)" textColor="#5EE89A" borderColor="rgba(60,180,100,.25)"/>}
                          {(s.age_ranges || []).slice(0, 2).map(id => {
                            const r = AGE_RANGES.find(a => a.id === id);
                            return r ? <Tag key={id} label={`${r.icon} ${r.label}`} color="rgba(58,111,212,.1)" textColor="var(--accent,#7BAAEE)" borderColor="rgba(58,111,212,.2)"/> : null;
                          })}
                        </div>
                        {/* CTA — own row, right-aligned, never overflows */}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
                          {s.username && (
                            <button onClick={() => window.open(`/?sitter=${s.username}`, '_blank')} className="bg" style={{ fontSize: 11, padding: '5px 10px' }}>
                              View profile
                            </button>
                          )}
                          {isLoggedInFamily && (
                            connStatus === 'active'
                              ? <span style={{ fontSize: 11, color: '#88D8B8', fontWeight: 600, alignSelf: 'center' }}>✓ Connected</span>
                              : connStatus === 'requested'
                                ? <span style={{ fontSize: 11, color: 'var(--text-faint)', alignSelf: 'center' }}>Requested…</span>
                                : <button className="bp" style={{ fontSize: 11, padding: '5px 12px' }} disabled={requesting[s.id]}
                                    onClick={() => requestConnection(s)}>
                                    {requesting[s.id] ? <Spinner size={10}/> : '+ Connect'}
                                  </button>
                          )}
                          {isPublic && (
                            <button className="bp" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => window.location.href = '/?portal=parent'}>
                              Get started
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }

      {isPublic && (
        <div style={{ textAlign: 'center', marginTop: 32, padding: '20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 10 }}>Are you a sitter? Create your free public profile.</div>
          <button className="bp" onClick={() => window.location.href = '/?portal=sitter'}>Sign Up as a Sitter</button>
        </div>
      )}
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function Toggle({ isOn, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', flexShrink: 0, background: isOn ? 'var(--accent,#3A6FD4)' : 'rgba(255,255,255,.1)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 3, left: isOn ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }}/>
    </div>
  );
}

function ToggleRow({ label, sub, isOn, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>}
      </div>
      <Toggle isOn={isOn} onToggle={onToggle}/>
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function Stat({ icon, text, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: color || 'var(--text-dim)' }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Chip({ label }) {
  return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{label}</span>;
}

function Tag({ label, color, textColor, borderColor }) {
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: color || 'var(--card-bg)', border: `1px solid ${borderColor || 'var(--border)'}`, color: textColor || 'var(--text-faint)' }}>
      {label}
    </span>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{value}</div>
      </div>
    </div>
  );
}
