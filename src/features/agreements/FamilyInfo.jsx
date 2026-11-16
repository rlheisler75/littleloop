import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { esc } from '../../services/format';
import { loopMarkSvg } from '../../lib/loopMark';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';

const KINDS = [
  { id: 'guardian',  label: 'Parents / Guardians',  icon: '👪', add: '+ Add parent/guardian', hint: 'Everyone with legal responsibility for the children.' },
  { id: 'emergency', label: 'Emergency Contacts',   icon: '🚨', add: '+ Add emergency contact', hint: 'Called if a parent can’t be reached.' },
  { id: 'pickup',    label: 'Approved Pickups',     icon: '🚗', add: '+ Add approved pickup', hint: 'Only these people (and parents) may pick up. The sitter may ask for photo ID.' },
];

export async function loadFamilyInfo(familyId) {
  const [{ data: contacts }, { data: info }] = await Promise.all([
    supabase.from('family_contacts').select('*').eq('family_id', familyId).order('sort').order('created_at'),
    supabase.from('family_care_info').select('*').eq('family_id', familyId).maybeSingle(),
  ]);
  return { contacts: contacts || [], info: info || null };
}

const tel = p => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;

function age(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
}

// ─── Parent home card ────────────────────────────────────────────────────────

export function FamilyCareInfoCard({ familyId, familyName, children, isAdmin }) {
  const [data,     setData]     = useState(null);
  const [editing,  setEditing]  = useState(false);
  const [showCard, setShowCard] = useState(false);

  const load = useCallback(async () => setData(await loadFamilyInfo(familyId)), [familyId]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const count = k => data.contacts.filter(c => c.kind === k).length;
  const missing = [];
  if (!count('emergency')) missing.push('emergency contacts');
  if (!count('pickup'))    missing.push('approved pickups');
  if (children.some(c => !c.doctor_name)) missing.push("each child's doctor");

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionLabel>Emergency &amp; Pickup Info</SectionLabel>
        {isAdmin && <button className="bp" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditing(true)}>Edit</button>}
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-dim)' }}>
          {KINDS.map(k => <span key={k.id}>{k.icon} {count(k.id)} {k.label.toLowerCase()}</span>)}
        </div>
        {missing.length > 0 && isAdmin && (
          <div style={{ fontSize: 12, color: 'var(--warn-text,#B7791F)', marginTop: 8 }}>
            Still needed: {missing.join(', ')}. {children.some(c => !c.doctor_name) && 'Add doctors by editing each child (✏️).'}
          </div>
        )}
        <button className="bg" style={{ fontSize: 11, padding: '5px 10px', marginTop: 10 }} onClick={() => setShowCard(true)}>🚑 View emergency card</button>
      </div>
      <FamilyInfoModal open={editing} onClose={() => setEditing(false)} familyId={familyId} initial={data} onSaved={load}/>
      <EmergencyCardModal open={showCard} onClose={() => setShowCard(false)} familyId={familyId} familyName={familyName} children={children}/>
    </div>
  );
}

// ─── Edit contacts + address (family admins) ─────────────────────────────────

