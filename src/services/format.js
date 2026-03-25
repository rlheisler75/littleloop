import { PAYMENT_TYPES } from '../lib/constants';

// ─── Number / date formatters ─────────────────────────────────────────────────

export function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function fmtDateRange(items) {
  if (!items?.length) return '';
  const dates = items.map(i => new Date(i.service_date + 'T00:00:00')).sort((a, b) => a - b);
  const lo = dates[0], hi = dates[dates.length - 1];
  if (lo.toDateString() === hi.toDateString()) return fmtDate(lo.toISOString().slice(0, 10));
  return `${fmtDate(lo.toISOString().slice(0, 10))} – ${fmtDate(hi.toISOString().slice(0, 10))}`;
}

export function fmtHours(h) {
  if (!h || h < 0) return '0h 0m';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

export function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000)    return 'just now';
  if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function getMoodIcon(mood) {
  const MOODS = {
    happy:'😄', content:'😊', proud:'🥹', excited:'🤩',
    tired:'😴', fussy:'😣',  rested:'😌', curious:'🧐',
  };
  return MOODS[mood] || '';
}

export function getTypeIcon(type) {
  const TYPES = {
    activity:'🎨', meal:'🍎', nap:'😴',
    milestone:'⭐', note:'📝', photo:'📸',
  };
  return TYPES[type] || '📝';
}

// ─── Invoice print ────────────────────────────────────────────────────────────

