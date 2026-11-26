export const ROLE_LABELS = {
  admin:     'Admin',
  member:    'Member',
  feed_only: 'Feed Only',
  pickup:    'Pickup',
};

export const AVATARS = [
  '👤',
  // Light skin
  '👩🏻','👨🏻','👧🏻','👦🏻','🧑🏻','👵🏻','👴🏻',
  // Medium-light skin
  '👩🏼','👨🏼','👧🏼','👦🏼','🧑🏼','👵🏼','👴🏼',
  // Medium skin
  '👩🏽','👨🏽','👧🏽','👦🏽','🧑🏽','👵🏽','👴🏽',
  // Medium-dark skin
  '👩🏾','👨🏾','👧🏾','👦🏾','🧑🏾','👵🏾','👴🏾',
  // Dark skin
  '👩🏿','👨🏿','👧🏿','👦🏿','🧑🏿','👵🏿','👴🏿',
  // Hair styles
  '👩‍🦱','👨‍🦱','👩‍🦰','👨‍🦰','👩‍🦳','👨‍🦳','🧔','🧔‍♀️',
];

export const CHILD_AVATARS = [
  '🐻','🦁','🐯','🦊','🐼','🐸','🐶','🐱','🐰','🐨','🐮','🐷',
  '🦕','🦖','🐉','🐲',
  '🦄','🚀','🌈','⭐','🌟','🎈','🦋','🌺','🌸','🍀',
];

export const SITTER_AVATARS = ['➿','🌻','🌸','🦋','🌙','⭐','🌈','🎨','🎵','🌊','🍀','🦄'];

export const FAMILY_ICONS = [
  '👨‍👩‍👧','👨‍👩‍👦','👨‍👩‍👧‍👦','👨‍👩‍👦‍👦','👨‍👩‍👧‍👧',
  '👩‍👧','👩‍👦','👨‍👧','👨‍👦','👩‍👧‍👦','👩‍👦‍👦','👩‍👧‍👧','👨‍👧‍👦',
  '🏠','🏡','🏰','🏯','🛖','⛺','🏕️',
  '🌻','🌸','🌺','🌹','🌷','🌿','🍀','🌳','🌲','🌴',
  '🐶','🐱','🐻','🦁','🐼','🦊','🐰','🦋','🐝','🦜',
  '⭐','🌟','✨','🌙','☀️','🌈','❄️','🔥',
  '❤️','💜','💙','💚','💛','🧡','🎈','🎀','🎁',
];

export const POST_TYPES = [
  { id:'activity',  icon:'🎨', label:'Activity' },
  { id:'meal',      icon:'🍎', label:'Meal' },
  { id:'nap',       icon:'😴', label:'Nap' },
  { id:'milestone', icon:'⭐', label:'Milestone' },
  { id:'note',      icon:'📝', label:'Note' },
  { id:'photo',     icon:'📸', label:'Photo' },
];

export const POST_MOODS = [
  { id:'happy',   icon:'😄' },
  { id:'content', icon:'😊' },
  { id:'proud',   icon:'🥰' },
  { id:'excited', icon:'🤩' },
  { id:'tired',   icon:'😴' },
  { id:'fussy',   icon:'😣' },
  { id:'rested',  icon:'😌' },
  { id:'curious', icon:'🧐' },
];

