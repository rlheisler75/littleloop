import { supabase } from '../../lib/supabase';
import { localDate, addDays, fmtDate } from './enrollment';

// Lesson plans, the skills checklist and report cards (staff and parents).

export const DOMAINS = [
  { id: 'social',      icon: '💛', label: 'Social & emotional' },
  { id: 'language',    icon: '💬', label: 'Language & communication' },
  { id: 'cognitive',   icon: '🧩', label: 'Thinking & problem solving' },
  { id: 'literacy',    icon: '📖', label: 'Early literacy' },
  { id: 'math',        icon: '🔢', label: 'Early math' },
  { id: 'gross_motor', icon: '🤸', label: 'Large motor' },
  { id: 'fine_motor',  icon: '✋', label: 'Small motor' },
  { id: 'self_care',   icon: '🧼', label: 'Self-care' },
];
export const domainOf = id => DOMAINS.find(d => d.id === id) || DOMAINS[0];

export const BANDS = [
  { id: 'infant',    label: 'Infants',   hint: 'under 1' },
  { id: 'toddler',   label: 'Toddlers',  hint: '1 to 2' },
  { id: 'preschool', label: 'Preschool', hint: '3 to 5' },
];
export const bandOf = id => BANDS.find(b => b.id === id) || BANDS[2];

// Age band from a date of birth: under 12 months, under 3 years, then preschool.
export function bandForDob(dob) {
  if (!dob) return null;
  const d = new Date(dob + 'T12:00:00'), now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return months < 12 ? 'infant' : months < 36 ? 'toddler' : 'preschool';
}

export const LEVELS = [
  { id: 'not_yet',    label: 'Not yet',    color: '#94A3B8', step: 0 },
  { id: 'emerging',   label: 'Emerging',   color: '#E0A03C', step: 1 },
  { id: 'developing', label: 'Developing', color: '#4AA3DF', step: 2 },
  { id: 'achieved',   label: 'Achieved',   color: '#3A9E7A', step: 3 },
];
export const levelOf = id => LEVELS.find(l => l.id === id) || null;

// Learning areas for lesson-plan activities
export const AREAS = [
  { id: 'circle',   icon: '🟠', label: 'Circle time' },
  { id: 'literacy', icon: '📖', label: 'Reading & writing' },
  { id: 'math',     icon: '🔢', label: 'Math' },
  { id: 'science',  icon: '🔬', label: 'Science & nature' },
  { id: 'art',      icon: '🎨', label: 'Art' },
  { id: 'music',    icon: '🎵', label: 'Music & movement' },
  { id: 'sensory',  icon: '🌈', label: 'Sensory' },
  { id: 'outdoor',  icon: '🌳', label: 'Outdoor play' },
  { id: 'dramatic', icon: '🎭', label: 'Pretend play' },
  { id: 'other',    icon: '✨', label: 'Other' },
];
export const areaOf = id => AREAS.find(a => a.id === id) || AREAS[AREAS.length - 1];

export const DAYS = [
  { n: 1, label: 'Monday',    short: 'Mon' },
  { n: 2, label: 'Tuesday',   short: 'Tue' },
  { n: 3, label: 'Wednesday', short: 'Wed' },
  { n: 4, label: 'Thursday',  short: 'Thu' },
  { n: 5, label: 'Friday',    short: 'Fri' },
];