export function FamilyInfoModal({ open, onClose, familyId, initial, onSaved }) {
  const [rows,    setRows]    = useState([]);
  const [address, setAddress] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [alert,   setAlert]   = useState(null);

  useEffect(() => {
    if (!open) return;
    setRows((initial?.contacts || []).map(c => ({ ...c })));
    setAddress(initial?.info?.home_address || '');
    setAlert(null);
  }, [open, initial]);

  const set = (i, patch) => setRows(r => r.map((x, j) => j === i ? { ...x, ...patch } : x));

  async function save() {
    const keep = rows.filter(r => r.name?.trim());
    setSaving(true); setAlert(null);
    try {
      const removed = (initial?.contacts || []).filter(c => !keep.some(k => k.id === c.id)).map(c => c.id);
      if (removed.length) { const { error } = await supabase.from('family_contacts').delete().in('id', removed); if (error) throw error; }
      const payload = keep.map((r, i) => ({
        ...(r.id ? { id: r.id } : {}), family_id: familyId, kind: r.kind, sort: i,
        name: r.name.trim(), relation: r.relation?.trim() || null, phone: r.phone?.trim() || null, email: r.email?.trim() || null,
      }));
      const existing = payload.filter(p => p.id), fresh = payload.filter(p => !p.id);
      if (existing.length) { const { error } = await supabase.from('family_contacts').upsert(existing); if (error) throw error; }
      if (fresh.length)    { const { error } = await supabase.from('family_contacts').insert(fresh);    if (error) throw error; }
      const { error: infoErr } = await supabase.from('family_care_info').upsert({ family_id: familyId, home_address: address.trim() || null, updated_at: new Date().toISOString() });
      if (infoErr) throw infoErr;
      onSaved?.(); onClose();
    } catch (e) { setAlert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Emergency &amp; Pickup Info</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>Shared with your connected sitters. Children's allergies, medications and doctors are on each child (✏️ on the Home tab).</p>
      {alert && <div className="al al-e">{alert}</div>}

      <label className="fl">Home address</label>
      <input className="fi" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, city"/>

      {KINDS.map(k => (
        <div key={k.id} style={{ marginBottom: 16 }}>
          <SectionLabel>{k.icon} {k.label}</SectionLabel>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-2px 0 8px' }}>{k.hint}</div>
          {rows.map((r, i) => r.kind !== k.id ? null : (
            <div key={r.id || `n${i}`} style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input className="fi" style={{ marginBottom: 0 }} placeholder="Name" value={r.name || ''} onChange={e => set(i, { name: e.target.value })}/>
                <input className="fi" style={{ marginBottom: 0 }} placeholder={k.id === 'guardian' ? 'Mom, Dad, Guardian…' : 'Relationship'} value={r.relation || ''} onChange={e => set(i, { relation: e.target.value })}/>
                <input className="fi" style={{ marginBottom: 0 }} placeholder="Phone" type="tel" value={r.phone || ''} onChange={e => set(i, { phone: e.target.value })}/>
                <input className="fi" style={{ marginBottom: 0 }} placeholder="Email (optional)" type="email" value={r.email || ''} onChange={e => set(i, { email: e.target.value })}/>
              </div>
              <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: 'var(--err-text)', cursor: 'pointer', padding: 0 }}>Remove</button>
            </div>
          ))}
          <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setRows(rs => [...rs, { kind: k.id, name: '', relation: '', phone: '', email: '' }])}>{k.add}</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="bp full" onClick={save} disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Emergency card (sitters + parents) ──────────────────────────────────────

export function EmergencyCardModal({ open, onClose, familyId, familyName, children }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (open) { setData(null); loadFamilyInfo(familyId).then(setData); } }, [open, familyId]);

  const by = k => (data?.contacts || []).filter(c => c.kind === k);

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600 }}>🚑 {familyName}</div>
        {data && <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => printEmergencyCard(familyName, children, data)}>🖨️ Print</button>}
      </div>
      {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children.map(c => <ChildEmergency key={c.id} c={c}/>)}
          {KINDS.map(k => (
            <div key={k.id}>
              <SectionLabel>{k.icon} {k.label}</SectionLabel>
              {by(k.id).length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>None added</div>
                : by(k.id).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><strong>{p.name}</strong>{p.relation && <span style={{ color: 'var(--text-faint)' }}> · {p.relation}</span>}</div>
                      {p.phone && <a href={tel(p.phone)} className="bp" style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none' }}>📞 {p.phone}</a>}
                    </div>
                  ))}
            </div>
          ))}
          {data.info?.home_address && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>🏠 {data.info.home_address}</div>}
        </div>
      )}
      <button className="bg" onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>Close</button>
    </Modal>
  );
}

