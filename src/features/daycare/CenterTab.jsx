import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { roleLabel, errText } from './api';

const FIELDS = [
  ['name', 'Daycare name', 120], ['phone', 'Phone', 40], ['email', 'Email', 200],
  ['address_line1', 'Street address', 200], ['city', 'City', 100], ['state', 'State', 40], ['zip', 'ZIP', 20],
  ['license_number', 'State license number', 80],
];

// The daycare's details. Directors edit; everyone else sees them.
export default function CenterTab({ facility, me, director, onFacilityChanged }) {
  const [form,   setForm]   = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, facility[k] || ''])));
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  useEffect(() => { setForm(Object.fromEntries(FIELDS.map(([k]) => [k, facility[k] || '']))); }, [facility.id]);

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { setAlert({ t: 'e', m: 'The daycare needs a name.' }); return; }
    setSaving(true); setAlert(null);
    const row = Object.fromEntries(FIELDS.map(([k]) => [k, form[k].trim() || null]));
    const { error } = await supabase.from('facilities').update(row).eq('id', facility.id);
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: errText(error) }); return; }
    setAlert({ t: 's', m: 'Saved.' });
    onFacilityChanged();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ padding: '18px 18px 8px', marginBottom: 16 }}>
        <SectionLabel>Your account here</SectionLabel>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{me.name || 'You'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>{roleLabel(me.role)} at {facility.name}</div>
      </div>

      <div className="card" style={{ padding: '18px 18px 6px' }}>
        <SectionLabel>Daycare details</SectionLabel>
        {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}
        {director ? (
          <form onSubmit={save}>
            {FIELDS.map(([k, label, max]) => (
              <div key={k}>
                <label className="fl">{label}</label>
                <input className="fi" value={form[k]} maxLength={max} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  type={k === 'email' ? 'email' : 'text'} inputMode={k === 'phone' ? 'tel' : undefined}/>
              </div>
            ))}
            <button type="submit" className="bp" disabled={saving} style={{ marginBottom: 14 }}>{saving ? <Spinner/> : 'Save details'}</button>
          </form>
        ) : (
          <div style={{ paddingBottom: 12 }}>
            {FIELDS.filter(([k]) => facility[k]).map(([k, label]) => (
              <div key={k} style={{ fontSize: 13, marginBottom: 6 }}><span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>{label}: </span>{facility[k]}</div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Only a director can change these.</div>
          </div>
        )}
      </div>
    </div>
  );
}
