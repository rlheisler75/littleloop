import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import { money, longDate } from './billing';
import { errText } from './api';
import { localDate } from './enrollment';
import { payCall, PAY_STATUS, feePct, STRIPE_FEES } from './payments';

// Billing → Settings (director and office): connect the daycare's own Stripe account so families
// can pay online, choose card and/or bank, and see recent online payments.
export default function OnlinePayments({ facility, facilityId, connectParam }) {
  const [acct, setAcct] = useState(undefined);   // undefined = loading, null = never connected
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg,  setMsg]  = useState(() => connectParam === 'retry' ? { err: 'That Stripe link expired. Tap Continue to pick up where you left off.' } : null);

  const load = useCallback(async (refresh) => {
    const [{ data: a }, { data: ps }] = await Promise.all([
      supabase.from('daycare_payment_accounts').select('*').eq('facility_id', facilityId).maybeSingle(),
      supabase.from('daycare_online_payments').select('id, amount, fee, status, method, created_at, paid_at, refunded_amount, disputed, failure_reason, families(name)')
        .eq('facility_id', facilityId).in('status', ['processing', 'paid', 'failed', 'refunded', 'partially_refunded'])
        .order('created_at', { ascending: false }).limit(15),
    ]);
    setAcct(a || null); setRows(ps || []);
    if (refresh && a?.stripe_account_id) {
      try {
        const { account } = await payCall('status', { facilityId });
        if (account) setAcct(account);
        if (connectParam === 'done') setMsg(account?.charges_enabled
          ? { ok: 'You\'re connected. Families can now pay online.' }
          : { ok: 'Thanks. Stripe is still checking a few things; this updates when they\'re done.' });
      } catch (e) { setMsg({ err: e.message }); }
    }
  }, [facilityId, connectParam]);
  useEffect(() => { load(true); }, [load]);

  async function connect() {
    setBusy('connect'); setMsg(null);
    try {
      const { url } = await payCall('connect', { facilityId, returnUrl: window.location.origin });
      window.location.href = url;
    } catch (e) { setMsg({ err: e.message }); setBusy(null); }
  }
  async function setMethods(card, bank) {
    setBusy('methods'); setMsg(null);
    const { error } = await supabase.rpc('daycare_set_payment_methods', { p_facility: facilityId, p_card: card, p_bank: bank });
    setBusy(null);
    if (error) { setMsg({ err: errText(error) }); return; }
    setAcct(a => ({ ...a, card_enabled: card, bank_enabled: bank }));
  }

  const card = { padding: '14px 16px', maxWidth: 620, marginBottom: 12 };
  if (acct === undefined) return <div className="card" style={{ ...card, textAlign: 'center' }}><Spinner size={20}/></div>;
  const connected = !!acct?.stripe_account_id;
  const active = connected && acct.charges_enabled;
  const feeText = `Stripe takes its processing fees (${STRIPE_FEES}) and littleloop keeps ${feePct(acct?.fee_bps ?? 25)}. Both come out of each payment before Stripe deposits it in your bank. Families pay only what they owe.`;

  return (
    <div className="card" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>💳 Online payments</div>
        {acct?.test_mode && <span className="chip" style={{ fontSize: 11, fontWeight: 700 }}>Test mode: no real money</span>}
        {active && <span className="chip" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok-text)' }}>On</span>}
      </div>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`} style={{ marginTop: 8 }}>{msg.err || msg.ok}</div>}

      {!connected && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: '6px 0 10px' }}>
            Let families pay their bill in the app by card or bank account. Payments go straight into {facility?.name || 'your daycare'}'s own Stripe account and on to your bank, and show up on the family's account here automatically.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 12 }}>{feeText} Setup takes about 10 minutes on Stripe's site: your business details, your bank account and an ID check. littleloop never sees them.</div>
          <button className="bp" onClick={connect} disabled={!!busy}>{busy === 'connect' ? <Spinner/> : 'Set up with Stripe'}</button>
        </>
      )}

      {connected && !active && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: '6px 0 10px' }}>
            {acct.details_submitted
              ? (acct.requirements || 'Stripe is reviewing your account. This is usually quick.')
              : 'Stripe setup isn\'t finished yet. Pick up where you left off.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="bp" onClick={connect} disabled={!!busy}>{busy === 'connect' ? <Spinner/> : 'Continue with Stripe'}</button>
            <button className="bg" onClick={() => load(true)} disabled={!!busy}>Check again</button>
          </div>
        </>
      )}

      {active && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', margin: '6px 0 10px' }}>Families see a <strong>Pay online</strong> button on their bill. Choose how they can pay:</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={acct.card_enabled} disabled={busy === 'methods'} onChange={e => setMethods(e.target.checked, acct.bank_enabled)}/>
            Card <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>(about 2.9% + 30¢ to Stripe)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={acct.bank_enabled} disabled={busy === 'methods'} onChange={e => setMethods(acct.card_enabled, e.target.checked)}/>
            Bank account <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>(0.8%, up to $5, to Stripe · clears in about 4 business days)</span>
          </label>
          {acct.bank_enabled && !acct.bank_available && (
            <div className="al al-w" style={{ fontSize: 12, marginTop: 6 }}>Bank payments aren't turned on in your Stripe account yet. In Stripe, open Settings → Payment methods and turn on ACH Direct Debit. Until then families can pay by card.</div>
          )}
          {!acct.card_enabled && !acct.bank_enabled && <div className="al al-w" style={{ fontSize: 12, marginTop: 6 }}>Online payments are paused. Families won't see the Pay online button.</div>}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6, margin: '8px 0 10px' }}>
            {feeText} Refunds and disputes are handled in your Stripe dashboard; refunds update the family's account here.
          </div>
          <a className="bg" style={{ display: 'inline-block', padding: '7px 12px', fontSize: 12, textDecoration: 'none' }}
            href={`https://dashboard.stripe.com/${acct.test_mode ? 'test/' : ''}payments`} target="_blank" rel="noreferrer">Open your Stripe dashboard ↗</a>
          {rows.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 4px' }}>Recent online payments</div>
              {rows.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 84, color: 'var(--text-faint)' }}>{longDate(localDate(new Date(p.paid_at || p.created_at)))}</span>
                  <span style={{ flex: 1 }}>
                    {p.families?.name || 'Family'} · {p.method === 'bank' ? 'bank' : 'card'}
                    <span style={{ color: p.status === 'failed' || p.disputed ? 'var(--err-text)' : 'var(--text-faint)' }}> · {p.disputed ? 'Disputed' : PAY_STATUS[p.status]}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{money(p.amount)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
