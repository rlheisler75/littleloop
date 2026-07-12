import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PAYMENT_TYPES } from '../../lib/constants';
import { Modal } from '../ui/Modal';
import Field from '../ui/Field';
import Spinner from '../ui/Spinner';
import SectionLabel from '../ui/SectionLabel';

export default function PaymentSettingsModal({ open, onClose, sitterId, onSaved }) {
  const [legalName, setLegalName] = useState('');
  const [addr1,     setAddr1]     = useState('');
  const [addr2,     setAddr2]     = useState('');
  const [city,      setCity]      = useState('');
  const [state,     setState]     = useState('');
  const [zip,       setZip]       = useState('');
  const [methods,   setMethods]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [alert,     setAlert]     = useState(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data } = await supabase.from('sitters').select('*').eq('id', sitterId).single();
      if (data) {
        setLegalName(data.legal_name || '');
        setAddr1(data.address_line1 || '');
        setAddr2(data.address_line2 || '');
        setCity(data.city || '');
        setState(data.state || '');
        setZip(data.zip || '');
        setMethods(data.payment_methods || []);
      }
    }
    load();
  }, [open, sitterId]);

  function toggleMethod(id) {
    setMethods(ms => {
      const ex = ms.find(m => m.type === id);
      if (ex) return ms.map(m => m.type === id ? { ...m, enabled: !m.enabled } : m);
      return [...ms, { type: id, handle: '', enabled: true }];
    });
  }

  function setHandle(id, val) {
    setMethods(ms => {
      const ex = ms.find(m => m.type === id);
      if (ex) return ms.map(m => m.type === id ? { ...m, handle: val } : m);
      return [...ms, { type: id, handle: val, enabled: true }];
    });
  }

  function getMethod(id) {
    return methods.find(m => m.type === id) || { type: id, handle: '', enabled: false };
  }

  async function save(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    const { error } = await supabase.from('sitters').update({
      legal_name: legalName, address_line1: addr1, address_line2: addr2 || null,
      city, state, zip, payment_methods: methods,
    }).eq('id', sitterId);
    setLoading(false);
    if (error) { setAlert({ t: 'e', m: error.message }); return; }
    setAlert({ t: 's', m: 'Settings saved!' });
    setTimeout(() => { onSaved(); onClose(); }, 1000);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Invoice Settings</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20, lineHeight: 1.6 }}>This info appears on your invoices for FSA reimbursement.</p>
      {alert && <div className={`al al-${alert.t}`}>{alert.m}</div>}

      <form onSubmit={save}>
        <Field label="Legal full name" value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Jane Smith"/>
        <Field label="Address line 1" value={addr1} onChange={e => setAddr1(e.target.value)} placeholder="123 Main St"/>
        <Field label="Address line 2 (optional)" value={addr2} onChange={e => setAddr2(e.target.value)} placeholder="Apt 4B" required={false}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 14 }}>
          <div><label className="fl">City</label><input className="fi" value={city} onChange={e => setCity(e.target.value)} style={{ marginBottom: 0 }}/></div>
          <div><label className="fl">State</label><input className="fi" value={state} onChange={e => setState(e.target.value)} maxLength={2} style={{ marginBottom: 0 }}/></div>
          <div><label className="fl">ZIP</label><input className="fi" value={zip} onChange={e => setZip(e.target.value)} maxLength={10} style={{ marginBottom: 0 }}/></div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Accepted payment methods</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PAYMENT_TYPES.map(pt => {
              const m = getMethod(pt.id);
              return (
                <div key={pt.id} style={{ borderRadius: 12, border: `1px solid ${m.enabled ? 'rgba(111,163,232,.3)' : 'rgba(255,255,255,.07)'}`, background: m.enabled ? 'rgba(111,163,232,.06)' : 'rgba(255,255,255,.02)', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: m.enabled ? 8 : 0 }}>
                    <span style={{ fontSize: 20 }}>{pt.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{pt.label}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={m.enabled} onChange={() => toggleMethod(pt.id)} style={{ accentColor: '#7BAAEE', width: 16, height: 16 }}/>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Accept</span>
                    </label>
                  </div>
                  {m.enabled && pt.placeholder !== '(no handle needed)' && (
                    <input className="fi" value={m.handle} onChange={e => setHandle(pt.id, e.target.value)}
                      placeholder={pt.placeholder} style={{ marginBottom: 0, fontSize: 12 }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="bp full" disabled={loading}>{loading ? <Spinner/> : 'Save Settings'}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
