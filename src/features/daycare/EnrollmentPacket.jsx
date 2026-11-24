import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { ChildModal } from '../../components/modals/ChildModal';
import { FamilyInfoModal, loadFamilyInfo } from '../agreements/FamilyInfo';
import { SectionBody } from '../agreements/AgreementView';
import StateChip from './StateChip';
import DocUploadModal from './DocUploadModal';
import { loadEnrollment, packetItems, formState, typesForChild, docState, fmtDate, fmtStamp, openDocument } from './enrollment';

// Parent side: everything the daycare needs from the family, in one place.
export default function EnrollmentPacket({ open, onClose, facility, familyId, memberRole, onChanged }) {
  const canSign  = memberRole === 'admin' || memberRole === 'member';
  const isAdmin  = memberRole === 'admin';
  const [data,      setData]      = useState(null);
  const [kids,      setKids]      = useState([]);      // this family's children enrolled here (fresh copy)
  const [info,      setInfo]      = useState(null);    // { contacts, info } for FamilyInfoModal
  const [signing,   setSigning]   = useState(null);    // form being signed
  const [uploading, setUploading] = useState(null);    // { child, type }
  const [editKid,   setEditKid]   = useState(null);
  const [editInfo,  setEditInfo]  = useState(false);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    const [enr, { data: all }, fi] = await Promise.all([
      loadEnrollment(facility.id, [familyId]),
      supabase.from('children').select('*').eq('family_id', familyId).order('name'),
      loadFamilyInfo(familyId),
    ]);
    const ids = (all || []).map(c => c.id);
    const { data: en } = ids.length
      ? await supabase.from('facility_enrollments').select('child_id').eq('facility_id', facility.id).eq('status', 'active').in('child_id', ids)
      : { data: [] };
    const enrolled = new Set((en || []).map(e => e.child_id));
    setKids((all || []).filter(c => enrolled.has(c.id)));
    setData(enr);
    setInfo(fi);
  }, [facility.id, familyId]);

  useEffect(() => { if (open) { setData(null); setSigning(null); setError(null); load(); } }, [open, load]);

  const changed = () => { load(); onChanged?.(); };

  if (!open) return null;
  const contacts = info ? { emergency: info.contacts.filter(c => c.kind === 'emergency').length, pickup: info.contacts.filter(c => c.kind === 'pickup').length } : null;
  const items = data ? packetItems({ ...data, familyId, children: kids, contacts }) : [];
  const done = items.filter(i => i.done).length;

  return (
    <>
      <Modal open={open && !uploading && !editKid && !editInfo} onClose={onClose}>
        {signing ? (
          <SignForm form={signing} resp={data?.latestResp[`${familyId}:${signing.id}`]} familyId={familyId} canSign={canSign}
            onBack={() => setSigning(null)} onSigned={() => { setSigning(null); changed(); }}/>
        ) : (
          <>
            <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600 }}>Enrollment packet</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>For {facility.name}</div>

            {!data ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner/></div> : (
              <>
                <Progress done={done} total={items.length}/>
                {error && <div className="al al-e">{error}</div>}

                <SectionLabel>Forms to sign</SectionLabel>
                <div style={{ marginBottom: 18 }}>
                  {data.forms.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No forms.</div>}
                  {data.forms.map(f => {
                    const s = formState(f, data.latestResp[`${familyId}:${f.id}`]);
                    return (
                      <Row key={f.id} title={f.title} sub={s.resp ? `${s.resp.signed_name} · ${fmtStamp(s.resp.signed_at)}` : f.consent_question ? 'Yes / No question' : null}
                        chip={<StateChip state={s.state} label={s.label}/>}
                        action={<button className={s.state === 'done' ? 'bg' : 'bp'} style={smallBtn} onClick={() => setSigning(f)}>
                          {s.state === 'done' ? (f.consent_question ? 'Change' : 'View') : 'Read & sign'}
                        </button>}/>
                    );
                  })}
                </div>

                {kids.map(c => (
                  <div key={c.id} style={{ marginBottom: 18 }}>
                    <SectionLabel>{c.avatar || '🌟'} {c.preferred_name || c.name}</SectionLabel>
                    {typesForChild(data.docTypes, c).map(t => {
                      const s = docState(t, data.latestDoc[`${c.id}:${t.id}`]);
                      return (
                        <Row key={t.id} title={t.name} sub={t.description}
                          chip={<StateChip state={s.state} label={s.label}/>}
                          action={<span style={{ display: 'flex', gap: 6 }}>
                            {s.doc && <button className="bg" style={smallBtn} onClick={async () => setError(await openDocument(s.doc.file_path))}>View</button>}
                            <button className={s.state === 'ok' ? 'bg' : 'bp'} style={smallBtn} onClick={() => setUploading({ child: c, type: t })}>{s.doc ? 'Replace' : 'Upload'}</button>
                          </span>}/>
                      );
                    })}
                    {data.otherDocs.filter(d => d.child_id === c.id).map(d => (
                      <Row key={d.id} title={d.label || d.file_name || 'Document'} sub={`Added ${fmtStamp(d.created_at)}`}
                        chip={<StateChip state="ok" label="On file"/>}
                        action={<button className="bg" style={smallBtn} onClick={async () => setError(await openDocument(d.file_path))}>View</button>}/>
                    ))}
                    <Row title="Health & diet details" sub="Allergies, diet, medications, doctor"
                      chip={<StateChip state={c.health_confirmed_at ? 'done' : 'todo'} label={c.health_confirmed_at ? `Confirmed ${fmtStamp(c.health_confirmed_at)}` : 'Please review'}/>}
                      action={isAdmin ? <button className={c.health_confirmed_at ? 'bg' : 'bp'} style={smallBtn} onClick={() => setEditKid(c)}>Review</button> : null}/>
                    <button onClick={() => setUploading({ child: c, type: null })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>
                      + Another document
                    </button>
                  </div>
                ))}
                {kids.length === 0 && <div className="al al-i">The daycare hasn't enrolled any of your children yet.</div>}

                <SectionLabel>Emergency contacts & approved pickups</SectionLabel>
                <Row title={`${contacts.emergency} emergency contact${contacts.emergency === 1 ? '' : 's'} · ${contacts.pickup} approved pickup${contacts.pickup === 1 ? '' : 's'}`}
                  sub="Shared with the daycare so staff know who to call and who may pick up."
                  chip={<StateChip state={contacts.emergency && contacts.pickup ? 'done' : 'todo'} label={contacts.emergency && contacts.pickup ? 'Done' : 'Needed'}/>}
                  action={isAdmin ? <button className="bg" style={smallBtn} onClick={() => setEditInfo(true)}>Edit</button> : null}/>

                {!isAdmin && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>Your family's admin can update health details and contacts.</div>}
                {facility.phone && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>Questions? Call {facility.name} at <a href={`tel:${facility.phone}`} style={{ color: 'var(--accent)' }}>{facility.phone}</a>.</div>}
              </>
            )}
            <button className="bg" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
          </>
        )}
      </Modal>

      <DocUploadModal target={uploading} facilityId={facility.id} role="parent" onClose={() => setUploading(null)} onDone={changed}/>
      <ChildModal open={!!editKid} onClose={() => setEditKid(null)} familyId={familyId} child={editKid} markHealthConfirmed onSaved={changed}/>
      <FamilyInfoModal open={editInfo} onClose={() => setEditInfo(false)} familyId={familyId} initial={info} onSaved={changed}/>
    </>
  );
}

