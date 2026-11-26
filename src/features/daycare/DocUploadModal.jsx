import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { DOC_ACCEPT, uploadChildDocument, localDate, fmtDate } from './enrollment';

// Upload one document for a child. `target` = { child, type } (type null = "Other").
export default function DocUploadModal({ target, facilityId, role, onClose, onDone }) {
  const [file,   setFile]   = useState(null);
  const [date,   setDate]   = useState(localDate());
  const [label,  setLabel]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setFile(null); setDate(localDate()); setLabel(''); setError(null); setSaving(false); }, [target?.child?.id, target?.type?.id]);

  if (!target) return null;
  const { child, type } = target;
  const renews = type?.renew_months;
  const expires = renews && date ? (() => { const d = new Date(date + 'T12:00:00'); d.setMonth(d.getMonth() + renews); return localDate(d); })() : null;

  async function upload(e) {
    e.preventDefault();
    if (!file) { setError('Choose a photo or PDF of the document.'); return; }
    if (!type && !label.trim()) { setError('Say what the document is.'); return; }
    setSaving(true); setError(null);
    const r = await uploadChildDocument({
      facilityId, childId: child.id, docTypeId: type?.id || null, label: type ? null : label.trim(),
      file, effectiveDate: renews ? date : null, role,
    });
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    onDone();
    onClose();
  }

  return (
    <Modal open={!!target} onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 2 }}>{type?.name || 'Other document'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>For {child.preferred_name || child.name}{type?.description ? ` · ${type.description}` : ''}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={upload}>
        {!type && (
          <>
            <label className="fl">What is it?</label>
            <input className="fi" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Note from Dr. Lee" maxLength={120}/>
          </>
        )}
        <label className="fl">File</label>
        <button type="button" className="bg" onClick={() => fileRef.current?.click()} style={{ marginBottom: 14, maxWidth: '100%' }}>
          📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? file.name : 'Take a photo or choose a file'}</span>
        </button>
        <input ref={fileRef} type="file" accept={DOC_ACCEPT} style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)}/>
        {renews && (
          <>
            <label className="fl">Date on the document</label>
            <input className="fi" type="date" value={date} max={localDate()} onChange={e => setDate(e.target.value)}/>
            {expires && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -8, marginBottom: 14 }}>Good until {fmtDate(expires)} (renewed every {renews === 12 ? 'year' : `${renews} months`}).</div>}
          </>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
          Photo or PDF, up to 15 MB. {role === 'parent'
            ? 'Only your family and the daycare\'s director, office and your child\'s teachers can open it.'
            : 'The family, your director and office, and the child\'s home-room teachers can open it.'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <><Spinner/> Uploading…</> : 'Upload'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
