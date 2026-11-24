import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { ageText } from './api';
import { fmtDate, openDocument } from './enrollment';

const CONTACT_KINDS = [
  { id: 'guardian',  label: 'Parents / guardians' },
  { id: 'pickup',    label: 'Approved pickups' },
  { id: 'emergency', label: 'Emergency contacts' },
];
const ROLE = { admin: 'Parent', member: 'Parent', pickup: 'Pickup', feed_only: 'Family' };

// What a teacher needs at a glance: allergies, health notes, who may pick up, who to call.
export default function ChildInfoModal({ child, facilityId, onClose }) {
  const [data, setData] = useState(null);
  const [docError, setDocError] = useState(null);

  useEffect(() => {
    if (!child) { setData(null); return; }
    let live = true;
    setDocError(null);
    (async () => {
      const [{ data: full }, { data: members }, { data: contacts }, { data: docs }, { data: consents }] = await Promise.all([
        supabase.from('children').select('*').eq('id', child.id).maybeSingle(),
        supabase.from('members').select('id, name, email, role, status').eq('family_id', child.family_id).neq('status', 'removed'),
        supabase.from('family_contacts').select('*').eq('family_id', child.family_id).order('sort'),
        // Only returns documents this person may open (director/office, home-room teachers).
        facilityId ? supabase.from('child_documents').select('id, doc_type_id, label, file_path, file_name, expires_on, created_at, facility_doc_types(name)')
          .eq('facility_id', facilityId).eq('child_id', child.id).order('created_at', { ascending: false }) : { data: [] },
        facilityId ? supabase.from('facility_form_responses').select('form_id, answer, signed_at, facility_forms(title, consent_question, active)')
          .eq('facility_id', facilityId).eq('family_id', child.family_id).not('answer', 'is', null).order('signed_at', { ascending: false }) : { data: [] },
      ]);
      // Latest answer per consent form; newest document per type.
      const seen = new Set();
      const latestConsents = (consents || []).filter(r => r.facility_forms?.active && !seen.has(r.form_id) && seen.add(r.form_id));
      const seenDoc = new Set();
      const latestDocs = (docs || []).filter(d => !d.doc_type_id || (!seenDoc.has(d.doc_type_id) && seenDoc.add(d.doc_type_id)));
      if (live) setData({ full: full || child, members: members || [], contacts: contacts || [], docs: latestDocs, consents: latestConsents });
    })();
    return () => { live = false; };
  }, [child?.id, facilityId]);

  if (!child) return null;
  const c = data?.full || child;
  const allergies = (c.allergies || []).filter(Boolean);
  const health = [
    ['Allergy reaction', c.allergy_reaction], ['Diet', [...(c.diet_types || []), c.dietary_restrictions].filter(Boolean).join(' · ')],
    ['Feeding', c.feeding_notes], ['Medications', c.medications],
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
            {allergies.length ? <>{c.allergy_severe && <strong>🚨 SEVERE · </strong>}<strong>Allergies:</strong> {allergies.join(', ')}</> : 'No allergies on file.'}
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

          {data.consents.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Permissions</SectionLabel>
              {data.consents.map(r => (
                <div key={r.form_id} style={{ fontSize: 13, marginBottom: 4 }}>
                  {r.answer === 'yes' ? '✅' : '🚫'} {r.facility_forms.title}
                  <span style={{ color: 'var(--text-faint)', fontSize: 11 }}> · {r.answer === 'yes' ? 'Yes' : 'No'}</span>
                </div>
              ))}
            </div>
          )}

          {data.docs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Documents</SectionLabel>
              {docError && <div className="al al-e">{docError}</div>}
              {data.docs.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                  <span style={{ flex: 1 }}>
                    {d.facility_doc_types?.name || d.label || d.file_name}
                    {d.expires_on && <span style={{ fontSize: 11, color: d.expires_on < new Date().toISOString().slice(0, 10) ? 'var(--err-text)' : 'var(--text-faint)' }}> · expires {fmtDate(d.expires_on)}</span>}
                  </span>
                  <button className="bg" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => setDocError(await openDocument(d.file_path))}>View</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <button className="bg" onClick={onClose} style={{ marginTop: 4 }}>Close</button>
    </Modal>
  );
}
