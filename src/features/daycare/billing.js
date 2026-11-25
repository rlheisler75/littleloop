import { supabase } from '../../lib/supabase';
import { addDays } from './enrollment';

// Daycare tuition billing (phase 4A): labels, formatting, printing and the email/push calls.

export const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

export const METHODS = [
  { id: 'cash',        label: 'Cash' },
  { id: 'check',       label: 'Check' },
  { id: 'card',        label: 'Card' },
  { id: 'ach',         label: 'Bank transfer' },
  { id: 'money_order', label: 'Money order' },
  { id: 'other',       label: 'Other' },
];
export const methodLabel = id => METHODS.find(m => m.id === id)?.label || '';

export const CHARGE_TYPES = [
  { id: 'tuition',      label: 'Tuition' },
  { id: 'registration', label: 'Registration fee' },
  { id: 'late_pickup',  label: 'Late pickup' },
  { id: 'late_fee',     label: 'Late payment fee' },
  { id: 'supplies',     label: 'Supplies' },
  { id: 'activity',     label: 'Activity or field trip' },
  { id: 'other',        label: 'Other' },
];
export const chargeLabel = id => CHARGE_TYPES.find(c => c.id === id)?.label || 'Charge';

const d = iso => iso ? new Date(iso + 'T12:00:00') : null;
export const shortDate = iso => iso ? d(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
export const longDate  = iso => iso ? d(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
export const periodText = (start, end) => start ? `${shortDate(start)} – ${longDate(end)}` : '';

// The period after/before a given one, by cycle
export function shiftPeriod(start, cycle, dir) {
  if (cycle === 'weekly') return addDays(start, 7 * dir);
  const x = d(start); x.setMonth(x.getMonth() + dir, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
}

// How an entry reads in a ledger: charges add, payments and credits subtract
export function entryLabel(e) {
  if (e.kind === 'payment') return `Payment${e.method ? ` · ${methodLabel(e.method)}` : ''}${e.reference ? ` #${e.reference}` : ''}`;
  if (e.kind === 'credit') return e.description || 'Credit';
  return e.description || chargeLabel(e.category);
}
export const signed = e => (e.kind === 'charge' ? 1 : -1) * Number(e.amount);

// Email + push to the family's parents (the in-app bell for statements is made by the database)
export async function sendStatements(statementIds) {
  if (!statementIds?.length) return { sent: [] };
  const { data, error } = await supabase.functions.invoke('daycare-billing', { body: { action: 'statements', statementIds } });
  if (error) {
    let msg = 'The statements were made, but the emails didn\'t go out.';
    try { msg = (await error.context?.json())?.error || msg; } catch {}
    return { error: msg };
  }
  return data;
}
export async function sendReminder(facilityId, familyId) {
  const { data, error } = await supabase.functions.invoke('daycare-billing', { body: { action: 'reminder', facilityId, familyId } });
  if (error) {
    let msg = 'The reminder didn\'t go out.';
    try { msg = (await error.context?.json())?.error || msg; } catch {}
    return { error: msg };
  }
  return data;
}

// ── Printing ─────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function printWindow(title, body) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:32px;max-width:720px}
    h1{font-size:22px;margin:0}.sub{color:#64748b;font-size:12px;margin:2px 0 16px}
    table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
    th{background:#f8fafc;color:#475569;font-size:12px}.r{text-align:right;white-space:nowrap}.tot td{font-weight:700;border-top:2px solid #94a3b8}
    .box{margin-top:16px;padding:10px 12px;background:#f8fafc;border-radius:6px;font-size:13px}.void{color:#94a3b8;text-decoration:line-through}
    .big{font-size:28px;font-weight:700;margin:10px 0 2px}
  </style></head><body>${body}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

export function printStatement(st, lines, info, familyName) {
  const rows = (lines || []).filter(l => !l.voided_at).map(l => `<tr><td>${esc(longDate(l.entry_date))}</td>
    <td>${esc(entryLabel(l))}${l.period_start ? `<div style="font-size:11px;color:#64748b">${esc(periodText(l.period_start, l.period_end))}</div>` : ''}</td>
    <td class="r">${l.kind === 'charge' ? '' : '−'}${esc(money(l.amount))}</td></tr>`).join('');
  printWindow(`Statement ${st.number}`, `
    <h1>${esc(info?.name || 'Daycare')}</h1>
    <div class="sub">${esc([info?.address, info?.phone, info?.email].filter(Boolean).join(' · '))}</div>
    <table style="margin-bottom:14px"><tr><td><b>${esc(familyName || '')}</b><br>Statement #${esc(st.number)}</td>
      <td class="r">Date ${esc(longDate(st.statement_date))}<br>${st.period_start ? `For ${esc(periodText(st.period_start, st.period_end))}<br>` : ''}<b>Due ${esc(longDate(st.due_date))}</b></td></tr></table>
    <table><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr>
      <tr><td></td><td>Previous balance</td><td class="r">${esc(money(st.previous_balance))}</td></tr>
      ${rows}
      <tr class="tot"><td></td><td>Balance due</td><td class="r">${esc(money(st.balance_due))}</td></tr></table>
    ${info?.payment_instructions ? `<div class="box"><b>How to pay:</b> ${esc(info.payment_instructions)}</div>` : ''}`);
}

export function printTaxStatement(t) {
  const p = t.provider || {};
  printWindow(`Childcare payments ${t.year}: ${t.family || ''}`, `
    <h1>Childcare payments for ${esc(t.year)}</h1>
    <div class="sub">Keep this for your taxes (child and dependent care credit, Form 2441) or a dependent care FSA claim.</div>
    <table>
      <tr><th style="width:190px">Provider</th><td>${esc(p.name)}${p.dba && p.dba !== p.name ? ` (${esc(p.dba)})` : ''}</td></tr>
      <tr><th>Address</th><td>${esc(p.address || '')}</td></tr>
      <tr><th>Phone</th><td>${esc(p.phone || '')}</td></tr>
      <tr><th>Tax ID (EIN)</th><td>${esc(p.tax_id || 'Ask the daycare')}</td></tr>
      ${p.license ? `<tr><th>License number</th><td>${esc(p.license)}</td></tr>` : ''}
      <tr><th>Family</th><td>${esc(t.family || '')}</td></tr>
      <tr><th>Children</th><td>${esc((t.children || []).join(', '))}</td></tr>
    </table>
    <div class="big">${esc(money(t.total_paid))}</div>
    <div style="font-size:13px;color:#475569">paid by the family in ${esc(t.year)} (${esc(t.payments)} payment${t.payments === 1 ? '' : 's'}). Amounts paid by a subsidy agency are not included.</div>
    <div style="margin-top:36px;font-size:12px;color:#475569">Provider signature: ______________________________ &nbsp; Date: ____________</div>`);
}
