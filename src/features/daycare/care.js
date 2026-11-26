import { supabase } from '../../lib/supabase';
import { localDate } from './enrollment';
import { mealLabel } from './kitchen';

// What a teacher can log during the day. `choices` become quick-pick chips stored in
// `amount` (meal) or `detail` (everything else).
export const CARE_KINDS = [
  { id: 'meal',     icon: '🍎', label: 'Meal',     amountChoices: ['All', 'Most', 'Some', 'None'], detailLabel: 'What was served', detailPlaceholder: 'e.g. Lunch: pasta, peas, milk' },
  { id: 'bottle',   icon: '🍼', label: 'Bottle',   amountLabel: 'Ounces', choices: ['Formula', 'Breast milk', 'Milk', 'Water'] },
  { id: 'nap',      icon: '😴', label: 'Nap' },
  { id: 'diaper',   icon: '🧷', label: 'Diaper',   choices: ['Wet', 'BM', 'Wet + BM', 'Dry'] },
  { id: 'potty',    icon: '🚽', label: 'Potty',    choices: ['Went', 'Tried', 'Accident'] },
  { id: 'mood',     icon: '🙂', label: 'Mood',     choices: ['Happy', 'Calm', 'Playful', 'Tired', 'Fussy', 'Sad'] },
  { id: 'activity', icon: '🎨', label: 'Activity', detailLabel: 'What they did', detailPlaceholder: 'e.g. Finger painting, outside time' },
  { id: 'medicine', icon: '💊', label: 'Medicine', detailLabel: 'Medicine and dose', detailPlaceholder: 'e.g. Amoxicillin 5 mL', detailRequired: true },
  { id: 'note',     icon: '📝', label: 'Note',     noteRequired: true },
];
export const careKind = id => CARE_KINDS.find(k => k.id === id) || CARE_KINDS[CARE_KINDS.length - 1];

export const MOOD_ICON = { Happy: '😄', Calm: '😌', Playful: '🤸', Tired: '🥱', Fussy: '😣', Sad: '😢' };

export const today = () => localDate();

// "1:05 PM" from a timestamp; "13:05" for <input type="time">
export const clock = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const timeInput = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Combine a YYYY-MM-DD day and an HH:MM time (local) into an ISO timestamp.
export function stamp(day, hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const d = new Date(day + 'T00:00:00');
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function minutesText(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// One line describing an entry, for timelines and the parent's report.
export function describe(log) {
  const k = careKind(log.kind);
  const bits = [];
  if (log.kind === 'nap') {
    if (log.ended_at) {
      const mins = Math.max(1, Math.round((new Date(log.ended_at) - new Date(log.started_at)) / 60000));
      bits.push(`Slept ${clock(log.started_at)} – ${clock(log.ended_at)} (${minutesText(mins)})`);
    } else bits.push(`Fell asleep at ${clock(log.started_at)}`);
  } else if (log.kind === 'meal') {
    if (log.meal) bits.push(mealLabel(log.meal));                       // which meal (for meal counts)
    if (log.amount) bits.push(`Ate ${log.amount.toLowerCase()}`); else if (!log.meal) bits.push('Meal');
    if (log.detail) bits.push(log.detail);
  } else if (log.kind === 'bottle') {
    bits.push(log.amount ? `${log.amount} oz` : 'Bottle');
    if (log.detail) bits.push(log.detail.toLowerCase());
  } else if (log.kind === 'mood') {
    bits.push(`${MOOD_ICON[log.detail] || ''} ${log.detail || 'Mood'}`.trim());
  } else if (log.detail) {
    bits.push(log.detail);
  } else bits.push(k.label);
  return bits.join(' · ');
}

// Short chips for a child's row on the Today board: counts plus an open nap.
export function summarize(logs) {
  const by = {};
  for (const l of logs) (by[l.kind] ||= []).push(l);
  const out = [];
  const napping = (by.nap || []).find(l => !l.ended_at) || null;
  const napMins = (by.nap || []).filter(l => l.ended_at)
    .reduce((s, l) => s + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0);
  for (const k of CARE_KINDS) {
    const list = by[k.id];
    if (!list?.length) continue;
    if (k.id === 'nap') { if (napMins) out.push(`😴 ${minutesText(napMins)}`); continue; }
    if (k.id === 'mood') { const last = list[list.length - 1]; out.push(MOOD_ICON[last.detail] || '🙂'); continue; }
    out.push(list.length > 1 ? `${k.icon}${list.length}` : k.icon);
  }
  return { chips: out, napping };
}

// Entries for these children on one day, oldest first, grouped by child.
export async function loadCareLogs(facilityId, day, childIds = null) {
  let q = supabase.from('care_logs').select('*').eq('facility_id', facilityId).eq('day', day).order('started_at');
  if (childIds) q = q.in('child_id', childIds);
  const { data, error } = await q;
  if (error) console.error('loadCareLogs:', error);
  const by = {};
  for (const l of data || []) (by[l.child_id] ||= []).push(l);
  return by;
}

export async function loadDailyReports(facilityId, day, childIds = null) {
  let q = supabase.from('daily_reports').select('*').eq('facility_id', facilityId).eq('day', day);
  if (childIds) q = q.in('child_id', childIds);
  const { data } = await q;
  return Object.fromEntries((data || []).map(r => [r.child_id, r]));
}

// Alert the child's parents (in-app + push). Failure here never blocks the action itself.
export async function notifyParents(body) {
  const { error } = await supabase.functions.invoke('daycare-notify', { body });
  if (error) {
    let msg = 'The family wasn\'t notified.';
    try { msg = (await error.context?.json())?.error || msg; } catch {}
    return msg;
  }
  return null;
}
