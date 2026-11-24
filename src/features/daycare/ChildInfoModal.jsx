import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { ageText } from './api';

const CONTACT_KINDS = [
  { id: 'guardian',  label: 'Parents / guardians' },
  { id: 'pickup',    label: 'Approved pickups' },
  { id: 'emergency', label: 'Emergency contacts' },
];
const ROLE = { admin: 'Parent', member: 'Parent', pickup: 'Pickup', feed_only: 'Family' };

// What a teacher needs at a glance: allergies, health notes, who may pick up, who to call.
export default function ChildInfoModal({ child, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!child) { setData(null); return; }
    let live = true;
    (async () => {
      const [{ data: full }, { data: members }, { data: contacts }] = await Promise.all([
        supabase.from('children').select('*').eq('id', child.id).maybeSingle(),
        supabase.from('members').select('id, name, email, role, status').eq('family_id', child.family_id).neq('status', 'removed'),
        supabase.from('family_contacts').select('*').eq('family_id', child.family_id).order('sort'),
      ]);
      if (live) setData({ full: full || child, members: members || [], contacts: contacts || [] });
    })();
    return () => { live = false; };
  }, [child?.id]);

  if (!child) return null;
  const c = data?.full || child;
  const allergies = (c.allergies || []).filter(Boolean);
  const health = [
    ['Allergy reaction', c.allergy_reaction], ['Diet', c.dietary_restrictions], ['Medications', c.medications],
    ['Medical notes', c.medical_notes], ['Behavior notes', c.behavioral_notes],
    ['Doctor', [c.doctor_name, c.doctor_phone].filter(Boolean).join(' · ')], ['Hospital', c.preferred_hospital],
  ].filter(([, v]) => v);

  return (
    <Modal open={!!child} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 34 }}>{c.avatar || '🌟'}</span>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600 }}>{c.preferred_name || c.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {[c.preferred_name && c.name !== c.preferred_name ? c.name : null, c.dob ? `${ageText(c.dob)} old` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {!data ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner/></div> : (
        <>
          <div className={allergies.length ? 'al al-e' : 'al al-s'} style={{ marginBottom: 14 }}>
            {allergies.length ? <><strong>Allergies:</strong> {allergies.join(', ')}</> : 'No allergies on file.'}
          </div>

          {health.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Health & care</SectionLabel>
              {health.map(([k, v]) => (
                <div key={k} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>{k}: </span>{v}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Family on littleloop</SectionLabel>
            {data.members.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>None yet.</div>
              : data.members.map(m => (
                <div key={m.id} style={{ fontSize: 13, marginBottom: 4 }}>
                  {m.name} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>· {ROLE[m.role] || m.role}{m.status === 'pending' ? ' · invited' : ''}</span>
                </div>
              ))}
          </div>

          {CONTACT_KINDS.map(k => {
            const rows = data.contacts.filter(x => x.kind === k.id);
            if (!rows.length) return null;
            return (
              <div key={k.id} style={{ marginBottom: 14 }}>
                <SectionLabel>{k.label}</SectionLabel>
                {rows.map(p => (
                  <div key={p.id} style={{ fontSize: 13, marginBottom: 4 }}>
                    {p.name}{p.relation ? <span style={{ color: 'var(--text-faint)' }}> ({p.relation})</span> : null}
                    {p.phone && <> · <a href={`tel:${p.phone}`} style={{ color: 'var(--accent)' }}>{p.phone}</a></>}
                  </div>
                ))}
              </div>
            );
          })}
          {!data.contacts.length && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>The family hasn't added emergency contacts or approved pickups yet.</div>}
        </>
      )}
      <button className="bg" onClick={onClose} style={{ marginTop: 4 }}>Close</button>
    </Modal>
  );
}
