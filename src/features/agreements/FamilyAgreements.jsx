import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { sendPushNotification } from '../../services/push';
import { Modal } from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import AgreementView, { printAgreement, PERIODS } from './AgreementView';
import { loadTemplate } from './AgreementEditor';
import { findBlanks } from './defaultTemplate';
import { EmergencyCardModal } from './FamilyInfo';

async function loadCurrent(familyId, sitterId) {
  const { data } = await supabase.from('family_agreements').select('*')
    .eq('family_id', familyId).eq('sitter_id', sitterId).neq('status', 'void')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return { agreement: null, signatures: [] };
  const { data: sigs } = await supabase.from('agreement_signatures').select('signed_name,signed_at,user_id').eq('agreement_id', data.id).order('signed_at');
  return { agreement: data, signatures: sigs || [] };
}

async function openScan(path) {
  const { data, error } = await supabase.storage.from('agreements').createSignedUrl(path, 300);
  if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank');
}

export function agreementStatus(agreement, signatures) {
  if (!agreement) return { label: 'Not sent', cls: 'i' };
  if (agreement.status === 'signed') {
    const paper = !signatures.length && agreement.scan_path;
    return { label: `${paper ? 'Signed on paper' : 'Signed'} ${agreement.signed_at ? new Date(agreement.signed_at).toLocaleDateString() : ''}`.trim(), cls: 'a' };
  }
  return { label: 'Waiting for signature', cls: 'p' };
}

// ─── Sitter: one family's agreement ──────────────────────────────────────────

