import { useState, useEffect, useCallback } from 'react';
import PlanPicker from './components/PlanPicker';
import Spinner from './components/ui/Spinner';
import {
  SITTER_TIERS, FREE_CHILD_LIMIT, sitterTier, money, loadSitterPlan,
  startCheckout, changePlan, openBillingPortal,
} from './lib/plan';

const formatDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '—';

// Sitter plan: usage (children in connected families), the tiers, and Stripe billing.
// Free up to 3 children; $7 / $12 / $20 a month after that. Founders and grandfathered
// sitters, and daycare staff, are unlimited at no cost.
export default function BillingTab({ session, onChanged }) {
  const [plan,  setPlan]  = useState(null);
  const [busy,  setBusy]  = useState(null);
  const [msg,   setMsg]   = useState(null);

  const load = useCallback(async () => setPlan(await loadSitterPlan()), []);
  useEffect(() => { load(); }, [load]);

  if (!plan) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spinner size={22}/></div>;

  const paying   = ['active', 'trialing', 'past_due'].includes(plan.status) && !plan.complimentary && plan.has_billing;
  const free     = plan.complimentary || !!plan.staff_perk;
  const current  = paying ? plan.tier : null;
  const interval = plan.plan === 'yearly' ? 'year' : 'month';
  const limit    = plan.limit;                 // null = unlimited
  const over     = limit != null && plan.children > limit;
  const fits     = SITTER_TIERS.find(t => t.children == null || t.children >= plan.children)?.id;

  async function choose(tier, iv) {
    setBusy(`${tier}:${iv}`); setMsg(null);
    if (paying) {
      const err = await changePlan(session, { tier, interval: iv });
      setBusy(null);
      if (err) { setMsg({ err }); return; }
      setMsg({ ok: `You're now on ${sitterTier(tier).label.toLowerCase()} children, ${money(iv === 'year' ? sitterTier(tier).yearly : sitterTier(tier).monthly)}/${iv === 'year' ? 'yr' : 'mo'}.` });
      await load(); onChanged?.();
    } else {
      const err = await startCheckout(session, { tier, interval: iv });
      if (err) { setBusy(null); setMsg({ err }); }
    }
  }

  async function portal() {
    setBusy('portal');
    const err = await openBillingPortal(session);
    if (err) { setBusy(null); setMsg({ err }); }
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Your plan</h2>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {plan.status === 'past_due' && (
        <div className="al al-e">⚠️ Your last payment didn't go through. Update your card to keep your plan.
          {plan.has_billing && <div><button className="bg" style={{ marginTop: 8, fontSize: 12 }} onClick={portal}>Update payment method</button></div>}
        </div>
      )}

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {plan.complimentary ? '🎁 Complimentary plan'
              : plan.staff_perk ? '🏫 Free with your daycare'
              : current ? `${sitterTier(current)?.label || 'Unlimited'} children`
              : 'Free plan'}
          </div>
          <div style={{ fontSize: 13, color: over ? 'var(--err-text)' : 'var(--text-dim)', fontWeight: 700 }}>
            {plan.children} {plan.children === 1 ? 'child' : 'children'}{limit != null ? ` of ${limit}` : ' · unlimited'}
          </div>
        </div>
        {limit != null && (
          <div style={{ height: 8, borderRadius: 6, background: 'var(--input-bg)', overflow: 'hidden', marginTop: 10 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (plan.children / Math.max(1, limit)) * 100)}%`, background: over ? 'var(--err-text)' : 'var(--accent)' }}/>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
          {plan.complimentary ? 'You joined early, so littleloop is free for you with no limits. Thank you!'
            : plan.staff_perk ? <>Sitter mode is free and unlimited while you work at <strong>{plan.staff_perk}</strong>.</>
            : current ? <>{plan.status === 'trialing' ? `Free trial until ${formatDate(plan.trial_ends_at)}` : `Renews ${formatDate(plan.current_period_end)}`}. Includes recurring invoices.</>
            : <>Free for up to {FREE_CHILD_LIMIT} children: check-ins, daily updates, field trips, invoices and messages. Children are counted across the families you're connected to.</>}
        </div>
        {over && !free && (
          <div className="al al-w" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
            You're caring for more children than your plan covers. Nothing stops working, but you can't add another family until you move to a bigger plan.
          </div>
        )}
      </div>

      {!free && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{current ? 'Change your plan' : 'Upgrade'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
            Every plan includes recurring invoices that send themselves.{!current && ' Your first plan starts with a 90-day free trial.'}
          </div>
          <PlanPicker tiers={SITTER_TIERS} current={current} currentInterval={interval} hasPlan={!!current}
            busy={busy} onChoose={choose} recommend={!current || over ? fits : null}/>
          {plan.has_billing && (
            <button className="bg" style={{ width: '100%', marginTop: 14 }} onClick={portal} disabled={!!busy}>
              {busy === 'portal' ? <Spinner size={12}/> : '💳 Card, invoices or cancel'}
            </button>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', margin: '12px 0 0' }}>
            Secure checkout with Stripe. Switching plans is prorated. Cancel anytime.
          </p>
        </div>
      )}
    </div>
  );
}
