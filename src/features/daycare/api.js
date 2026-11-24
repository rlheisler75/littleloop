import { supabase } from '../../lib/supabase';

export const STAFF_ROLES = [
  { id: 'director', label: 'Director', desc: 'Everything, including the center\'s details and other directors' },
  { id: 'office',   label: 'Office',   desc: 'Families, classrooms and staff' },
  { id: 'teacher',  label: 'Teacher',  desc: 'Check-ins, classroom board and updates' },
];
export const roleLabel = r => STAFF_ROLES.find(x => x.id === r)?.label || r;
export const isManagerRole = r => r === 'director' || r === 'office';

export const ROOM_COLORS = ['#E8845C', '#F5B83D', '#5DBB8A', '#4AA3DF', '#8B78D4', '#E06C9F', '#3FB6B2', '#8A9BB0'];

export const STARTER_ROOMS = [
  { name: 'Infants',   age_group: '6 wks – 12 mos', ratio: 4,  capacity: 8,  color: '#E06C9F' },
  { name: 'Toddlers',  age_group: '1 – 2 yrs',      ratio: 6,  capacity: 12, color: '#F5B83D' },
  { name: 'Preschool', age_group: '3 – 5 yrs',      ratio: 10, capacity: 20, color: '#4AA3DF' },
];

// "8 mo" under two, "3 yr" after.
export function ageText(dob) {
  if (!dob) return '';
  const d = new Date(dob + 'T12:00:00');
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) return '';
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

// Staff needed for this many children at 1:ratio, and whether the room is covered.
export function ratioCheck(kidsIn, staffIn, ratio) {
  const needed = kidsIn > 0 ? Math.ceil(kidsIn / Math.max(1, ratio || 1)) : 0;
  return { needed, ok: staffIn >= needed, short: Math.max(0, needed - staffIn) };
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function timeText(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayText(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Supabase/PostgREST errors carry the RAISE message we wrote in SQL; show that.
export function errText(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const m = err.message || String(err);
  if (/row-level security|permission denied/i.test(m)) return 'You don\'t have permission to do that.';
  if (/duplicate key.*facility_staff_email/i.test(m)) return 'That email is already on your staff list.';
  // Plan limits from the database carry a code in front of the message
  return m.replace(/^(PLAN_CHILD_LIMIT|TRIAL_ENDED|FREE_FAMILY_LIMIT):\s*/, '') || fallback;
}

// Email an invite (staff), a "your daycare is on littleloop" note (family), or an
// enrollment-packet reminder (reminder).
export async function sendFacilityInvite(body) {
  const { data, error } = await supabase.functions.invoke('send-facility-invite', { body });
  if (error) {
    let msg = 'Could not send the email.';
    try { msg = (await error.context?.json())?.error || msg; } catch {}
    return { ok: false, error: msg };
  }
  return { ok: true, hasAccount: !!data?.has_account };
}

// Latest check-in per child among rows sorted newest first.
export function latestByChild(rows) {
  const m = {};
  for (const r of rows || []) if (!m[r.child_id]) m[r.child_id] = r;
  return m;
}
