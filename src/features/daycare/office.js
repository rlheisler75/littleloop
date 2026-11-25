import { localDate } from './enrollment';

// Daycare office (phase 4B): expense categories, date ranges and CSV downloads.

export const EXPENSE_CATEGORIES = [
  { id: 'payroll',            label: 'Payroll and wages',      qb: 'Payroll Expenses' },
  { id: 'benefits',           label: 'Staff benefits',         qb: 'Employee Benefits' },
  { id: 'rent',               label: 'Rent or mortgage',       qb: 'Rent or Lease' },
  { id: 'utilities',          label: 'Utilities',              qb: 'Utilities' },
  { id: 'food',               label: 'Food and snacks',        qb: 'Food' },
  { id: 'classroom_supplies', label: 'Classroom supplies',     qb: 'Supplies & Materials' },
  { id: 'cleaning',           label: 'Cleaning and janitorial', qb: 'Janitorial Expense' },
  { id: 'repairs',            label: 'Repairs and maintenance', qb: 'Repairs & Maintenance' },
  { id: 'equipment',          label: 'Furniture and equipment', qb: 'Equipment' },
  { id: 'insurance',          label: 'Insurance',              qb: 'Insurance' },
  { id: 'licenses',           label: 'Licenses and fees',      qb: 'Taxes & Licenses' },
  { id: 'training',           label: 'Training',               qb: 'Training' },
  { id: 'transportation',     label: 'Transportation',         qb: 'Travel' },
  { id: 'marketing',          label: 'Advertising',            qb: 'Advertising & Marketing' },
  { id: 'office',             label: 'Office expenses',        qb: 'Office Supplies & Software' },
  { id: 'professional',       label: 'Accounting and legal',   qb: 'Legal & Professional Services' },
  { id: 'taxes',              label: 'Taxes',                  qb: 'Taxes & Licenses' },
  { id: 'bank_fees',          label: 'Bank and card fees',     qb: 'Bank Charges & Fees' },
  { id: 'other',              label: 'Other',                  qb: 'Other Business Expenses' },
];
export const expenseCat = id => EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export const EXPENSE_METHODS = [
  { id: 'card', label: 'Card' }, { id: 'check', label: 'Check' }, { id: 'ach', label: 'Bank transfer' },
  { id: 'cash', label: 'Cash' }, { id: 'other', label: 'Other' },
];
export const FREQUENCIES = [
  { id: 'weekly', label: 'Every week' }, { id: 'monthly', label: 'Every month' },
  { id: 'quarterly', label: 'Every 3 months' }, { id: 'yearly', label: 'Every year' },
];
export const INCOME_LABELS = { family_payments: 'Tuition and fees paid by families', agency_payments: 'Subsidy payments from agencies' };

const ymd = (y, m, d) => localDate(new Date(y, m, d, 12));
// Preset ranges as [from, to] (YYYY-MM-DD, inclusive)
export function presetRange(id, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  switch (id) {
    case 'this_week': { const t = new Date(now); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const e = new Date(t); e.setDate(e.getDate() + 6); return [localDate(t), localDate(e)]; }
    case 'last_week': { const t = new Date(now); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) - 7); const e = new Date(t); e.setDate(e.getDate() + 6); return [localDate(t), localDate(e)]; }
    case 'this_month':   return [ymd(y, m, 1), ymd(y, m + 1, 0)];
    case 'last_month':   return [ymd(y, m - 1, 1), ymd(y, m, 0)];
    case 'this_quarter': { const q = Math.floor(m / 3) * 3; return [ymd(y, q, 1), ymd(y, q + 3, 0)]; }
    case 'this_year':    return [ymd(y, 0, 1), ymd(y, 11, 31)];
    case 'last_year':    return [ymd(y - 1, 0, 1), ymd(y - 1, 11, 31)];
    default:             return [ymd(y, m, 1), ymd(y, m + 1, 0)];
  }
}
export const RANGE_PRESETS = [
  { id: 'this_week', label: 'This week' }, { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' }, { id: 'this_year', label: 'This year' }, { id: 'last_year', label: 'Last year' },
];

export const hours = mins => (Math.round((Number(mins) || 0) / 6) / 10).toFixed(1);   // minutes -> "7.5"
export const monthLabel = iso => new Date(iso + 'T12:00:00').toLocaleDateString([], { month: 'short', year: 'numeric' });

// CSV: quote every cell, CRLF line ends (what Excel and QuickBooks expect)
export function downloadCsv(filename, rows) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = rows.map(r => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
