import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, Confirm } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import ResourceList from './ResourceList';
import { RESOURCE_CATEGORIES, RESOURCE_ACCEPT, loadResources, uploadResourceFile, removeResourceFile } from './resources';
import { errText } from './api';

// Resources: links and files the daycare shares with its families (financial help,
// scholarships, child development, newsletters, community services). Directors and office
// add them; teachers and parents read them.
export default function ResourcesTab({ facilityId, manager }) {
  const [loading, setLoading] = useState(true);
  const [items,   setItems]   = useState([]);
  const [form,    setForm]    = useState(null);   // null | {} | resource

  const load = useCallback(async () => {
    setItems(await loadResources(facilityId));
    setLoading(false);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 20, fontWeight: 600 }}>Resources for families</div>
        {manager && <button className="bp" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setForm({})}>+ Add a resource</button>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>
        Families connected to your daycare see these on their home screen under your daycare.
      </div>

      {items.length === 0 ? (
        <div className="es"><div className="ic">📚</div><h3>No resources yet</h3>
          <p>{manager
            ? 'Share links and files with your families: childcare assistance and subsidies, scholarships, child development guides, your newsletter, and community services.'
            : 'Your director or office hasn\'t added any yet.'}</p>
          {manager && <button className="bp" onClick={() => setForm({})}>+ Add the first one</button>}
        </div>
      ) : <ResourceList items={items} showHidden={manager} onEdit={manager ? r => setForm(r) : null}/>}

      {form && <ResourceForm facilityId={facilityId} resource={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }}/>}
    </div>
  );
}

function ResourceForm({ facilityId, resource, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    category: resource?.category || 'financial', title: resource?.title || '', description: resource?.description || '',
    url: resource?.url || '', pinned: !!resource?.pinned, published: resource ? resource.published : true,
  }));
  const [file,     setFile]     = useState(null);
  const [dropFile, setDropFile] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [confirm,  setConfirm]  = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const hasFile = (resource?.file_path && !dropFile) || file;

  async function save(e) {
    e.preventDefault();
    const url = f.url.trim();
    if (!f.title.trim()) { setError('Give it a title.'); return; }
    if (url && !/^https?:\/\/\S+$/i.test(url)) { setError('Links start with https:// (copy the address from your browser).'); return; }
    if (!url && !hasFile && !f.description.trim()) { setError('Add a link, a file or a description.'); return; }
    setSaving(true); setError(null);
    let filePatch = {};
    if (file) {
      const up = await uploadResourceFile(facilityId, file);
      if (up.error) { setSaving(false); setError(up.error); return; }
      filePatch = { file_path: up.path, file_name: file.name.slice(0, 200), file_size: file.size, mime_type: file.type || null };
    } else if (dropFile) {
      filePatch = { file_path: null, file_name: null, file_size: null, mime_type: null };
    }
    const row = { category: f.category, title: f.title.trim(), description: f.description.trim() || null, url: url || null,
                  pinned: f.pinned, published: f.published, ...filePatch };
    const { error: err } = resource
      ? await supabase.from('facility_resources').update(row).eq('id', resource.id)
      : await supabase.from('facility_resources').insert({ ...row, facility_id: facilityId });
    if (err) {
      if (filePatch.file_path) await removeResourceFile(filePatch.file_path);
      setSaving(false); setError(errText(err)); return;
    }
    // The old file is no longer used once it was replaced or removed
    if (resource?.file_path && (file || dropFile)) await removeResourceFile(resource.file_path);
    setSaving(false);
    onSaved();
  }

  async function remove() {
    setConfirm(false); setSaving(true); setError(null);
    const { error: err } = await supabase.from('facility_resources').delete().eq('id', resource.id);
    if (err) { setSaving(false); setError(errText(err)); return; }
    await removeResourceFile(resource.file_path);
    setSaving(false);
    onSaved();
  }

  const cat = RESOURCE_CATEGORIES.find(c => c.id === f.category);
  return (
    <Modal open onClose={() => !saving && onClose()}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 21, fontWeight: 600, marginBottom: 12 }}>{resource ? 'Edit resource' : 'Add a resource'}</div>
      {error && <div className="al al-e">{error}</div>}
      <form onSubmit={save}>
        <label className="fl">Category</label>
        <select className="fi" value={f.category} onChange={e => set('category', e.target.value)}>
          {RESOURCE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        {cat?.hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -8, marginBottom: 12 }}>{cat.hint}</div>}

        <label className="fl">Title</label>
        <input className="fi" value={f.title} onChange={e => set('title', e.target.value)} maxLength={150} placeholder="e.g. State childcare assistance program"/>
        <label className="fl">Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <textarea className="fi" rows={3} value={f.description} onChange={e => set('description', e.target.value)} maxLength={1000}
          placeholder="Who it's for, how to apply, deadlines, a phone number…"/>
        <label className="fl">Link <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input className="fi" value={f.url} onChange={e => set('url', e.target.value)} placeholder="https://" inputMode="url" maxLength={1000}/>

        <label className="fl">File <span style={{ fontWeight: 400 }}>(optional: PDF, Word or picture, up to 20 MB)</span></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <button type="button" className="bg" onClick={() => fileRef.current?.click()} style={{ maxWidth: '100%' }}>
            📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file ? file.name : resource?.file_path && !dropFile ? `Replace ${resource.file_name || 'file'}` : 'Choose a file'}
            </span>
          </button>
          {(file || (resource?.file_path && !dropFile)) && (
            <button type="button" onClick={() => { setFile(null); if (resource?.file_path) setDropFile(true); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Remove file</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={RESOURCE_ACCEPT} style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] || null); setDropFile(false); }}/>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.pinned} onChange={e => set('pinned', e.target.checked)}/> 📍 Pin to the top
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)}/> Show to families
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={saving}>{saving ? <Spinner/> : 'Save'}</button>
          {resource && <button type="button" className="bd" style={{ padding: '11px 16px' }} onClick={() => setConfirm(true)} disabled={saving}>Delete</button>}
          <button type="button" className="bg" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
      <Confirm open={confirm} danger title="Delete this resource?" message="Families will no longer see it. If it has a file, the file is deleted too."
        onConfirm={remove} onCancel={() => setConfirm(false)}/>
    </Modal>
  );
}