export const PAYMENT_TYPES = [
  // Venmo pre-fills recipient, amount and note from query params on the root URL (the old
  // venmo://paycharge scheme and venmo.com/<user> no longer carry the amount over). On phones
  // this https link opens the Venmo app.
  { id:'venmo',    label:'Venmo',         icon:'💜', placeholder:'@username', brand:'#008CFF',
    deeplink:(h,a,n)=>`https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(h.replace(/^@/,''))}&amount=${a}&note=${encodeURIComponent(n)}`,
    weblink:(h,a,n)=>`https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(h.replace(/^@/,''))}&amount=${a}&note=${encodeURIComponent(n)}` },
  { id:'paypal',   label:'PayPal',        icon:'💙', placeholder:'username', brand:'#0070E0',                   deeplink:(h,a)=>`https://paypal.me/${h}/${a}` },
  { id:'zelle',    label:'Zelle',         icon:'💛', placeholder:'email or phone',             deeplink:null },
  { id:'cashapp',  label:'Cash App',      icon:'💚', placeholder:'$cashtag', brand:'#00A63E',                   deeplink:(h,a)=>`https://cash.app/${h.replace('$','')}/${a}`, weblink:(h,a)=>`https://cash.app/${h.replace('$','')}/${a}` },
  { id:'cash',     label:'Cash',          icon:'💵', placeholder:'(no handle needed)',         deeplink:null },
  { id:'check',    label:'Check',         icon:'📝', placeholder:'(no handle needed)',         deeplink:null },
  { id:'transfer', label:'Bank Transfer', icon:'🏦', placeholder:'routing/account or instructions', deeplink:null },
];

export const ETA_OPTIONS = [
  { label:'5 min',  minutes:5  },
  { label:'10 min', minutes:10 },
  { label:'30 min', minutes:30 },
  { label:'45 min', minutes:45 },
  { label:'1 hour', minutes:60 },
];

export const DAYS      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const AVAIL_DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const AVAIL_TIMES = [
  { id:'early_morning', label:'Early Morning', sub:'6–9am'     },
  { id:'morning',       label:'Morning',       sub:'9am–12pm'  },
  { id:'afternoon',     label:'Afternoon',     sub:'12–5pm'    },
  { id:'evening',       label:'Evening',       sub:'5–9pm'     },
  { id:'overnight',     label:'Overnight',     sub:'9pm+'      },
];

export const EMAIL_PREFS_SITTER = [
  { key:'new_message', label:'New messages',        icon:'💬' },
  { key:'new_post',    label:'Family feed activity', icon:'📝' },
];

export const EMAIL_PREFS_PARENT = [
  { key:'new_message',       label:'New messages',          icon:'💬' },
  { key:'new_invoice',       label:'New invoices',          icon:'💰' },
  { key:'invoice_reminder',  label:'Invoice reminders',     icon:'🔔' },
  { key:'new_post',          label:'Feed updates',          icon:'📝' },
  { key:'eta',               label:'On My Way / ETA alerts', icon:'🚗' },
];

export const PUSH_PREFS_SITTER = [
  { key:'new_message', label:'New messages',        icon:'💬' },
  { key:'new_post',    label:'Family feed activity', icon:'📝' },
];

export const PUSH_PREFS_PARENT = [
  { key:'new_message',      label:'New messages',      icon:'💬' },
  { key:'new_invoice',      label:'New invoices',      icon:'💰' },
  { key:'invoice_reminder', label:'Invoice reminders', icon:'🔔' },
  { key:'new_post',         label:'Feed updates',      icon:'📝' },
  { key:'field_trip',       label:'Field trips',       icon:'📍' },
  { key:'daycare_report',   label:'Daycare daily reports', icon:'📒' },
  { key:'daycare_incident', label:'Daycare incident reports', icon:'🩹' },
  { key:'daycare_report_card', label:'Daycare report cards', icon:'🎓' },
  { key:'daycare_billing',  label:'Daycare bills',            icon:'🧾' },
];

export const PUSH_PREFS_SITTER_FULL = [
  { key:'new_message', label:'New messages',          icon:'💬' },
  { key:'new_post',    label:'Family feed activity',  icon:'📝' },
  { key:'eta',         label:'On My Way / ETA alerts', icon:'🚗' },
];

// Diet options on a child's profile (children.diet_types). Free text goes in dietary_restrictions.
export const DIET_TYPES = [
  'Vegetarian', 'Vegan', 'Dairy-free', 'Gluten-free', 'Nut-free', 'Egg-free',
  'No pork', 'No beef', 'Halal', 'Kosher',
];