function ChildEmergency({ c }) {
  const a = age(c.dob);
  const Row = ({ label, value, href }) => !value ? null : (
    <div style={{ fontSize: 12, marginTop: 4 }}>
      <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>{label}: </span>
      {href ? <a href={href} style={{ color: 'var(--accent)' }}>{value}</a> : <span style={{ color: 'var(--text)' }}>{value}</span>}
    </div>
  );
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: `color-mix(in srgb,${c.color || 'var(--accent)'} 7%,transparent)`, border: `1px solid color-mix(in srgb,${c.color || 'var(--accent)'} 22%,transparent)` }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{c.avatar || '🌟'} {c.name}{c.preferred_name && c.preferred_name !== c.name ? ` (“${c.preferred_name}”)` : ''}{a !== null && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-faint)' }}> · age {a}</span>}</div>
      {c.allergies?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {c.allergies.map((x, i) => <span key={i} className="chip" style={{ background: 'rgba(192,80,80,.1)', borderColor: 'rgba(192,80,80,.25)', color: 'var(--err-text)' }}>⚠️ {x}</span>)}
        </div>
      )}
      <Row label="Reaction & what to do" value={c.allergy_reaction}/>
      <Row label="Medications" value={c.medications}/>
      <Row label="Medical / special needs" value={c.medical_notes}/>
      <Row label="Diet" value={c.dietary_restrictions}/>
      <Row label="Doctor" value={[c.doctor_name, c.doctor_phone].filter(Boolean).join(' · ')} href={c.doctor_phone ? tel(c.doctor_phone) : null}/>
      <Row label="Preferred hospital" value={c.preferred_hospital}/>
      <Row label="Insurance" value={c.insurance_info}/>
      {!c.allergies?.length && !c.medications && !c.medical_notes && !c.doctor_name && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginTop: 4 }}>No medical details added.</div>
      )}
    </div>
  );
}

function printEmergencyCard(familyName, children, data) {
  const by = k => data.contacts.filter(c => c.kind === k);
  const row = (k, v) => v ? `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>` : '';
  const kids = children.map(c => `
    <div class="kid"><h2>${esc(c.name)}${c.preferred_name && c.preferred_name !== c.name ? ` (“${esc(c.preferred_name)}”)` : ''}${c.dob ? ` <span>· born ${esc(new Date(c.dob + 'T00:00:00').toLocaleDateString())}</span>` : ''}</h2>
    <table>${row('Allergies', (c.allergies || []).join(', ') || 'None listed')}${row('Reaction & what to do', c.allergy_reaction)}${row('Medications', c.medications)}${row('Medical / special needs', c.medical_notes)}${row('Diet', c.dietary_restrictions)}${row('Doctor', [c.doctor_name, c.doctor_phone].filter(Boolean).join(' · '))}${row('Preferred hospital', c.preferred_hospital)}${row('Insurance', c.insurance_info)}</table></div>`).join('');
  const people = KINDS.map(k => `<h3>${esc(k.label)}</h3><table>${by(k.id).map(p => `<tr><td>${esc(p.name)}${p.relation ? ` (${esc(p.relation)})` : ''}</td><td>${esc(p.phone || '')}</td></tr>`).join('') || '<tr><td colspan="2"><em>None added</em></td></tr>'}</table>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Emergency card · ${esc(familyName)}</title>
<style>body{font-family:'Helvetica Neue',Arial,sans-serif;color:#22244D;max-width:720px;margin:28px auto;padding:0 22px;font-size:13px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#E8553F}h1{font-size:22px;margin:10px 0 4px}
h2{font-size:16px;margin:0 0 6px}h2 span{font-weight:400;color:#666;font-size:13px}h3{font-size:14px;margin:16px 0 4px}
.kid{border:2px solid #E8553F;border-radius:10px;padding:10px 12px;margin:12px 0;break-inside:avoid}
table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:5px 6px;vertical-align:top}td:first-child{width:38%;font-weight:600}
@media print{.no-print{display:none}}</style></head><body>
<div class="brand">${loopMarkSvg()}littleloop</div>
<h1>Emergency card · ${esc(familyName)}</h1>${data.info?.home_address ? `<div>Home: ${esc(data.info.home_address)}</div>` : ''}
<div style="margin-top:6px;font-weight:700;color:#C0392B">In a life-threatening emergency, call 911 first.</div>
${kids}${people}
<div style="font-size:11px;color:#666;margin-top:16px">Printed ${esc(new Date().toLocaleDateString())}. Keep private; contains medical information.</div>
<div class="no-print" style="text-align:center;margin:22px 0"><button onclick="window.print()" style="padding:12px 28px;background:#E8553F;color:#fff;border:none;border-radius:999px;font-size:14px;font-weight:600;cursor:pointer">Print</button></div>
</body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
}
