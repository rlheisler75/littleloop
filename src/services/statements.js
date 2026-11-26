import { loopMarkSvg } from '../lib/loopMark';
// Year-end statements: family childcare statement (for Form 2441 / dependent-care FSA)
// and sitter earnings summary. Both open as a printable page, like invoices.
import { fmt, fmtDate, esc } from './format';

const fmtTin = (tin, type) => {
  if (!tin) return '';
  return type === 'ein' ? `${tin.slice(0, 2)}-${tin.slice(2)}` : `${tin.slice(0, 3)}-${tin.slice(3, 5)}-${tin.slice(5)}`;
};
const range = (a, b) => (!a ? '—' : (!b || a === b) ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`);
const addr = p => [p.address_line1, p.address_line2, [p.city, p.state].filter(Boolean).join(', ') + (p.zip ? ' ' + p.zip : '')]
  .filter(s => s && s.trim()).map(esc).join('<br>');

const STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#14243A;padding:28px 18px;max-width:780px;margin:0 auto;font-size:13px;line-height:1.5}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:3px solid #FF6B57;margin-bottom:20px}
  .logo{font-size:22px;font-weight:800;color:#2B2D6B}.logo small{display:block;font-size:12px;color:#888;font-weight:400}
  h1{font-size:22px;color:#2B2D6B;text-align:right}h1 small{display:block;font-size:12px;color:#888;font-weight:400}
  h2{font-size:15px;color:#2B2D6B;margin:22px 0 8px}
  .label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
  .box{border:1px solid #E6E8F2;border-radius:10px;padding:12px 14px}
  .tin{font-family:Menlo,Consolas,monospace;font-size:14px;font-weight:700;letter-spacing:.5px}
  .warn{color:#B5541F;font-size:12px}
  .big{font-size:26px;font-weight:800;color:#2B2D6B}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:12px}
  th{background:#F6F7FC;padding:6px 8px;text-align:left;font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:#666;border-bottom:1px solid #E1E4F0}
  td{padding:7px 8px;border-bottom:1px solid #EEF0F7;vertical-align:top}
  .r{text-align:right}tfoot td{font-weight:700;border-top:2px solid #2B2D6B;border-bottom:none}
  .note{background:#FFF8E6;border-left:3px solid #FFC23C;padding:10px 14px;border-radius:0 8px 8px 0;font-size:11.5px;color:#5A4A20;margin-top:18px}
  .sig{margin-top:30px;display:grid;grid-template-columns:2fr 1fr;gap:24px}.sig div{border-top:1px solid #999;padding-top:4px;font-size:11px;color:#666}
  .foot{margin-top:26px;font-size:10.5px;color:#999;text-align:center}
  .provider{page-break-inside:avoid}
  .btns{text-align:center;margin-top:22px}
  .btns button{padding:11px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin:4px}
  @media print{.no-print{display:none!important}body{padding:0}}
  @media(max-width:600px){.grid,.sig{grid-template-columns:1fr}h1{text-align:left}}
`;

function open(title, body) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}
<div class="btns no-print">
  <button onclick="window.print()" style="background:#2B2D6B;color:#fff">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#eee;color:#333">✕ Close</button>
</div></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) window.location.href = url;   // popup blocked (common on iOS after an await)
}

