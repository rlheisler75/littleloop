import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { errText } from './api';

// Center → Enrollment packet: the forms families sign and the documents each child needs.
export default function EnrollmentSetup({ facilityId }) {
  const [forms,   setForms]   = useState([]);
  const [types,   setTypes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState(null);
  const [editType, setEditType] = useState(null);
  const [alert,   setAlert]   = useState(null);

  const load = useCallback(async () => {
    const [{ data: f }, { data: t }] = await Promise.all([
      supabase.from('facility_forms').select('*').eq('facility_id', facilityId).order('active', { ascending: false }).order('sort').order('created_at'),
      supabase.from('facility_doc_types').select('*').eq('facility_id', facilityId).order('active', { ascending: false }).order('sort').order('created_at'),
    ]);
    setForms(f || []); setTypes(t || []); setLoading(false);
  }, [facilityId]);
  useEffect(() => { load(); }, [load]);

  async function setActive(table, row, active) {
    setAlert(null);
    const { error } = await supabase.from(table).update({ active }).eq('id', row.id);
    if (error) setAlert(errText(error));
    load();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spinner/></div>;

  return (
    <div className="card" style={{ padding: '18px 18px 10px', marginTop: 16 }}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Enrollment packet</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 14 }}>
        What families complete when they enroll. Parents see it on their Home screen; the Records tab shows who's missing what.
        The starter forms are a beginning: have your licensing consultant or attorney review the wording.
      </p>
      {alert && <div className="al al-e">{alert}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Forms to sign</SectionLabel>
        <button className="bg" style={smallBtn} onClick={() => setEditForm({})}>+ Add form</button>
      </div>
      {forms.map(f => (
        <ListRow key={f.id} muted={!f.active}
          title={f.title}
          sub={[f.consent_question ? 'Yes / No' : 'Signature', f.required ? 'Required' : 'Optional', f.purpose === 'photo' ? 'Controls classroom photos' : null, !f.active ? 'Archived' : null].filter(Boolean).join(' · ')}
          actions={<>
            {f.active && <button className="bg" style={smallBtn} onClick={() => setEditForm(f)}>Edit</button>}
            <button className="bg" style={smallBtn} onClick={() => setActive('facility_forms', f, !f.active)}>{f.active ? 'Archive' : 'Restore'}</button>
          </>}/>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
        <SectionLabel>Documents for each child</SectionLabel>
        <button className="bg" style={smallBtn} onClick={() => setEditType({})}>+ Add document</button>
      </div>
      {types.map(t => (
        <ListRow key={t.id} muted={!t.active}
          title={t.name}
          sub={[t.required ? 'Required' : 'Optional', t.renew_months ? `renew every ${t.renew_months === 12 ? 'year' : `${t.renew_months} months`}` : 'no expiry',
            t.only_with_allergies ? 'only for children with allergies' : null, !t.active ? 'Archived' : null].filter(Boolean).join(' · ')}
          actions={<>
            {t.active && <button className="bg" style={smallBtn} onClick={() => setEditType(t)}>Edit</button>}
            <button className="bg" style={smallBtn} onClick={() => setActive('facility_doc_types', t, !t.active)}>{t.active ? 'Archive' : 'Restore'}</button>
          </>}/>
      ))}

      <FormModal form={editForm} facilityId={facilityId} nextSort={forms.length} onClose={() => setEditForm(null)} onSaved={() => { setEditForm(null); load(); }}/>
      <TypeModal type={editType} facilityId={facilityId} nextSort={types.length} onClose={() => setEditType(null)} onSaved={() => { setEditType(null); load(); }}/>
    </div>
  );
}

const smallBtn = { fontSize: 11, padding: '5px 10px' };

function ListRow({ title, sub, actions, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: muted ? .55 : 1, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>{actions}</div>
    </div>
  );
}

function FormModal({ form, facilityId, nextSort, onClose, onSaved }) {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [ask,      setAsk]      = useState(false);
  const [question, setQuestion] = useState('');
  const [required, setRequired] = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!form) return;
    setTitle(form.title || ''); setBody(form.body || ''); setAsk(!!form.consent_question || form.purpose === 'photo');
    setQuestion(form.consent_question || ''); setRequired(form.required ?? true); setError(null);
  }, [form]);

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Give the form a title.'); return; }
    if (ask && !question.trim()) { setError('Write the Yes / No question.'); return; }
    setSaving(true); setError(null);
    const row = { title: title.trim(), body: body.trim(), consent_question: ask ? question.trim() : null, required };
    const { error: err } = form.id
      ? await supabase.from('facility_forms').update(row).eq('id', form.id)
      : await supabase.from('facility_forms').insert({ ...row, facility_id: facilityId, sort: nextSort });
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved();
  }

  return (
    <Modal open={!!form} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 12 }}>{form?.id ? 'Edit form' : 'Add a form'}</div>
      {form?.id && <div className="al al-w">Changing the wording asks every family to read and sign it again.</div>}
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Title</label>
        <input className="fi" value={title} onChange={e => setTitle(e.target.value)} maxLength={120}/>
        <label className="fl">Wording</label>
        <textarea className="fi" rows={9} value={body} onChange={e => setBody(e.target.value)} maxLength={20000} style={{ resize: 'vertical' }}
          placeholder={'Paragraphs separated by a blank line.\n- Lines starting with a dash become bullets.'}/>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10, cursor: form?.purpose === 'photo' ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={ask} disabled={form?.purpose === 'photo'} onChange={e => setAsk(e.target.checked)}/> Ask parents a Yes / No question
        </label>
        {ask && <input className="fi" value={question} onChange={e => setQuestion(e.target.value)} maxLength={300} placeholder="May we…?"/>}
        {form?.purpose === 'photo' && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -8, marginBottom: 12 }}>A "No" here keeps that child out of photo updates.</div>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)}/> Required for every family
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function TypeModal({ type, facilityId, nextSort, onClose, onSaved }) {
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [required, setRequired] = useState(true);
  const [renews,   setRenews]   = useState('');
  const [allergy,  setAllergy]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!type) return;
    setName(type.name || ''); setDesc(type.description || ''); setRequired(type.required ?? true);
    setRenews(type.renew_months ? String(type.renew_months) : ''); setAllergy(!!type.only_with_allergies); setError(null);
  }, [type]);

  async function save(e) {
    e.preventDefault();
    const months = renews === '' ? null : parseInt(renews, 10);
    if (!name.trim()) { setError('Name the document.'); return; }
    if (months !== null && !(months >= 1 && months <= 120)) { setError('Renewal must be 1 to 120 months, or blank for no expiry.'); return; }
    setSaving(true); setError(null);
    const row = { name: name.trim(), description: desc.trim() || null, required, renew_months: months, only_with_allergies: allergy };
    const { error: err } = type.id
      ? await supabase.from('facility_doc_types').update(row).eq('id', type.id)
      : await supabase.from('facility_doc_types').insert({ ...row, facility_id: facilityId, sort: nextSort });
    setSaving(false);
    if (err) { setError(errText(err)); return; }
    onSaved();
  }

  return (
    <Modal open={!!type} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 12 }}>{type?.id ? 'Edit document' : 'Add a document'}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Name</label>
        <input className="fi" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Immunization record"/>
        <label className="fl">Note for parents (optional)</label>
        <input className="fi" value={desc} onChange={e => setDesc(e.target.value)} maxLength={300}/>
        <label className="fl">Renew every (months)</label>
        <input className="fi" type="number" min={1} max={120} value={renews} onChange={e => setRenews(e.target.value)} placeholder="Blank = doesn't expire"/>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)}/> Required
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={allergy} onChange={e => setAllergy(e.target.checked)}/> Only for children with allergies
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
