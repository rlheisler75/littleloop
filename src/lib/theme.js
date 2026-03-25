export const PALETTES = [
  // DARK
  { id:'midnight',  name:'Midnight',  dark:true,  body:'#0C1420', orb1:'rgba(30,70,140,.35)',  orb2:'rgba(20,90,80,.25)',  card:'rgba(255,255,255,.035)', accent:'#3A6FD4', accentGrad:'linear-gradient(135deg,#3A6FD4,#2550A8)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8)' },
  { id:'forest',    name:'Forest',    dark:true,  body:'#0A1610', orb1:'rgba(20,90,40,.35)',   orb2:'rgba(10,70,60,.25)',  card:'rgba(255,255,255,.035)', accent:'#3A9E5A', accentGrad:'linear-gradient(135deg,#3A9E5A,#1E6B3A)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#6FB87A,#A8D4AE,#E2F4E8,#A8D4AE,#6FB87A)' },
  { id:'amethyst',  name:'Amethyst',  dark:true,  body:'#120E20', orb1:'rgba(80,30,140,.35)',  orb2:'rgba(60,20,100,.25)', card:'rgba(255,255,255,.035)', accent:'#7B4FD4', accentGrad:'linear-gradient(135deg,#7B4FD4,#5530A8)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#B07BE8,#CFA8FF,#EEE2FF,#CFA8FF,#B07BE8)' },
  { id:'ember',     name:'Ember',     dark:true,  body:'#1A0E08', orb1:'rgba(140,60,20,.35)',  orb2:'rgba(100,30,10,.25)', card:'rgba(255,255,255,.035)', accent:'#D46A3A', accentGrad:'linear-gradient(135deg,#D46A3A,#A84520)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#E8956F,#FFBFA8,#FFE8E2,#FFBFA8,#E8956F)' },
  { id:'arctic',    name:'Arctic',    dark:true,  body:'#091520', orb1:'rgba(20,100,160,.35)', orb2:'rgba(10,70,120,.25)', card:'rgba(255,255,255,.035)', accent:'#2AA8D4', accentGrad:'linear-gradient(135deg,#2AA8D4,#1580A8)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#6FD4E8,#A8E8FF,#E2F8FF,#A8E8FF,#6FD4E8)' },
  { id:'obsidian',  name:'Obsidian',  dark:true,  body:'#0A0A0A', orb1:'rgba(60,60,60,.35)',   orb2:'rgba(40,40,40,.25)',  card:'rgba(255,255,255,.035)', accent:'#8A8A9A', accentGrad:'linear-gradient(135deg,#8A8A9A,#5A5A6A)', nav:'rgba(0,0,0,.2)',   logo:'linear-gradient(90deg,#C0C0D0,#E0E0F0,#FFFFFF,#E0E0F0,#C0C0D0)' },
  // LIGHT
  { id:'cloud',     name:'Cloud',     dark:false, body:'#F0F4FA', orb1:'rgba(100,140,220,.2)', orb2:'rgba(80,160,140,.15)', card:'rgba(255,255,255,.8)',  accent:'#3A6FD4', accentGrad:'linear-gradient(135deg,#3A6FD4,#2550A8)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#3A6FD4,#2550A8,#3A6FD4)' },
  { id:'mint',      name:'Mint',      dark:false, body:'#EFF8F4', orb1:'rgba(80,180,120,.2)',  orb2:'rgba(60,140,100,.15)', card:'rgba(255,255,255,.8)',  accent:'#2A8A5A', accentGrad:'linear-gradient(135deg,#2A8A5A,#1A6040)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#2A8A5A,#1A6040,#2A8A5A)' },
  { id:'lavender',  name:'Lavender',  dark:false, body:'#F4F0FB', orb1:'rgba(140,100,220,.2)', orb2:'rgba(100,80,180,.15)', card:'rgba(255,255,255,.8)',  accent:'#7040C8', accentGrad:'linear-gradient(135deg,#7040C8,#5020A0)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#7040C8,#5020A0,#7040C8)' },
  { id:'peach',     name:'Peach',     dark:false, body:'#FBF2EE', orb1:'rgba(220,120,80,.2)',  orb2:'rgba(180,80,50,.15)',  card:'rgba(255,255,255,.8)',  accent:'#C85030', accentGrad:'linear-gradient(135deg,#C85030,#A03010)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#C85030,#A03010,#C85030)' },
  { id:'sky',       name:'Sky',       dark:false, body:'#EEF6FB', orb1:'rgba(80,160,220,.2)',  orb2:'rgba(60,120,180,.15)', card:'rgba(255,255,255,.8)',  accent:'#1888C8', accentGrad:'linear-gradient(135deg,#1888C8,#0060A0)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#1888C8,#0060A0,#1888C8)' },
  { id:'sand',      name:'Sand',      dark:false, body:'#FAF7F0', orb1:'rgba(180,150,80,.2)',  orb2:'rgba(140,110,60,.15)', card:'rgba(255,255,255,.8)',  accent:'#8A6020', accentGrad:'linear-gradient(135deg,#8A6020,#604010)', nav:'rgba(255,255,255,.7)', logo:'linear-gradient(90deg,#8A6020,#604010,#8A6020)' },
];

export function getPalette(id) {
  return PALETTES.find(p => p.id === id) || PALETTES[0];
}

export function applyTheme(palette) {
  const p = typeof palette === 'string' ? getPalette(palette) : palette;
  const root = document.documentElement;
  root.style.setProperty('--body-bg',    p.body);
  root.style.setProperty('--card-bg',    p.card);
  root.style.setProperty('--accent',     p.accent);
  root.style.setProperty('--accent-grad',p.accentGrad);
  root.style.setProperty('--nav-bg',     p.nav);
  root.style.setProperty('--orb1',       p.orb1);
  root.style.setProperty('--orb2',       p.orb2);
  root.style.setProperty('--logo-grad',  p.logo);
  if (!p.dark) {
    root.style.setProperty('--text',         '#14243A');
    root.style.setProperty('--text-dim',     'rgba(20,36,58,.5)');
    root.style.setProperty('--text-faint',   'rgba(20,36,58,.3)');
    root.style.setProperty('--border',       'rgba(20,36,58,.1)');
    root.style.setProperty('--input-bg',     'rgba(20,36,58,.04)');
    root.style.setProperty('--input-border', 'rgba(20,36,58,.12)');
    root.style.setProperty('--dot-color',    'rgba(20,36,58,.06)');
  } else {
    root.style.setProperty('--text',         '#E4EAF4');
    root.style.setProperty('--text-dim',     'rgba(255,255,255,.5)');
    root.style.setProperty('--text-faint',   'rgba(255,255,255,.3)');
    root.style.setProperty('--border',       'rgba(255,255,255,.07)');
    root.style.setProperty('--input-bg',     'rgba(255,255,255,.04)');
    root.style.setProperty('--input-border', 'rgba(255,255,255,.09)');
    root.style.setProperty('--dot-color',    'rgba(255,255,255,.05)');
  }
  document.body.style.background = p.body;
  document.body.style.color = p.dark ? '#E4EAF4' : '#14243A';
}

// Apply saved theme immediately on import
applyTheme(localStorage.getItem('ll_theme') || 'midnight');