export function SitterAgreementPanel({ family, children, sitterId, sitterName }) {
  const [state,    setState]    = useState(null);
  const [view,     setView]     = useState(false);
  const [sending,  setSending]  = useState(false);
  const [showEmerg,setShowEmerg]= useState(false);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => setState(await loadCurrent(family.id, sitterId)), [family.id, sitterId]);
  useEffect(() => { load(); }, [load]);

  async function uploadScan(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setMsg({ t: 'e', m: 'That file is over 15 MB.' }); return; }
    setBusy(true); setMsg(null);
    try {
      let agreement = state.agreement;
      if (!agreement) {
        // Signed on paper before using littleloop: record it from the current template.
        const tpl = await loadTemplate(sitterId);
        const { data, error } = await supabase.from('family_agreements').insert({
          family_id: family.id, sitter_id: sitterId,
          title: tpl?.title || 'Childcare Agreement', business_name: tpl?.business_name || null,
          sections: tpl?.sections || [], terms: {}, status: 'sent',
        }).select().single();
        if (error) throw error;
        agreement = data;
      }
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
      const path = `${family.id}/${agreement.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('agreements').upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const patch = { scan_path: path };
      if (agreement.status !== 'signed') Object.assign(patch, { status: 'signed', signed_at: new Date().toISOString() });
      const { error } = await supabase.from('family_agreements').update(patch).eq('id', agreement.id);
      if (error) throw error;
      setMsg({ t: 's', m: 'Signed copy saved. Only you and this family can see it.' });
      load();
    } catch (e) { setMsg({ t: 'e', m: e.message }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!state) return null;
  const { agreement, signatures } = state;
  const st = agreementStatus(agreement, signatures);

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>Care Agreement &amp; Emergency Info</SectionLabel>
      {msg && <div className={`al al-${msg.t}`}>{msg.m}</div>}
      <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 140 }}>📜 {agreement?.title || 'Care agreement'}</span>
          <span className={`sb sb-${st.cls}`} style={{ fontSize: 10 }}>{st.label}</span>
        </div>
        {agreement && signatures.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Signed by {signatures.map(s => s.signed_name).join(', ')}</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="bp" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => setSending(true)}>{agreement ? 'Send updated version' : 'Send agreement'}</button>
          {agreement && agreement.sections?.length > 0 && <button className="bg" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => setView(true)}>View</button>}
          {agreement?.scan_path
            ? <button className="bg" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => openScan(agreement.scan_path)}>📎 Paper copy</button>
            : <button className="bg" style={{ fontSize: 11, padding: '5px 11px' }} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <Spinner size={10}/> : '📎 Upload signed paper copy'}</button>}
          <button className="bg" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => setShowEmerg(true)}>🚑 Emergency card</button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => uploadScan(e.target.files?.[0])}/>
        </div>
      </div>

      <Modal open={view} onClose={() => setView(false)}>
        <AgreementView agreement={agreement} signatures={signatures}/>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="bp" onClick={() => printAgreement(agreement, signatures)}>🖨️ Print</button>
          <button className="bg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setView(false)}>Close</button>
        </div>
      </Modal>
      <SendAgreementModal open={sending} onClose={() => setSending(false)} family={family} children={children} sitterId={sitterId} sitterName={sitterName} previous={agreement} onSent={() => { setSending(false); setMsg({ t: 's', m: 'Agreement sent. The family will see it on their Home tab.' }); load(); }}/>
      <EmergencyCardModal open={showEmerg} onClose={() => setShowEmerg(false)} familyId={family.id} familyName={family.name} children={children}/>
    </div>
  );
}

function SendAgreementModal({ open, onClose, family, children, sitterId, sitterName, previous, onSent }) {
  const [tpl,     setTpl]     = useState(undefined);
  const [terms,   setTerms]   = useState({});
  const [sig,     setSig]     = useState('');
  const [agree,   setAgree]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    if (!open) return;
    setErr(null); setAgree(false); setSig(sitterName || '');
    setTerms({ children: children.map(c => c.name).join(', '), period: 'week', ...(previous?.terms || {}) });
    loadTemplate(sitterId).then(t => setTpl(t));
  }, [open]);

  const T = (k, v) => setTerms(t => ({ ...t, [k]: v }));
  const blanks = tpl ? findBlanks(tpl.sections) : [];

  async function send() {
    if (sig.trim().length < 2) { setErr('Type your name to sign.'); return; }
    if (!agree) { setErr('Tick the box to confirm.'); return; }
    setSaving(true); setErr(null);
    try {
      const clean = Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v));
      const { error } = await supabase.from('family_agreements').insert({
        family_id: family.id, sitter_id: sitterId, title: tpl.title, business_name: tpl.business_name,
        sections: tpl.sections, terms: clean, status: 'sent',
        sitter_signed_name: sig.trim(), sitter_signed_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Replace the old copy only once the new one exists.
      if (previous) await supabase.from('family_agreements').update({ status: 'void' }).eq('id', previous.id);
      const { data: mems } = await supabase.from('members').select('user_id').eq('family_id', family.id).in('role', ['admin', 'member']).eq('status', 'active');
      const ids = (mems || []).map(m => m.user_id).filter(Boolean);
      if (ids.length) sendPushNotification(ids, 'Care agreement to sign 📜', `${sitterName || 'Your sitter'} sent you their care agreement to review and sign.`, '/?portal=parent', 'agreement');
      onSent();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Send agreement to {family.name}</div>
      {tpl === undefined ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={20}/></div>
      : !tpl ? (
        <div className="al al-w" style={{ marginTop: 12 }}>Set up your Care Agreement first: <strong>Profile → Care Agreement</strong>. It starts from the littleloop template, so it only takes a few minutes.</div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14, lineHeight: 1.6 }}>
            The family gets a copy of “{tpl.title}” as it is now. {previous ? 'Their current copy is replaced and they’ll be asked to sign again.' : ''}
          </p>
          {blanks.length > 0 && (
            <div className="al al-w">Your agreement still has {blanks.length} unfilled blank{blanks.length !== 1 ? 's' : ''} (like “[{blanks[0].text}]”). Fill them in under Profile → Care Agreement before sending.</div>
          )}
          <SectionLabel>This family's terms</SectionLabel>
          <label className="fl">Children</label>
          <input className="fi" value={terms.children || ''} onChange={e => T('children', e.target.value)}/>
          <label className="fl">Usual days</label>
          <input className="fi" value={terms.days || ''} onChange={e => T('days', e.target.value)} placeholder="e.g. Monday – Friday"/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label className="fl">Drop-off</label><input className="fi" value={terms.dropoff || ''} onChange={e => T('dropoff', e.target.value)} placeholder="7:45 a.m."/></div>
            <div><label className="fl">Pick-up</label><input className="fi" value={terms.pickup || ''} onChange={e => T('pickup', e.target.value)} placeholder="5:30 p.m."/></div>
            <div><label className="fl">Tuition ($)</label><input className="fi" inputMode="decimal" value={terms.rate || ''} onChange={e => T('rate', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="250.00"/></div>
            <div><label className="fl">Per</label>
              <select className="fi" value={terms.period || 'week'} onChange={e => T('period', e.target.value)}>{PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
            </div>
          </div>
          <label className="fl">Payment method</label>
          <input className="fi" value={terms.payment_method || ''} onChange={e => T('payment_method', e.target.value)} placeholder="e.g. Venmo or cash"/>

          <SectionLabel>Your signature</SectionLabel>
          <input className="fi" value={sig} onChange={e => setSig(e.target.value)} placeholder="Type your full name" style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 16 }}/>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ accentColor: 'var(--accent)', marginTop: 2 }}/>
            I agree to provide care under this agreement, and typing my name counts as my signature.
          </label>
          {err && <div className="al al-e">{err}</div>}
        </>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {tpl && <button className="bp full" onClick={send} disabled={saving || blanks.length > 0}>{saving ? <Spinner/> : 'Sign & send'}</button>}
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Parent: agreements from connected sitters ───────────────────────────────

export function ParentAgreementsCard({ familyId, sitters = [], userId, canSign }) {
  const [items, setItems] = useState(null);
  const [open,  setOpen]  = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('family_agreements').select('*')
      .eq('family_id', familyId).neq('status', 'void').order('created_at', { ascending: false });
    const latest = [];
    for (const a of data || []) if (!latest.some(x => x.sitter_id === a.sitter_id)) latest.push(a);
    const ids = latest.map(a => a.id);
    const { data: sigs } = ids.length ? await supabase.from('agreement_signatures').select('*').in('agreement_id', ids).order('signed_at') : { data: [] };
    setItems(latest.map(a => ({ ...a, signatures: (sigs || []).filter(s => s.agreement_id === a.id) })));
  }, [familyId]);
  useEffect(() => { load(); }, [load]);

  if (!items?.length) return null;
  const sitterName = id => sitters.find(s => s.id === id)?.name || 'Your sitter';
  const current = items.find(a => a.id === open);

  return (
    <div style={{ marginBottom: 20 }}>
      {items.map(a => {
        const mine = a.signatures.some(s => s.user_id === userId);
        const needs = canSign && !mine && a.status === 'sent' && a.sections?.length > 0;
        const st = agreementStatus(a, a.signatures);
        return (
          <div key={a.id} className="card" style={{ padding: '14px 16px', marginBottom: 8, ...(needs ? { border: '1px solid color-mix(in srgb,var(--accent) 45%,transparent)', background: 'color-mix(in srgb,var(--accent) 6%,var(--card-bg))' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📜</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{needs ? `Review & sign ${sitterName(a.sitter_id)}'s care agreement` : `${sitterName(a.sitter_id)}'s care agreement`}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{a.title} · <span>{st.label}</span></div>
              </div>
              {a.sections?.length > 0
                ? <button className={needs ? 'bp' : 'bg'} style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }} onClick={() => setOpen(a.id)}>{needs ? 'Review' : 'View'}</button>
                : a.scan_path && <button className="bg" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }} onClick={() => openScan(a.scan_path)}>📎 View</button>}
            </div>
          </div>
        );
      })}
      <SignModal agreement={current} sitterName={current ? sitterName(current.sitter_id) : ''} userId={userId} canSign={canSign} onClose={() => setOpen(null)} onSigned={load}/>
    </div>
  );
}

function SignModal({ agreement, sitterName, userId, canSign, onClose, onSigned }) {
  const [name,   setName]   = useState('');
  const [agree,  setAgree]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);
  useEffect(() => { setName(''); setAgree(false); setErr(null); }, [agreement?.id]);
  if (!agreement) return null;
  const mine = agreement.signatures.some(s => s.user_id === userId);

  async function sign() {
    if (name.trim().length < 2) { setErr('Type your full name to sign.'); return; }
    if (!agree) { setErr('Tick the box to confirm you agree.'); return; }
    setSaving(true); setErr(null);
    const { error } = await supabase.rpc('sign_family_agreement', { p_agreement_id: agreement.id, p_name: name.trim() });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    await onSigned();
    onClose();
  }

  return (
    <Modal open={!!agreement} onClose={onClose}>
      <AgreementView agreement={agreement} signatures={agreement.signatures}/>
      {agreement.scan_path && <button className="bg" style={{ fontSize: 11, marginTop: 10 }} onClick={() => openScan(agreement.scan_path)}>📎 View signed paper copy</button>}
      {canSign && !mine && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <label className="fl">Sign with your full name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Type your full name" style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 16 }}/>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ accentColor: 'var(--accent)', marginTop: 2 }}/>
            I've read {sitterName}'s agreement and agree to it. Typing my name counts as my signature.
          </label>
          {err && <div className="al al-e">{err}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {canSign && !mine && <button className="bp full" onClick={sign} disabled={saving}>{saving ? <Spinner/> : 'Sign agreement'}</button>}
        <button className="bg" onClick={() => printAgreement(agreement, agreement.signatures)}>🖨️</button>
        <button className="bg" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
