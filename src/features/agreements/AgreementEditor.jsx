import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import { Confirm, Modal } from '../../components/ui/Modal';
import AgreementView from './AgreementView';
import { DEFAULT_TITLE, defaultSections, findBlanks, newSectionId } from './defaultTemplate';

export async function loadTemplate(sitterId) {
  const { data } = await supabase.from('care_agreement_templates').select('*').eq('sitter_id', sitterId).maybeSingle();
  return data || null;
}

// Sitter Profile → "Care Agreement" card.
export default function CareAgreementEditor({ sitterId }) {
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(null);   // row in DB, or null when using the default
  const [open,      setOpen]      = useState(false);
  const [title,     setTitle]     = useState(DEFAULT_TITLE);
  const [biz,       setBiz]       = useState('');
  const [sections,  setSections]  = useState(defaultSections());
  const [expanded,  setExpanded]  = useState(null);
  const [preview,   setPreview]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [alert,     setAlert]     = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dirty,     setDirty]     = useState(false);

  useEffect(() => {
    (async () => {
      const row = await loadTemplate(sitterId);
      if (row) { setSaved(row); setTitle(row.title); setBiz(row.business_name || ''); setSections(row.sections?.length ? row.sections : defaultSections()); }
      setLoading(false);
    })();
  }, [sitterId]);

  const blanks = findBlanks(sections);
  const touch = () => { setDirty(true); setAlert(null); };

  function update(id, patch) { setSections(s => s.map(x => x.id === id ? { ...x, ...patch } : x)); touch(); }
  function move(i, d) {
    setSections(s => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
    touch();
  }
  function remove(id) { setSections(s => s.filter(x => x.id !== id)); touch(); }
  function add() { const id = newSectionId(); setSections(s => [...s, { id, title: 'New section', body: '' }]); setExpanded(id); touch(); }

  // "Keep example": accept the bracketed sample text as written.
  function keepBlank(sectionTitle, text) {
    setSections(s => s.map(x => {
      if (x.title !== sectionTitle) return x;
      const token = `[${text}]`;
      if (x.body.includes(token)) return { ...x, body: x.body.replace(token, text) };
      return { ...x, title: x.title.replace(token, text) };
    }));
    touch();
  }

  // Blanks that need the sitter's own answer; everything else has a usable example.
  const mustFill = t => /^optional/i.test(t) || /^(shelter location|where and how)/i.test(t);

  function keepAll() {
    const strip = str => str.replace(/\[([^\]]{1,80})\]/g, (m, t) => mustFill(t) ? m : t);
    setSections(s => s.map(x => ({ ...x, title: strip(x.title), body: strip(x.body) })));
    touch();
  }

  async function save() {
    if (!title.trim()) { setAlert({ t: 'e', m: 'Give your agreement a title.' }); return; }
    const clean = sections.map(s => ({ id: s.id, title: s.title.trim() || 'Untitled section', body: s.body.trim() }));
    setSaving(true);
    const row = { sitter_id: sitterId, title: title.trim(), business_name: biz.trim() || null, sections: clean, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('care_agreement_templates').upsert(row).select().single();
    setSaving(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setSaved(data); setSections(clean); setDirty(false);
    setAlert({ t: 's', m: 'Agreement saved. Families you send it to get a copy of this version.' });
  }

  function resetToDefault() {
    setTitle(DEFAULT_TITLE); setSections(defaultSections()); setConfirmReset(false); setExpanded(null); touch();
  }

  if (loading) return null;

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 16, fontWeight: 600 }}>📜 Care Agreement</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
            {saved ? `Your rules & policies · ${sections.length} sections · updated ${new Date(saved.updated_at).toLocaleDateString()}` : 'Your rules & policies for families. Starts from the littleloop template.'}
          </div>
        </div>
        <button className={saved ? 'bg' : 'bp'} style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }} onClick={() => setOpen(o => !o)}>
          {open ? 'Close' : saved ? 'Edit' : 'Set up'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

          <label className="fl">Business name (optional)</label>
          <input className="fi" value={biz} onChange={e => { setBiz(e.target.value); touch(); }} placeholder="e.g. Cozy Nest Childcare"/>
          <label className="fl">Agreement title</label>
          <input className="fi" value={title} onChange={e => { setTitle(e.target.value); touch(); }}/>

          {blanks.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 14, background: 'color-mix(in srgb,var(--warn-text,#B7791F) 8%,transparent)', border: '1px solid color-mix(in srgb,var(--warn-text,#B7791F) 25%,transparent)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn-text,#B7791F)', marginBottom: 4 }}>{blanks.length} blank{blanks.length !== 1 ? 's' : ''} to fill in</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Text in [brackets] is an example. Edit it in the section below, or keep the example as written.</div>
              {blanks.some(b => !mustFill(b.text)) && <button className="bg" style={{ fontSize: 11, padding: '4px 10px', marginBottom: 8 }} onClick={keepAll}>Keep all examples</button>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {blanks.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--text-faint)' }}>{b.section}:</span> <strong>[{b.text}]</strong></span>
                    {!mustFill(b.text) && (
                      <button className="bg" style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }} onClick={() => keepBlank(b.section, b.text)}>Keep</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {sections.map((s, i) => {
              const isOpen = expanded === s.id;
              const n = findBlanks([s]).length;
              return (
                <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--input-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 10px' }}>
                    <button onClick={() => setExpanded(isOpen ? null : s.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 600, padding: 0 }}>
                      {i + 1}. {s.title}
                      {n > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--warn-text,#B7791F)' }}>{n} blank{n !== 1 ? 's' : ''}</span>}
                    </button>
                    <button className="bg" title="Move up" disabled={i === 0} style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => move(i, -1)}>↑</button>
                    <button className="bg" title="Move down" disabled={i === sections.length - 1} style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => move(i, 1)}>↓</button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 10px 10px' }}>
                      <input className="fi" value={s.title} onChange={e => update(s.id, { title: e.target.value })} style={{ fontWeight: 600 }}/>
                      <textarea className="fi" rows={10} value={s.body} onChange={e => update(s.id, { body: e.target.value })} style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.55 }}/>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Start a line with "- " for a bullet. Leave a blank line between paragraphs.</span>
                        <button className="bd" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => remove(s.id)}>Delete section</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="bg" style={{ fontSize: 12, marginBottom: 16 }} onClick={add}>+ Add section</button>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="bp" onClick={save} disabled={saving || (!dirty && !!saved)}>{saving ? <Spinner/> : saved ? 'Save changes' : 'Save agreement'}</button>
            <button className="bg" onClick={() => setPreview(true)}>Preview</button>
            <button onClick={() => setConfirmReset(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 11, color: 'var(--text-faint)', textDecoration: 'underline', cursor: 'pointer' }}>Reset to littleloop template</button>
          </div>
        </div>
      )}

      <Modal open={preview} onClose={() => setPreview(false)}>
        <AgreementView agreement={{ title, business_name: biz, sections, terms: {} }}/>
        <button className="bg" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => setPreview(false)}>Close preview</button>
      </Modal>
      <Confirm open={confirmReset} title="Reset to the template?" message="This replaces your sections with the littleloop starting template. Nothing changes until you save." onConfirm={resetToDefault} onCancel={() => setConfirmReset(false)}/>
    </div>
  );
}
