import { useState } from 'react';
import PlanPicker from '../../components/PlanPicker';
import Spinner from '../../components/ui/Spinner';
import SectionLabel from '../../components/ui/SectionLabel';
import { DAYCARE_TIERS, daycareTier, money, startCheckout, changePlan, openBillingPortal } from '../../lib/plan';

const fmt = iso => iso ? new Date(iso).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
export const trialDaysLeft = plan => plan?.in_trial && plan.trial_ends_at
  ? Math.max(0, Math.ceil((new Date(plan.trial_ends_at) - Date.now()) / 86400000)) : null;

// The daycare's plan (director and office): trial or plan, enrolled children vs. the plan,
// choose / switch plans, and Stripe billing. `plan` = facility_plan_summary().
export default function DaycarePlanCard({ session, facility, plan, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [msg,  setMsg]  = useState(null);
  if (!plan) return null;

  const paying = ['active', 'trialing', 'past_due'].includes(plan.status) && !!plan.tier;
  const days   = trialDaysLeft(plan);
  const limit  = plan.limit;
  const fits   = DAYCARE_TIERS.find(t => t.children == null || t.children >= plan.children)?.id;
  const tier   = daycareTier(plan.tier);

  async function choose(t, iv) {
    setBusy(`${t}:${iv}`); setMsg(null);
    if (paying) {
      const err = await changePlan(session, { tier: t, interval: iv, facilityId: facility.id });
      setBusy(null);
      if (err) { setMsg({ err }); return; }
      setMsg({ ok: `${facility.name} is now on the ${daycareTier(t).label} plan.` });
      onChanged?.();
    } else {
      const err = await startCheckout(session, { tier: t, interval: iv, facilityId: facility.id });
      if (err) { setBusy(null); setMsg({ err }); }
    }
  }

  async function portal() {
    setBusy('portal');
    const err = await openBillingPortal(session, facility.id);
    if (err) { setBusy(null); setMsg({ err }); }
  }

  return (
    <div className="card" style={{ padding: '18px 18px 16px', marginBottom: 16 }}>
      <SectionLabel>Plan & billing</SectionLabel>
      {msg && <div className={`al ${msg.err ? 'al-e' : 'al-s'}`}>{msg.err || msg.ok}</div>}
      {plan.status === 'past_due' && (
        <div className="al al-e">⚠️ The last payment didn't go through. Update the card to keep your plan.
          <div><button className="bg" style={{ marginTop: 8, fontSize: 12 }} onClick={portal}>Update payment method</button></div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {plan.complimentary ? '🎁 Complimentary plan'
            : paying ? `${tier?.label} plan · ${money(plan.interval === 'year' ? tier.yearly : tier.monthly)}/${plan.interval === 'year' ? 'yr' : 'mo'}`
            : days != null ? `Free trial · ${days} day${days === 1 ? '' : 's'} left`
            : 'Your free trial has ended'}
        </div>
        <div style={{ fontSize: 13, color: limit != null && plan.children > limit ? 'var(--err-text)' : 'var(--text-dim)', fontWeight: 700 }}>
          {plan.children} enrolled{limit != null ? ` of ${limit}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.6 }}>
        {plan.complimentary ? 'No billing needed.'
          : paying ? (plan.status === 'trialing' ? `Your first charge is on ${fmt(plan.current_period_end)}, when the free trial ends.` : `Renews ${fmt(plan.current_period_end)}.`)
          : days != null ? <>Everything is included during the trial, with no limit on children. It ends {fmt(plan.trial_ends_at)}. Choosing a plan now won't charge you until then.</>
          : 'Choose a plan to keep using littleloop for your daycare. Your families, records and history are all still here.'}
        {' '}Your staff can also use littleloop's sitter mode for free while they work here.
      </div>

      {!plan.complimentary && (
        <div style={{ marginTop: 14 }}>
          <PlanPicker tiers={DAYCARE_TIERS} current={paying ? plan.tier : null} currentInterval={plan.interval || 'month'}
            hasPlan={paying} busy={busy} onChoose={choose} recommend={!paying ? fits : null}/>
          {plan.has_billing && (
            <button className="bg" style={{ width: '100%', marginTop: 12 }} onClick={portal} disabled={!!busy}>
              {busy === 'portal' ? <Spinner size={12}/> : '💳 Card, invoices or cancel'}
            </button>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', margin: '10px 0 0' }}>
            Unlimited staff on every plan. Always free for parents. Secure checkout with Stripe; switching is prorated.
          </p>
        </div>
      )}
    </div>
  );
}