// ── Family: annual childcare statement ───────────────────────────────────────
export function printCareStatement(data) {
  const year = data.year;
  const providers = data.providers || [];
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const providerBlocks = providers.map(p => {
    const kids = Object.entries(p.children || {});
    return `<div class="provider">
  <h2>Care provider: ${esc(p.legal_name)}</h2>
  <div class="grid">
    <div class="box"><div class="label">Provider name &amp; address</div>
      <strong>${esc(p.legal_name)}</strong>${p.name && p.name !== p.legal_name ? ` <span style="color:#888">(${esc(p.name)})</span>` : ''}<br>
      ${addr(p) || '<span class="warn">Address not on file. Ask your provider.</span>'}</div>
    <div class="box"><div class="label">Provider tax ID (${p.tin_type === 'ein' ? 'EIN' : p.tin_type === 'ssn' ? 'SSN' : 'TIN'})</div>
      ${p.tin ? `<div class="tin">${fmtTin(p.tin, p.tin_type)}</div>` : '<div class="warn">Not on file. Ask your provider for their SSN or EIN (IRS Form W-10).</div>'}
      <div class="label" style="margin-top:10px">Paid to this provider in ${year}</div>
      <div class="big">${fmt(p.total_paid)}</div></div>
  </div>
  ${kids.length ? `<div class="label">By child</div><table><thead><tr><th>Child</th><th class="r">Amount</th></tr></thead><tbody>
    ${kids.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${fmt(v)}</td></tr>`).join('')}</tbody></table>` : ''}
  <div class="label">Payments</div>
  <table><thead><tr><th>Paid</th><th>Invoice</th><th>Service dates</th><th>Child(ren)</th><th class="r">Amount</th></tr></thead><tbody>
  ${(p.invoices || []).map(i => `<tr><td>${fmtDate(i.paid_on)}</td><td>${esc(i.invoice_number)}</td><td>${range(i.svc_start, i.svc_end)}</td><td>${(i.children || []).map(esc).join(', ') || '—'}</td><td class="r">${fmt(i.total)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="4">Total paid in ${year}</td><td class="r">${fmt(p.total_paid)}</td></tr></tfoot></table>
</div>`;
  }).join('');

  const out = data.outstanding || {};
  open(`${year} Childcare Statement - ${data.family?.name || ''}`, `
<div class="head">
  <div class="logo">${loopMarkSvg()}littleloop<small>Childcare payment statement</small></div>
  <h1>${year} Childcare Statement<small>Prepared ${today}</small></h1>
</div>
<div class="grid">
  <div class="box"><div class="label">Family</div><strong>${esc(data.family?.name || '')}</strong></div>
  <div class="box"><div class="label">Total childcare paid in ${year}</div><div class="big">${fmt(data.total_paid)}</div>
    <div style="font-size:11px;color:#888">${providers.length} provider${providers.length === 1 ? '' : 's'}</div></div>
</div>
${providers.length ? providerBlocks : `<p style="margin:20px 0;color:#888">No paid invoices were recorded for ${year}.</p>`}
${out.count ? `<p class="warn" style="margin-top:8px">Not included: ${out.count} unpaid invoice${out.count === 1 ? '' : 's'} (${fmt(out.amount)}) issued in ${year}. Expenses count in the year you pay them.</p>` : ''}
<div class="note"><strong>About this statement.</strong> It lists childcare payments recorded as paid in littleloop between Jan 1 and Dec 31, ${year}.
You can use it for the Child and Dependent Care Credit (IRS Form 2441, Part I) or a Dependent Care FSA claim.
Only amounts for care that let you work or look for work qualify. Check with your tax preparer or FSA administrator.
littleloop does not provide tax advice.</div>
<div class="sig"><div>Provider signature (if your FSA requires it)</div><div>Date</div></div>
<div class="foot">Generated by littleloop · littleloop.xyz</div>`);
}

// ── Sitter: annual earnings summary ──────────────────────────────────────────
// invoices: [{ invoice_number, family_name, paid_on, total }] (already filtered to the year, paid)
export function printEarningsSummary({ year, sitter, invoices, outstanding }) {
  const byFam = {}, byMonth = Array(12).fill(0);
  let total = 0;
  invoices.forEach(i => {
    byFam[i.family_name] = (byFam[i.family_name] || 0) + i.total;
    byMonth[Number(i.paid_on.slice(5, 7)) - 1] += i.total;
    total += i.total;
  });
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const legal = sitter.legal_name || sitter.name || '';

  open(`${year} Earnings Summary`, `
<div class="head">
  <div class="logo">${loopMarkSvg()}littleloop<small>Earnings summary</small></div>
  <h1>${year} Earnings Summary<small>Prepared ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></h1>
</div>
<div class="grid">
  <div class="box"><div class="label">Provider</div><strong>${esc(legal)}</strong><br>${addr(sitter)}</div>
  <div class="box"><div class="label">Gross childcare income received in ${year}</div><div class="big">${fmt(total)}</div>
    <div style="font-size:11px;color:#888">${invoices.length} paid invoice${invoices.length === 1 ? '' : 's'} · ${Object.keys(byFam).length} famil${Object.keys(byFam).length === 1 ? 'y' : 'ies'}</div></div>
</div>
<h2>By family</h2>
<table><thead><tr><th>Family</th><th class="r">Received</th></tr></thead><tbody>
${Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(([f, v]) => `<tr><td>${esc(f)}</td><td class="r">${fmt(v)}</td></tr>`).join('')}
</tbody><tfoot><tr><td>Total</td><td class="r">${fmt(total)}</td></tr></tfoot></table>
<h2>By month</h2>
<div style="overflow-x:auto"><table style="min-width:560px"><thead><tr>${months.map(m => `<th class="r">${m}</th>`).join('')}</tr></thead><tbody><tr>
${byMonth.map(v => `<td class="r">${v ? fmt(v).replace('.00', '') : '—'}</td>`).join('')}</tr></tbody></table></div>
<h2>Payments</h2>
<table><thead><tr><th>Paid</th><th>Invoice</th><th>Family</th><th class="r">Amount</th></tr></thead><tbody>
${invoices.map(i => `<tr><td>${fmtDate(i.paid_on)}</td><td>${esc(i.invoice_number)}</td><td>${esc(i.family_name)}</td><td class="r">${fmt(i.total)}</td></tr>`).join('')}
</tbody></table>
${outstanding?.count ? `<p class="warn">Not included: ${outstanding.count} unpaid invoice${outstanding.count === 1 ? '' : 's'} (${fmt(outstanding.amount)}) issued in ${year}.</p>` : ''}
<div class="note"><strong>For your records.</strong> Totals are invoices marked paid in littleloop during ${year}. Cash or payments you didn't record here aren't included.
Self-employed childcare income usually goes on Schedule C, and you may owe self-employment tax. Check with a tax preparer.
littleloop does not provide tax advice.</div>
<div class="foot">Generated by littleloop · littleloop.xyz</div>`);
}
