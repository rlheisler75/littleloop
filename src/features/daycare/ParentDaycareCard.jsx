import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Confirm } from '../../components/ui/Modal';
import SectionLabel from '../../components/ui/SectionLabel';
import Spinner from '../../components/ui/Spinner';
import EnrollmentPacket from './EnrollmentPacket';
import ParentDaycareExtras from './ParentDaycareExtras';
import { loadEnrollment, packetItems, loadContactCounts } from './enrollment';

// Parent Home: the family's daycare(s). A daycare's request to connect is accepted here by
// the family admin; once connected, each child's classroom shows, with the enrollment packet.
export default function ParentDaycareCard({ familyId, links, children, isAdmin, memberRole, onChanged }) {
  const [rooms,   setRooms]   = useState({});    // `${facility}:${child}` -> classroom
  const [packets, setPackets] = useState({});    // facility_id -> { done, total }
  const [packetFor, setPacketFor] = useState(null);
  const [busy,    setBusy]    = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [error,   setError]   = useState(null);

  const kidIds = children.map(c => c.id).join(',');
  const loadPackets = useCallback(async () => {
    const active = links.filter(l => l.status === 'active');
    if (!active.length || !kidIds) { setRooms({}); setPackets({}); return; }
    const [{ data }, { data: fresh }] = await Promise.all([
      supabase.from('facility_enrollments').select('child_id, facility_id, status, classrooms(name, color)')
        .in('child_id', kidIds.split(',')).eq('status', 'active'),
      supabase.from('children').select('*').eq('family_id', familyId),   // current health_confirmed_at
    ]);
    const enrolled = data || [];
    setRooms(Object.fromEntries(enrolled.map(e => [`${e.facility_id}:${e.child_id}`, e.classrooms || { name: 'Enrolled' }])));
    const counts = (await loadContactCounts([familyId]))[familyId] || { emergency: 0, pickup: 0 };
    const out = {};
    for (const l of active) {
      const enr = await loadEnrollment(l.facility_id, [familyId]);
      const kids = (fresh || []).filter(c => enrolled.some(e => e.facility_id === l.facility_id && e.child_id === c.id));
      const items = packetItems({ ...enr, familyId, children: kids, contacts: counts });
      out[l.facility_id] = { done: items.filter(i => i.done).length, total: items.length };
    }
    setPackets(out);
  }, [kidIds, links, familyId]);

  useEffect(() => { loadPackets(); }, [loadPackets]);

  async function respond(link, accept) {
    setBusy(link.facility_id); setError(null);
    const { error: err } = await supabase.rpc('respond_facility_invite', { p_facility_id: link.facility_id, p_family_id: familyId, p_accept: accept });
    setBusy(null);
    if (err) setError(err.message);
    onChanged();
  }

  if (!links.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>Daycare</SectionLabel>
      {error && <div className="al al-e">{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(link => {
          const f = link.facilities || {};
          if (link.status === 'pending') return (
            <div key={link.facility_id} className="card" style={{ padding: '14px 16px', border: '1px solid color-mix(in srgb,var(--accent) 40%,transparent)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏫 {f.name || 'A daycare'} wants to connect with your family</div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
                If you accept, their staff will see your children's names, birthdays, allergies and health notes, your family members and your emergency and pickup contacts. They'll check your children in and out and post classroom updates to your feed.
              </p>
              {isAdmin ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="bp" style={{ fontSize: 13, padding: '8px 16px' }} disabled={busy === link.facility_id} onClick={() => respond(link, true)}>
                    {busy === link.facility_id ? <Spinner/> : 'Accept'}
                  </button>
                  <button className="bg" disabled={busy === link.facility_id} onClick={() => respond(link, false)}>Decline</button>
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Your family's admin can accept this.</div>}
            </div>
          );
          return (
            <div key={link.facility_id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>🏫 {f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {[f.city && f.state ? `${f.city}, ${f.state}` : f.city || f.state].filter(Boolean).join(' · ')}
                    {f.phone && <> {f.city || f.state ? '· ' : ''}<a href={`tel:${f.phone}`} style={{ color: 'var(--accent)' }}>{f.phone}</a></>}
                  </div>
                </div>
                {isAdmin && <button onClick={() => setLeaving(link)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>Disconnect</button>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {children.map(c => {
                  const room = rooms[`${link.facility_id}:${c.id}`];
                  if (!room) return null;
                  return (
                    <span key={c.id} className="chip" style={{ fontSize: 11 }}>
                      {c.avatar || '🌟'} {c.name} · <span style={{ width: 8, height: 8, borderRadius: '50%', background: room.color || '#8B78D4', display: 'inline-block' }}/> {room.name}
                    </span>
                  );
                })}
              </div>
              {packets[link.facility_id] && (() => {
                const p = packets[link.facility_id];
                const complete = p.done === p.total;
                return (
                  <button onClick={() => setPacketFor(link)}
                    style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${complete ? 'rgba(58,158,122,.3)' : 'color-mix(in srgb,var(--accent) 40%,transparent)'}`,
                      background: complete ? 'rgba(58,158,122,.08)' : 'color-mix(in srgb,var(--accent) 8%,transparent)', color: 'var(--text)' }}>
                    <span style={{ fontSize: 20 }}>{complete ? '✅' : '📋'}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>Enrollment packet</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>
                        {complete ? 'Everything is done' : `${p.done} of ${p.total} done · forms, documents and health details`}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{complete ? 'View' : 'Finish'} →</span>
                  </button>
                );
              })()}
              <ParentDaycareExtras facility={{ id: link.facility_id, name: f.name }} memberRole={memberRole}
                kids={children.filter(c => rooms[`${link.facility_id}:${c.id}`])}/>
            </div>
          );
        })}
      </div>
      {packetFor && (
        <EnrollmentPacket open={!!packetFor} onClose={() => setPacketFor(null)} facility={{ id: packetFor.facility_id, ...packetFor.facilities }}
          familyId={familyId} memberRole={memberRole} onChanged={loadPackets}/>
      )}
      <Confirm open={!!leaving} danger title={`Disconnect from ${leaving?.facilities?.name || 'this daycare'}?`}
        message="Their staff will no longer see your family or post to your feed. Past check-ins and updates stay in your history."
        onConfirm={() => { const l = leaving; setLeaving(null); respond(l, false); }} onCancel={() => setLeaving(null)}/>
    </div>
  );
}
