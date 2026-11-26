import { supabase } from '../../lib/supabase';

// Daycare online payments (phase 4C), through the daycare-payments function.
// Each daycare connects its own Stripe account; parents pay on Stripe's page; littleloop keeps a
// small platform fee (fee_bps; 25 = 0.25%). Card and bank details never touch littleloop.

export async function payCall(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('daycare-payments', { body: { action, ...body } });
  if (error) {
    let msg = 'Something went wrong. Please try again.';
    try { msg = (await error.context?.json())?.error || msg; } catch {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const PAY_STATUS = {
  started: 'Not finished', processing: 'Bank payment clearing', paid: 'Paid', failed: 'Didn\'t go through',
  expired: 'Not finished', refunded: 'Refunded', partially_refunded: 'Partly refunded',
};
export const feePct = bps => `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
export const STRIPE_FEES = 'about 2.9% + 30¢ per card payment, and 0.8% (up to $5) per bank payment';

// Remove our return parameters from the address bar after reading them
export function takeParams(names) {
  const url = new URL(window.location.href);
  const got = {};
  for (const n of names) { if (url.searchParams.has(n)) { got[n] = url.searchParams.get(n); url.searchParams.delete(n); } }
  if (Object.keys(got).length) window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  return got;
}