// Monday of the week a YYYY-MM-DD day falls in
export function weekStart(iso = localDate()) {
  const d = new Date(iso + 'T12:00:00');
  return addDays(iso, -((d.getDay() + 6) % 7));
}
export function weekText(monday) {
  const fri = addDays(monday, 4);
  const a = new Date(monday + 'T12:00:00'), b = new Date(fri + 'T12:00:00');
  const sameMonth = a.getMonth() === b.getMonth();
  return `${a.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString([], sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}
export const dayDate = (monday, n) => new Date(addDays(monday, n - 1) + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });

// A sensible report-card period for today: Fall (Aug–Dec), Spring (Jan–May), Summer (Jun–Jul)
export function defaultPeriod(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth() + 1;
  if (m >= 8) return { period: `Fall ${y}`, start: `${y}-08-01`, end: `${y}-12-31` };
  if (m >= 6) return { period: `Summer ${y}`, start: `${y}-06-01`, end: `${y}-07-31` };
  return { period: `Spring ${y}`, start: `${y}-01-01`, end: `${y}-05-31` };
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// ── Data ─────────────────────────────────────────────────────────────────────
export async function loadSkills(facilityId) {
  const { data, error } = await supabase.from('facility_skills').select('*').eq('facility_id', facilityId)
    .order('band').order('domain').order('sort').order('name');
  if (error) console.error('loadSkills:', error);
  return data || [];
}

// Latest observation per child and skill (optionally only up to a day). Returns { childId: { skillId: obs } }.
export async function loadLatestLevels(facilityId, childIds, upTo = null) {
  if (!childIds.length) return {};
  let q = supabase.from('skill_observations').select('id, child_id, skill_id, level, note, observed_on, created_at, created_by, created_by_name')
    .eq('facility_id', facilityId).in('child_id', childIds)
    .order('observed_on', { ascending: false }).order('created_at', { ascending: false });
  if (upTo) q = q.lte('observed_on', upTo);
  const { data, error } = await q;
  if (error) console.error('loadLatestLevels:', error);
  const out = {};
  for (const o of data || []) {
    const c = (out[o.child_id] ||= {});
    if (!c[o.skill_id]) c[o.skill_id] = o;
  }
  return out;
}

// A report card's skills: every active skill in the band with the child's latest level.
export function snapshotSkills(skills, band, latest = {}) {
  return skills
    .filter(s => s.active && s.band === band)
    .sort((a, b) => DOMAINS.findIndex(d => d.id === a.domain) - DOMAINS.findIndex(d => d.id === b.domain) || a.sort - b.sort)
    .map(s => ({ skill_id: s.id, domain: s.domain, name: s.name, level: latest[s.id]?.level || null }));
}

// Skills grouped by domain, in domain order, skipping empty domains.
export function byDomain(items) {
  return DOMAINS.map(d => ({ ...d, items: items.filter(i => i.domain === d.id) })).filter(d => d.items.length);
}

export const childName = c => c ? (c.preferred_name || c.name) : 'Child';

// ── Starter checklist (each daycare can rename, hide or add to it) ───────────
export const STARTER_SKILLS = {
  infant: {
    social:      ['Smiles back at familiar people', 'Calms with comfort from a caregiver', 'Shows interest in other babies'],
    language:    ['Coos and babbles', 'Turns toward voices and sounds', 'Uses gestures, like reaching to be picked up or waving'],
    cognitive:   ['Follows a moving object with their eyes', 'Explores toys by shaking, banging and mouthing', 'Looks for a toy that was just hidden'],
    gross_motor: ['Holds head steady', 'Rolls over', 'Sits without support', 'Pulls up to stand'],
    fine_motor:  ['Brings hands to mouth', 'Grasps a toy and lets it go', 'Picks up small pieces with thumb and finger'],
    self_care:   ['Helps hold a bottle or cup', 'Feeds self finger foods'],
  },
  toddler: {
    social:      ['Plays alongside other children', 'Shows affection for familiar adults', 'Takes turns with help', 'Shows or names some feelings'],
    language:    ['Uses single words, then two-word phrases', 'Follows simple one-step directions', 'Points to named pictures or body parts', 'Uses 50 or more words'],
    cognitive:   ['Matches simple shapes or colors', 'Uses objects in pretend play', 'Completes a simple 3–4 piece puzzle'],
    literacy:    ['Enjoys being read to and turns the pages', 'Names familiar pictures in books'],
    math:        ['Understands "more" and "all gone"', 'Sorts objects into groups'],
    gross_motor: ['Walks steadily', 'Climbs on and off play equipment', 'Kicks a ball', 'Runs'],
    fine_motor:  ['Scribbles with a crayon', 'Stacks 4 or more blocks'],
    self_care:   ['Uses a spoon', 'Drinks from an open cup', 'Helps wash hands', 'Shows signs of toilet readiness'],
  },
  preschool: {
    social:      ['Plays cooperatively with other children', 'Takes turns and shares with few reminders', 'Follows classroom routines', 'Uses words to solve conflicts', 'Shows care when others are upset'],
    language:    ['Speaks in full sentences', 'Asks and answers who, what, where and why questions', 'Retells a familiar story or event', 'Follows two- and three-step directions'],
    cognitive:   ['Sorts by size, color or shape', 'Completes a 12+ piece puzzle', 'Stays with an activity for 10 minutes or more', 'Makes predictions and asks "what if"'],
    literacy:    ['Recognizes own name in print', 'Names most letters', 'Matches some letters with their sounds', 'Writes some letters, including in own name', 'Hears and makes rhymes'],
    math:        ['Counts to 20', 'Counts objects one by one to 10', 'Recognizes numbers 1 to 10', 'Names basic shapes', 'Compares bigger and smaller, more and less'],
    gross_motor: ['Hops on one foot', 'Catches a bounced ball', 'Pedals a tricycle'],
    fine_motor:  ['Holds a pencil with a tripod grip', 'Cuts along a line with scissors', 'Draws a person with several body parts'],
    self_care:   ['Dresses with little help', 'Uses the toilet on their own', 'Washes hands without reminders', 'Serves self at mealtime'],
  },
};

export function starterRows(facilityId) {
  const rows = [];
  for (const [band, domains] of Object.entries(STARTER_SKILLS))
    for (const [domain, names] of Object.entries(domains))
      names.forEach((name, i) => rows.push({ facility_id: facilityId, band, domain, name, sort: (i + 1) * 10 }));
  return rows;
}

// ── Printing ─────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const nl = s => esc(s).replace(/\n/g, '<br>');

function printWindow(title, css, body) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:28px}
    h1{font-size:22px;margin:0 0 2px}.sub{color:#64748b;font-size:12px;margin-bottom:14px}
    ${css}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

export function printLessonPlan(plan, roomName, facilityName) {
  const cols = DAYS.map(d => {
    const acts = (plan.activities || []).filter(a => a.day === d.n);
    return `<td>${acts.length ? acts.map(a => `<div class="act"><div class="area">${esc(areaOf(a.area).label)}</div><b>${esc(a.title)}</b>${a.description ? `<div>${nl(a.description)}</div>` : ''}${a.materials ? `<div class="mat">Materials: ${esc(a.materials)}</div>` : ''}</div>`).join('') : '<span class="none">—</span>'}</td>`;
  }).join('');
  printWindow(`Lesson plan: ${roomName}`, `
    @page{size:landscape;margin:12mm}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f1f5f9;font-size:13px;padding:6px;border:1px solid #cbd5e1}
    td{vertical-align:top;border:1px solid #cbd5e1;padding:6px;font-size:12px}
    .act{margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #e2e8f0}.act:last-child{border-bottom:0}
    .area{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}.mat{color:#475569;font-style:italic;margin-top:2px}
    .none{color:#94a3b8}.goals{font-size:13px;margin:0 0 12px;padding:8px 10px;background:#f8fafc;border-radius:6px}`,
    `<h1>${esc(roomName)}: week of ${esc(weekText(plan.week_start))}</h1>
     <div class="sub">${esc(facilityName || '')}${plan.theme ? ` · Theme: <b>${esc(plan.theme)}</b>` : ''}</div>
     ${plan.goals ? `<div class="goals"><b>This week's goals:</b><br>${nl(plan.goals)}</div>` : ''}
     <table><tr>${DAYS.map(d => `<th>${d.label}<br><span style="font-weight:400">${esc(dayDate(plan.week_start, d.n))}</span></th>`).join('')}</tr><tr>${cols}</tr></table>`);
}

export function printReportCard(card, child, facilityName, roomName) {
  const shown = (card.skills || []).filter(s => s.level);
  const sections = byDomain(shown).map(d => {
    const comment = card.comments?.[d.id];
    return `<h2>${esc(d.label)}</h2><table><tr><th class="skill">Skill</th>${LEVELS.map(l => `<th>${esc(l.label)}</th>`).join('')}</tr>
      ${d.items.map(s => `<tr><td class="skill">${esc(s.name)}</td>${LEVELS.map(l => `<td class="dot">${s.level === l.id ? '●' : ''}</td>`).join('')}</tr>`).join('')}
      </table>${comment ? `<p class="cmt">${nl(comment)}</p>` : ''}`;
  }).join('');
  const notes = (card.notes || []).map(n => `<div class="note"><b>Note ${esc(new Date(n.at).toLocaleDateString())}${n.by_name ? ` from ${esc(n.by_name)}` : ''}:</b> ${esc(n.text)}</div>`).join('');
  printWindow(`Report card: ${childName(child)}`, `
    h2{font-size:15px;margin:18px 0 6px;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;padding:5px;border:1px solid #cbd5e1;font-size:11px}
    td{border:1px solid #e2e8f0;padding:5px}td.dot{text-align:center;width:74px;font-size:14px;color:#0f766e}.skill{text-align:left}
    .cmt{font-size:12px;margin:6px 0 0;padding:6px 8px;background:#f8fafc;border-left:3px solid #94a3b8}
    .box{margin-top:16px;font-size:13px}.box b{display:block;margin-bottom:2px}
    .note{margin-top:10px;padding:8px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px}
    .sig{margin-top:22px;font-size:12px;color:#475569}`,
    `<h1>${esc(childName(child))}: ${esc(card.period)}</h1>
     <div class="sub">${esc(facilityName || '')}${roomName ? ` · ${esc(roomName)}` : ''}${card.period_start && card.period_end ? ` · ${esc(fmtDate(card.period_start))} – ${esc(fmtDate(card.period_end))}` : ''}${card.created_by_name ? ` · Teacher: ${esc(card.created_by_name)}` : ''}</div>
     ${sections || '<p>No skills assessed on this report card.</p>'}
     ${card.summary ? `<div class="box"><b>Strengths and highlights</b>${nl(card.summary)}</div>` : ''}
     ${card.next_steps ? `<div class="box"><b>Next steps</b>${nl(card.next_steps)}</div>` : ''}
     ${notes}
     <div class="sig">${card.parent_seen_at
       ? `Read by ${esc(card.parent_seen_name)} on ${esc(new Date(card.parent_seen_at).toLocaleDateString())}${card.parent_comment ? `<br>Parent comment: ${esc(card.parent_comment)}` : ''}`
       : 'Parent signature: ______________________________ &nbsp; Date: ____________'}</div>`);
}
