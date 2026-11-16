// Starting point for every sitter's care agreement. Text in [square brackets] is a blank
// the sitter fills in; the app warns before sending while any remain.
// Body format: blank-line-separated paragraphs; lines starting with "- " are bullets.

export const DEFAULT_TITLE = 'Childcare Agreement & Family Policies';

export const DEFAULT_SECTIONS = [
  {
    title: 'Hours, Attendance & Communication',
    body: `Regular hours: [Monday through Friday], [7:00 a.m.] to [5:30 p.m.], unless a different written schedule is agreed upon for the child.

- Communication is essential. If your child will be absent, late, or picked up by someone different, notify the provider as early as possible, preferably before the start of the day.
- Please share schedule changes or planned absences ahead of time so activities, outings, and meals can be adjusted.
- Parents must keep phone numbers, emergency contacts, and pickup permissions current in littleloop.
- Field trips or off-site activities may occur. The provider will share plans and any permission requirements in advance.`,
  },
  {
    title: 'Tuition & Payment',
    body: `- Tuition is due every [Friday] by [5:30 p.m.] for the upcoming care period, unless a different written arrangement is made.
- Tuition reserves the child's space, not only the days the child attends. Regular tuition remains due for absences, holidays, and days the family chooses not to use care, except where this agreement says otherwise.
- [Optional: late payment fee, or delete this line]
- Unpaid tuition or fees must be brought current promptly. Repeated late or missed payments may result in termination of care after written notice, subject to applicable law.

The agreed rate, schedule, and payment method for your family are listed at the top of this agreement.`,
  },
  {
    title: 'Late Pickup',
    body: `- Children must be picked up by the agreed pickup time and no later than [5:30 p.m.] unless the provider has agreed in writing to a different time.
- After a [5]-minute grace period, late pickups incur a fee of [$1.00 per minute], unless a different written arrangement applies.
- Parents must call or message as soon as they know they may be late. Late-pickup fees are separate from regular tuition.
- If a child remains uncollected and the provider cannot reach the parents/guardians or approved emergency contacts, the provider may contact appropriate authorities or emergency services as necessary to ensure the child's safety.`,
  },
  {
    title: 'Paid Holidays & Planned Closures',
    body: `The following holidays are planned paid closures. Regular tuition remains due because the child's space is reserved:

- [New Year's Day]
- [Good Friday]
- [Memorial Day]
- [Fourth of July]
- [Labor Day]
- [Thanksgiving Day]
- [Black Friday]
- [Christmas Eve]
- [Christmas Day]

If a holiday falls on a weekend, the provider will communicate the observed closure date in advance. Additional closures may be announced as needed.`,
  },
  {
    title: 'Provider Illness, Personal Days & Vacation',
    body: `The provider may need to close for illness, personal days, vacation, or other unavoidable circumstances. As much notice as reasonably possible will be provided.

- For planned provider vacation or personal closures, the provider will aim to give at least [two weeks'] notice.
- For a planned provider closure announced with at least [two weeks'] notice, [half] tuition will be charged for the affected period. For shorter-notice closures, the provider will communicate the tuition arrangement as soon as possible.
- If the provider becomes ill unexpectedly or an emergency prevents care, families will be notified promptly. Any tuition adjustment will be communicated in writing.

Parents acknowledge that childcare may be unavailable during provider illness or planned leave and agree to maintain a backup-care plan.`,
  },
  {
    title: 'Family Vacations & Child Absences',
    body: `- Parents should provide at least [two weeks'] notice of planned family vacations or extended absences.
- With at least [two weeks'] notice, [half] tuition is due for the reserved space during the family vacation.
- If that notice is not provided, full tuition remains due. Any exception must be agreed to in writing by the provider.
- For absences that are not planned family vacations, regular tuition remains due because the child's spot is being held.`,
  },
  {
    title: 'Illness, Contagious Conditions & Antibiotics',
    body: `To protect all children and families, children must stay home when they may be contagious or are unable to comfortably participate in normal activities. Parents must tell the provider about known exposures, diagnoses, symptoms, or changes in health.

- A child may be sent home for a fever of [100.4°F] or higher, vomiting, diarrhea, an unexplained or spreading rash, suspected or confirmed pink eye, significant cough or breathing symptoms, unusual lethargy, or other symptoms that make group care unsafe.
- If the provider requests pickup because a child is ill, the child must be picked up within [one hour] of notification.
- Children may return when they meet the provider's illness-return requirements and any applicable public-health guidance. Depending on the illness, this may include being fever-free for at least [24 hours] without fever-reducing medicine, no vomiting or diarrhea for the required period, and/or written medical clearance.
- For conditions requiring antibiotics, the child must have received antibiotics for at least [24 hours] before returning, and must otherwise be well enough to participate.
- If there is an outbreak or a suspected or confirmed case of a highly contagious illness (such as hand, foot, and mouth disease), the provider may close for deep cleaning. Families will be notified of closure and reopening plans.
- The provider may require pickup or temporary exclusion for highly contagious illnesses, including but not limited to flu, COVID-19, RSV, strep throat, chickenpox, and impetigo.

These policies are intended to reduce spread and do not replace medical advice. Parents should seek care from a qualified healthcare professional when needed.`,
  },
  {
    title: 'Snow Days, Severe Weather & Emergencies',
    body: `- Care will close on the first day [local public schools] announce a weather-related closure. The provider will assess conditions after that and communicate whether and when care will reopen.
- The provider may close or delay opening due to unsafe roads, snow or ice, severe storms, tornado warnings, extreme conditions, or other safety concerns.
- If power is lost or the home becomes unsafe, parents must promptly pick up their children.
- In a tornado or when sheltering is necessary, the designated shelter location is [shelter location], provided it is accessible and safe to reach. Otherwise the provider will use the safest available shelter and contact emergency services when appropriate.
- The provider will notify parents as soon as reasonably possible during an emergency. Parents must keep their phones available and respond promptly.

Emergency reunification / contact instructions: [where and how families reunite with children in an emergency]`,
  },
  {
    title: 'Power Loss, Natural Disasters & Unavoidable Closures',
    body: `If electricity, water, heating/cooling, or another essential service fails, or if the premises are unsafe, care may stop immediately and children must be picked up as directed. No refund will be given for closures caused by weather or circumstances beyond the provider's control, including power loss, severe storms, snowstorms, flooding, or tornadoes. The provider will prioritize children's safety and communicate instructions as soon as possible.`,
  },
  {
    title: 'Withdrawal & Termination of Care',
    body: `- A parent/guardian who chooses to end care must give at least [one full month] of written notice.
- Tuition remains due throughout the notice period because the child's space is being held, whether or not the child attends.
- If the required notice is not provided, the parent/guardian agrees to pay the tuition that would have been due for the remainder of the notice period, to the extent permitted by applicable law.
- The provider may terminate care for repeated late payments, repeated late pickups, failure to follow health and safety policies, inaccurate or withheld information, or other serious concerns. When feasible, the provider will give written notice; immediate termination may be necessary for safety or serious circumstances.

Notice may be sent by littleloop message, text, email, or written letter to the provider.`,
  },
  {
    title: 'Safety, Permissions & Acknowledgments',
    body: `- Parents authorize the provider to contact emergency services and seek urgent medical care if the provider reasonably believes it is necessary and the parent/guardian cannot be reached promptly. Parents are responsible for medical costs not covered by insurance.
- A child will be released only to a parent/guardian or a person on the family's approved pickup list. The provider may request photo identification before releasing a child. A person who appears impaired or otherwise unable to safely transport the child may not be permitted to leave with the child; emergency contacts or emergency services may be contacted when necessary.
- Medications must be in the original labeled container with written instructions and any required authorization. The provider may decline to give medication if instructions, labeling, authorization, or safe storage are inadequate.
- Parents agree to provide accurate information and promptly update any change in the child's health, allergies, medications, emergency contacts, authorized pickups, or custody restrictions.
- This agreement describes the provider's policies but does not waive any rights or obligations that cannot legally be waived. The provider and family will follow applicable [Missouri] law and public-health requirements.
- This agreement and any written amendments reflect the agreement between the provider and parent/guardian. Changes will be sent as a new version and acknowledged by both parties.`,
  },
];

export const ACKNOWLEDGMENT =
  'I have read and understand the childcare policies in this agreement. I have had the opportunity to ask questions, and I agree to follow these policies and communicate promptly with the provider.';

export const LEGAL_NOTE =
  'This is a general childcare agreement template, not legal advice. Because childcare licensing and fee rules depend on your arrangement and local requirements, consider having it reviewed before using it.';

export const newSectionId = () => Math.random().toString(36).slice(2, 10);

export function defaultSections() {
  return DEFAULT_SECTIONS.map(s => ({ id: newSectionId(), ...s }));
}

// Blanks still left in the text, e.g. "[shelter location]".
export function findBlanks(sections = []) {
  const out = [];
  for (const s of sections) {
    for (const m of `${s.title}\n${s.body}`.matchAll(/\[([^\]]{1,80})\]/g)) out.push({ section: s.title, text: m[1] });
  }
  return out;
}
