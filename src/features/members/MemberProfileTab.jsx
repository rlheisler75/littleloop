import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { applyTheme } from '../../lib/theme';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import ThemePicker from '../../components/ui/ThemePicker';
import { EmailPreferencesCard, PushPreferencesCard } from '../notifications/index';

// ─── Version stamp ────────────────────────────────────────────────────────────
const FILE_VERSION = 'members/MemberProfileTab.jsx @ 2026-04-08-v1';
if (typeof window !== 'undefined') {
  console.log(
    '%c✅ ' + FILE_VERSION,
    'color:#0BA5AD;font-weight:700;font-size:13px;background:#0D1F1E;padding:2px 8px;border-radius:4px'
  );
}

// ─── Theme Section (preset picker + custom builder) ───────────────────────────

const CUSTOM_ID = 'custom';

function ThemeSection({ currentTheme, onSelect }) {
  const [tab, setTab] = useState('presets');
  const [customColors, setCustomColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ll_custom_theme') || 'null') || defaultCustom(); }
    catch { return defaultCustom(); }
  });
  const [isDark, setIsDark] = useState(() => localStorage.getItem('ll_custom_dark') !== 'false');
  const [customName, setCustomName] = useState(() => localStorage.getItem('ll_custom_name') || 'My Theme');

  function defaultCustom() {
    return { body: '#0D1B2A', card: '#1A2A3A', accent: '#7BAAEE', accent2: '#4A7FCC', nav: '#0A1520' };
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyCustom(colors = customColors, dark = isDark) {
    const root = document.documentElement;
    root.style.setProperty('--body-bg',     colors.body);
    root.style.setProperty('--card-bg',     hexToRgba(colors.card, 0.85));
    root.style.setProperty('--accent',      colors.accent);
    root.style.setProperty('--accent-grad', `linear-gradient(135deg,${colors.accent},${colors.accent2})`);
    root.style.setProperty('--nav-bg',      hexToRgba(colors.nav, 0.85));
    root.style.setProperty('--logo-grad',   `linear-gradient(90deg,${colors.accent},${colors.accent2},${colors.accent})`);
    root.style.setProperty('--orb1',        hexToRgba(colors.accent, 0.2));
    root.style.setProperty('--orb2',        hexToRgba(colors.accent2, 0.15));
    if (dark) {
      root.style.setProperty('--text',         '#E4EAF4');
      root.style.setProperty('--text-dim',     'rgba(255,255,255,.55)');
      root.style.setProperty('--text-faint',   'rgba(255,255,255,.32)');
      root.style.setProperty('--border',       'rgba(255,255,255,.08)');
      root.style.setProperty('--input-bg',     'rgba(255,255,255,.05)');
      root.style.setProperty('--input-border', 'rgba(255,255,255,.10)');
      root.style.setProperty('--pill-bg',      'rgba(255,255,255,.10)');
      root.style.setProperty('--pill-text',    '#E4EAF4');
      root.style.setProperty('--badge-text',   '#E4EAF4');
      root.style.setProperty('--btn-text',     '#FFFFFF');
      root.style.setProperty('--shadow',       '0 2px 16px rgba(0,0,0,.35)');
    } else {
      root.style.setProperty('--text',         '#14243A');
      root.style.setProperty('--text-dim',     'rgba(20,36,58,.58)');
      root.style.setProperty('--text-faint',   'rgba(20,36,58,.35)');
      root.style.setProperty('--border',       'rgba(20,36,58,.10)');
      root.style.setProperty('--input-bg',     'rgba(20,36,58,.04)');
      root.style.setProperty('--input-border', 'rgba(20,36,58,.14)');
      root.style.setProperty('--pill-bg',      'rgba(20,36,58,.08)');
      root.style.setProperty('--pill-text',    '#14243A');
      root.style.setProperty('--badge-text',   '#14243A');
      root.style.setProperty('--btn-text',     '#FFFFFF');
      root.style.setProperty('--shadow',       '0 2px 12px rgba(20,36,58,.10)');
    }
    document.body.style.background = colors.body;
    document.body.style.color = dark ? '#E4EAF4' : '#14243A';
  }

  useEffect(() => { if (currentTheme === CUSTOM_ID) applyCustom(); }, []);

  function handleColorChange(key, val) {
    const next = { ...customColors, [key]: val };
    setCustomColors(next);
    if (currentTheme === CUSTOM_ID) applyCustom(next, isDark);
  }

  function handleDarkToggle(val) {
    setIsDark(val);
    if (currentTheme === CUSTOM_ID) applyCustom(customColors, val);
  }

  function saveAndApply() {
    localStorage.setItem('ll_custom_theme', JSON.stringify(customColors));
    localStorage.setItem('ll_custom_dark',  String(isDark));
    localStorage.setItem('ll_custom_name',  customName);
    localStorage.setItem('ll_theme', CUSTOM_ID);
    applyCustom(customColors, isDark);
    onSelect(CUSTOM_ID);
  }

  const colorFields = [
    { key: 'body',    label: 'Background',   hint: 'Main page background' },
    { key: 'card',    label: 'Card surface',  hint: 'Cards and panels' },
    { key: 'accent',  label: 'Accent (from)', hint: 'Buttons, links, active states' },
    { key: 'accent2', label: 'Accent (to)',   hint: 'Gradient end colour' },
    { key: 'nav',     label: 'Nav bar',       hint: 'Top and bottom navigation' },
  ];

  const seeds = [
    { label: 'Navy',    colors: { body:'#0D1B2A', card:'#1A2A3A', accent:'#7BAAEE', accent2:'#4A7FCC', nav:'#0A1520' }, dark: true  },
    { label: 'Forest',  colors: { body:'#0D1F1A', card:'#1A2E22', accent:'#4CD99A', accent2:'#28A870', nav:'#0A1810' }, dark: true  },
    { label: 'Galaxy',  colors: { body:'#0A0814', card:'#180F28', accent:'#C8A0FF', accent2:'#FF70B8', nav:'#080610' }, dark: true  },
    { label: 'Sunrise', colors: { body:'#FFF8F0', card:'#FFFFFF', accent:'#C85020', accent2:'#A03010', nav:'#FFF0E8' }, dark: false },
    { label: 'Ocean',   colors: { body:'#EEF6FB', card:'#FFFFFF', accent:'#0A68A8', accent2:'#004880', nav:'#E8F4FA' }, dark: false },
    { label: 'Meadow',  colors: { body:'#EFF8F4', card:'#FFFFFF', accent:'#1E7A4A', accent2:'#125030', nav:'#E8F5F0' }, dark: false },
  ];

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🎨 App Theme</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>Choose a preset or build your own.</div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        {[{ id: 'presets', label: '🗂 Presets' }, { id: 'custom', label: '🎛 Custom' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? 'var(--accent)' : 'var(--text-faint)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'presets' && <ThemePicker currentTheme={currentTheme} onSelect={onSelect}/>}

      {tab === 'custom' && (
        <div>
          {/* Live preview bar */}
          <div style={{ height: 44, borderRadius: 10, marginBottom: 16, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, background: customColors.body }}/>
            <div style={{ flex: 1, background: customColors.nav }}/>
            <div style={{ flex: 1, background: customColors.card }}/>
            <div style={{ flex: 2, background: `linear-gradient(90deg,${customColors.accent},${customColors.accent2})` }}/>
          </div>

          {/* Dark / light toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Mode</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Affects text and surface contrast</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ val: true, label: '🌙 Dark' }, { val: false, label: '☀️ Light' }].map(o => (
                <button key={String(o.val)} onClick={() => handleDarkToggle(o.val)} style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: '1px solid var(--border)', transition: 'all .15s',
                  background: isDark === o.val ? 'var(--accent)' : 'var(--input-bg)',
                  color: isDark === o.val ? '#fff' : 'var(--text-dim)',
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Theme name */}
          <div style={{ marginBottom: 14 }}>
            <label className="fl">Theme name</label>
            <input className="fi" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="My Theme" style={{ marginBottom: 0 }}/>
          </div>

          {/* Colour pickers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {colorFields.map(({ key, label, hint }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: customColors[key], border: '2px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}/>
                  <input type="color" value={customColors[key]} onChange={e => handleColorChange(key, e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}/>
                </label>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{hint}</div>
                </div>
                <input value={customColors[key]}
                  onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) handleColorChange(key, v); }}
                  style={{ width: 80, padding: '5px 8px', borderRadius: 7, fontSize: 12, fontFamily: 'monospace',
                    background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)', outline: 'none' }}/>
              </div>
            ))}
          </div>

          {/* Quick seeds */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Quick seeds</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {seeds.map(s => (
                <button key={s.label} onClick={() => { setCustomColors(s.colors); setIsDark(s.dark); if (currentTheme === CUSTOM_ID) applyCustom(s.colors, s.dark); }}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)', background: s.colors.body, transition: 'all .15s',
                    color: s.dark ? 'rgba(255,255,255,.8)' : 'rgba(20,36,58,.7)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button className="bp full" onClick={saveAndApply} style={{ fontSize: 13 }}>
            ✓ Apply{customName && customName !== 'My Theme' ? ` "${customName}"` : ' Custom Theme'}
          </button>
          {currentTheme === CUSTOM_ID && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 8 }}>Custom theme is active</div>
          )}
        </div>
      )}
    </div>
  );
}

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

      {memberId && <EmailPreferencesCard userId={memberId} isSitter={false}/>}
      {memberId && <PushPreferencesCard userId={memberId} isSitter={false}/>}

      <ThemeSection currentTheme={theme} onSelect={selectTheme}/>

      {/* Version stamp */}
      <div style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', marginBottom: 8, opacity: .5, letterSpacing: '.5px' }}>
        {FILE_VERSION}
      </div>
    </div>
  );
}