export function printInvoice(invoice, items, sitter, family, adminMember) {
  const enabledMethods = (sitter.payment_methods || []).filter(m => m.enabled);
  const total      = items.reduce((s, it) => s + (it.amount || 0), 0);
  const totalHours = items.filter(i => i.rate_type === 'hourly').reduce((s, i) => s + (i.hours || 0), 0);
  const dateRange  = fmtDateRange(items);

  const paymentButtons = enabledMethods.map(m => {
    const pt   = PAYMENT_TYPES.find(p => p.id === m.type);
    if (!pt) return '';
    const link = pt.deeplink ? pt.deeplink(m.handle, total.toFixed(2), invoice.invoice_number) : '';
    if (link) {
      return `<a href="${link}" style="display:inline-block;padding:12px 20px;background:#1a2a3a;border:1px solid #3A6FD4;border-radius:10px;color:#7BAAEE;text-decoration:none;font-size:14px;font-weight:600;margin:4px">${pt.icon} Pay with ${pt.label}${m.handle ? ' · ' + m.handle : ''}</a>`;
    }
    return `<div style="display:inline-block;padding:12px 20px;background:#1a2a3a;border:1px solid #444;border-radius:10px;color:#aaa;font-size:14px;margin:4px">${pt.icon} ${pt.label}${m.handle ? ' · ' + m.handle : ''}</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${invoice.invoice_number} - littleloop</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#14243A;padding:24px 16px;max-width:760px;margin:0 auto;font-size:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #E8F0FA;flex-wrap:wrap;gap:12px}
  .logo{font-size:24px;font-weight:700;color:#2550A8;letter-spacing:-0.5px}
  .logo span{font-size:13px;display:block;color:#888;font-weight:400;margin-top:2px}
  .inv-num{font-size:28px;font-weight:700;color:#2550A8}
  .inv-meta{font-size:12px;color:#666;margin-top:4px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .party h3{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:8px}
  .party p{font-size:13px;line-height:1.7;color:#333}
  .party strong{color:#14243A}
  .section-title{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;min-width:480px}
  th{background:#F4F8FF;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#666;border-bottom:1px solid #DDE8F5}
  td{padding:8px;border-bottom:1px solid #EEF3FA;color:#333;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .amount{text-align:right}
  .totals{margin-left:auto;width:240px;margin-bottom:28px}
  .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555;border-bottom:1px solid #EEF3FA}
  .totals-row.grand{font-size:16px;font-weight:700;color:#14243A;border-bottom:none;padding-top:10px}
  .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .status-draft{background:#F5F5F5;color:#888}
  .status-sent{background:#EEF5FF;color:#2550A8}
  .status-paid{background:#EEFAF5;color:#1A7A55}
  .payment-section{margin-bottom:28px}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #EEF3FA;font-size:11px;color:#aaa;text-align:center}
  .purpose{background:#F4F8FF;border-left:3px solid #3A6FD4;padding:10px 14px;border-radius:0 8px 8px 0;font-size:12px;color:#3A5070;margin-bottom:24px}
  @media print{body{padding:20px}.no-print{display:none!important}a{color:#2550A8!important}}
  @media(max-width:600px){
    body{padding:16px 12px;font-size:13px}
    .header>div:last-child{text-align:left}
    .inv-num{font-size:20px}
    .parties{grid-template-columns:1fr}
    .totals{width:100%}
    .payment-section a,.payment-section div{display:block!important;width:100%;text-align:center;margin:6px 0!important;box-sizing:border-box;padding:12px!important}
    .purpose{font-size:11px}
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">➿ littleloop<span>Independent Childcare</span></div>
  </div>
  <div style="text-align:right">
    <div class="inv-num">${invoice.invoice_number}</div>
    <div class="inv-meta">Issued: ${fmtDate(invoice.issued_date)}</div>
    ${invoice.due_date ? `<div class="inv-meta">Due: ${fmtDate(invoice.due_date)}</div>` : ''}
    <div style="margin-top:6px"><span class="status status-${invoice.status}">${invoice.status}</span></div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>Care Provider</h3>
    <p><strong>${sitter.legal_name || sitter.name || sitter.sitter_name || 'Care Provider'}</strong><br>
    ${sitter.address_line1 || ''}<br>
    ${sitter.address_line2 ? sitter.address_line2 + '<br>' : ''}
    ${[sitter.city, sitter.state, sitter.zip].filter(Boolean).join(', ')}</p>
  </div>
  <div class="party">
    <h3>Billed To</h3>
    <p><strong>${family.name}</strong><br>
    ${adminMember?.name || ''}</p>
  </div>
</div>

<div class="purpose" style="word-wrap:break-word">
  <strong>Purpose of care:</strong> Childcare services · Service period: ${dateRange}
  ${totalHours > 0 ? ` · Total hours: ${totalHours.toFixed(2)}` : ''}
</div>

<div class="section-title">Services Rendered</div>
<table style="width:100%">
  <thead>
    <tr>
      <th>Date</th><th>Child</th><th>Description</th>
      <th>Type</th><th>Hrs</th><th>Rate</th><th class="amount">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(it => `
    <tr>
      <td>${it.end_date && it.end_date !== it.service_date ? fmtDate(it.service_date) + ' – ' + fmtDate(it.end_date) : fmtDate(it.service_date)}</td>
      <td>${it.child_name}</td>
      <td>${it.description || '—'}</td>
      <td style="text-transform:capitalize">${it.rate_type}</td>
      <td>${it.rate_type === 'hourly' ? (it.hours || 0).toFixed(2) : '—'}</td>
      <td>${fmt(it.rate)}${it.rate_type === 'hourly' ? '/hr' : ''}</td>
      <td class="amount">${fmt(it.amount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  ${totalHours > 0 ? `<div class="totals-row"><span>Total hours</span><span>${totalHours.toFixed(2)}</span></div>` : ''}
  <div class="totals-row grand"><span>Total Due</span><span>${fmt(total)}</span></div>
</div>

${invoice.notes ? `<div style="margin-bottom:24px"><div class="section-title">Notes</div><p style="font-size:13px;color:#555;line-height:1.6">${invoice.notes}</p></div>` : ''}

${enabledMethods.length > 0 ? `
<div class="payment-section no-print">
  <div class="section-title">Pay This Invoice</div>
  <div>${paymentButtons}</div>
</div>` : ''}

<div class="footer">
  This invoice was generated via littleloop · littleloop.xyz<br>
  For FSA/DCFSA reimbursement: provider's TIN available upon request.
</div>

<div class="no-print" style="text-align:center;margin-top:24px">
  <button onclick="window.print()" style="padding:12px 28px;background:#2550A8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="padding:12px 28px;background:#f0f0f0;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-left:10px">✕ Close</button>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