const smallBtn = { fontSize: 11, padding: '5px 11px' };

function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
        <span>{done === total ? 'All done. Thank you!' : `${done} of ${total} done`}</span>
        <span style={{ color: 'var(--text-faint)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done === total ? 'var(--ok-text)' : 'var(--accent-grad,var(--accent))', borderRadius: 6 }}/>
      </div>
    </div>
  );
}

function Row({ title, sub, chip, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {chip}
      {action}
    </div>
  );
}

function SignForm({ form, resp, familyId, canSign, onBack, onSigned }) {
  const [answer, setAnswer] = useState(resp?.answer || '');
  const [name,   setName]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const current = resp && resp.form_version >= form.version;

  async function sign(e) {
    e.preventDefault();
    setError(null);
    if (form.consent_question && !answer) { setError('Choose Yes or No.'); return; }
    if (name.trim().length < 2) { setError('Type your full name to sign.'); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc('sign_facility_form', { p_form_id: form.id, p_family_id: familyId, p_name: name.trim(), p_answer: form.consent_question ? answer : null });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSigned();
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back to the packet</button>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 10 }}>{form.title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)', maxHeight: '40vh', overflowY: 'auto', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14 }}>
        <SectionBody body={form.body}/>
      </div>
      {current && (
        <div className="al al-s">
          Signed by {resp.signed_name} on {fmtStamp(resp.signed_at)}{form.consent_question ? `, answer: ${resp.answer === 'yes' ? 'Yes' : 'No'}` : ''}.
          {form.consent_question ? ' You can change your answer below.' : ''}
        </div>
      )}
      {resp && !current && <div className="al al-w">This form changed since you signed it. Please read and sign again.</div>}
      {error && <div className="al al-e">{error}</div>}
      {canSign && (!current || form.consent_question) ? (
        <form onSubmit={sign}>
          {form.consent_question && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{form.consent_question}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
                  <label key={v} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${answer === v ? 'var(--accent)' : 'var(--border)'}`, background: answer === v ? 'color-mix(in srgb,var(--accent) 12%,transparent)' : 'var(--input-bg)' }}>
                    <input type="radio" name="consent" checked={answer === v} onChange={() => setAnswer(v)}/> {l}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="fl">Type your full name to sign</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" maxLength={120} autoComplete="name"/>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -8, marginBottom: 14 }}>Typing your name and pressing Sign is your signature on this form.</div>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : current ? 'Save my new answer' : 'Sign'}</button>
        </form>
      ) : !canSign ? <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>A parent in your family needs to sign this.</div> : null}
    </div>
  );
}
