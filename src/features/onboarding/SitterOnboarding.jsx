import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PAYMENT_TYPES, SITTER_AVATARS } from '../../lib/constants';
import Field from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';

export default function SitterOnboarding({ session, onComplete }) {
  const sitterId = session.user.id;

  const [step,      setStep]      = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [alert,     setAlert]     = useState(null);
  // Step 0
  const [name,      setName]      = useState(session.user.user_metadata?.name || session.user.email.split('@')[0]);
  const [avatar,    setAvatar]    = useState('➿');
  // Step 1
  const [legalName, setLegalName] = useState('');
  const [addr1,     setAddr1]     = useState('');
  const [addr2,     setAddr2]     = useState('');
  const [city,      setCity]      = useState('');
  const [state,     setState]     = useState('');
  const [zip,       setZip]       = useState('');
  // Step 2
  const [methods,   setMethods]   = useState(PAYMENT_TYPES.map(pt => ({ type: pt.id, handle: '', enabled: false })));

  const STEPS = [
    { title: 'Welcome to littleloop ➿', sub: "Let's set up your sitter profile" },
    { title: 'Invoice details 🧾',       sub: 'Used on invoices — families need this for FSA reimbursement' },
    { title: 'How you get paid 💰',      sub: 'Families will see these options when paying an invoice' },
  ];

  function toggleMethod(id) { setMethods(m => m.map(x => x.type === id ? { ...x, enabled: !x.enabled } : x)); }
  function setHandle(id, val) { setMethods(m => m.map(x => x.type === id ? { ...x, handle: val } : x)); }

  async function finish() {
    setSaving(true); setAlert(null);
    try {
      await supabase.auth.updateUser({ data: { name: name.trim() } });
      const { error } = await supabase.from('sitters').update({
        name: name.trim(), avatar_url: avatar,
        legal_name: legalName.trim() || null, address_line1: addr1.trim() || null,
        address_line2: addr2.trim() || null, city: city.trim() || null,
        state: state.trim() || null, zip: zip.trim() || null,
        payment_methods: methods, onboarded: true,
      }).eq('id', sitterId);
      if (error) throw error;
      localStorage.setItem(`ll_onboarded_${sitterId}`, '1');
      onComplete(name.trim());
    } catch (err) {
      setAlert(err.message);
      setSaving(false);
    }
  }

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="leaf" style={{ fontSize: 36, marginBottom: 8 }}>➿</div>
          <div className="logo-text" style={{ fontSize: 28, marginBottom: 4 }}>littleloop</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sitter Setup</div>
        </div>

        <div style={{ height: 3, background: 'var(--border)', borderRadius: 3, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-grad,linear-gradient(90deg,#3A6FD4,#3A9E7A))', borderRadius: 3, transition: 'width .4s ease' }}/>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{STEPS[step].title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{STEPS[step].sub}</div>
        </div>

        {alert && <div className="al al-e" style={{ marginBottom: 16 }}>{alert}</div>}

        {/* Step 0 — Profile */}
        {step === 0 && (
          <div>
            <div className="card" style={{ padding: '20px 18px', marginBottom: 16 }}>
              <Field label="Your name" value={name} onChange={e => setName(e.target.value)} placeholder="How families will know you"/>
              <div>
                <label className="fl">Choose your avatar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {SITTER_AVATARS.map(a => (
                    <button key={a} onClick={() => setAvatar(a)}
                      style={{ width: 44, height: 44, borderRadius: 12, fontSize: 22, border: `2px solid ${avatar === a ? 'var(--accent,#7BAAEE)' : 'var(--border)'}`, background: avatar === a ? 'rgba(111,163,232,.12)' : 'var(--input-bg)', cursor: 'pointer', transition: 'all .15s' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Step 1 of 3</div>
              <button className="bp" onClick={() => setStep(1)} disabled={!name.trim()}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 1 — Legal / Address */}
        {step === 1 && (
          <div>
            <div className="card" style={{ padding: '20px 18px', marginBottom: 16 }}>
              <Field label="Legal name (as it appears on tax docs)" value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Full legal name" required={false}/>
              <Field label="Address line 1" value={addr1} onChange={e => setAddr1(e.target.value)} placeholder="Street address" required={false}/>
              <Field label="Address line 2 (optional)" value={addr2} onChange={e => setAddr2(e.target.value)} placeholder="Apt, suite, etc." required={false}/>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <div><label className="fl">City</label><input className="fi" value={city} onChange={e => setCity(e.target.value)} placeholder="City"/></div>
                <div><label className="fl">State</label><input className="fi" value={state} onChange={e => setState(e.target.value)} placeholder="MO" maxLength={2}/></div>
                <div><label className="fl">ZIP</label><input className="fi" value={zip} onChange={e => setZip(e.target.value)} placeholder="65801"/></div>
              </div>
              <div className="al al-i" style={{ marginTop: 4 }}>This info appears on invoices for FSA/DCFSA reimbursement. You can update it anytime in your profile.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="bg" onClick={() => setStep(0)}>← Back</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Step 2 of 3</div>
                <button className="bp" onClick={() => setStep(2)}>Continue →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Payment methods */}
        {step === 2 && (
          <div>
            <div className="card" style={{ padding: '20px 18px', marginBottom: 16 }}>
              {PAYMENT_TYPES.map(pt => {
                const m          = methods.find(x => x.type === pt.id);
                const hasHandle  = pt.placeholder !== '(no handle needed)';
                return (
                  <div key={pt.id} style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 12, background: m.enabled ? 'rgba(111,163,232,.06)' : 'var(--input-bg)', border: `1px solid ${m.enabled ? 'rgba(111,163,232,.25)' : 'var(--border)'}`, transition: 'all .2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: m.enabled && hasHandle ? 10 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{pt.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{pt.label}</span>
                      </div>
                      <button onClick={() => toggleMethod(pt.id)}
                        style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all .2s', background: m.enabled ? 'var(--accent,#3A6FD4)' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 3, left: m.enabled ? 20 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}/>
                      </button>
                    </div>
                    {m.enabled && hasHandle && (
                      <input className="fi" value={m.handle} onChange={e => setHandle(pt.id, e.target.value)} placeholder={pt.placeholder} style={{ marginBottom: 0 }}/>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="bg" onClick={() => setStep(1)}>← Back</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Step 3 of 3</div>
                <button className="bp" onClick={finish} disabled={saving}>{saving ? <><Spinner/> Saving…</> : 'Finish Setup ✓'}</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => { localStorage.setItem(`ll_onboarded_${sitterId}`, '1'); onComplete(name); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
