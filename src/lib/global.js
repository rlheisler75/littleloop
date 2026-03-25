export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:var(--body-bg,#0C1420);color:var(--text,#E4EAF4);min-height:100vh;overflow-x:hidden}
  input,button,textarea,select{font-family:'DM Sans',sans-serif}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes floatLeaf{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
  @keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.05)}66%{transform:translate(-20px,15px) scale(.97)}}
  @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-25px,20px) scale(1.08)}}
  @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  .fade-up{animation:fadeUp .55s cubic-bezier(.22,1,.36,1) both}
  .slide-in{animation:slideIn .35s cubic-bezier(.22,1,.36,1) both}
  .d1{animation-delay:.05s}.d2{animation-delay:.10s}.d3{animation-delay:.15s}.d4{animation-delay:.20s}.d5{animation-delay:.25s}.d6{animation-delay:.30s}
  .leaf{animation:floatLeaf 5s ease-in-out infinite;display:inline-block}
  .spin{animation:spin .65s linear infinite}
  .logo-text{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:700;letter-spacing:-1px;background:var(--logo-grad,linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 5s linear infinite}
  .card{background:var(--card-bg,rgba(255,255,255,.035));border:1px solid var(--border,rgba(255,255,255,.07));border-radius:18px;backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.06)}
  .nav-tab{flex:1;padding:11px 0;text-align:center;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-faint,rgba(255,255,255,.3));border-bottom:2px solid transparent;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:3px}
  .nav-tab:hover{color:var(--text-dim,rgba(255,255,255,.6))}.nav-tab.active{color:var(--accent,#7BAAEE);border-bottom-color:var(--accent,#7BAAEE)}
  .tab{flex:1;padding:9px 0;text-align:center;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-faint,rgba(255,255,255,.3));border-bottom:2px solid transparent;transition:all .2s}
  .tab:hover{color:var(--text-dim,rgba(255,255,255,.5))}.tab.active{color:var(--accent,#7BAAEE);border-bottom-color:var(--accent,#7BAAEE)}
  .fl{display:block;font-size:10px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;color:var(--text-faint,rgba(255,255,255,.3));margin-bottom:7px}
  .fi{width:100%;padding:11px 14px;background:var(--input-bg,rgba(255,255,255,.04));border:1px solid var(--input-border,rgba(255,255,255,.09));border-radius:10px;color:var(--text,#E4EAF4);font-size:13px;outline:none;transition:all .2s;margin-bottom:14px}
  .fi::placeholder{color:var(--text-faint,rgba(255,255,255,.2))}.fi:focus{border-color:rgba(111,163,232,.45);background:rgba(111,163,232,.06);box-shadow:0 0 0 3px rgba(111,163,232,.1)}
  select.fi option{background:var(--body,#0C1420);color:var(--text,#E4EAF4)}
  .bp{padding:11px 20px;background:var(--accent-grad,linear-gradient(135deg,#3A6FD4,#2550A8));border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
  .bp:hover:not(:disabled){background:linear-gradient(135deg,#4A7FE4,#3560B8);transform:translateY(-1px);box-shadow:0 6px 20px rgba(58,111,212,.3)}.bp:disabled{opacity:.5;cursor:not-allowed}.bp.full{width:100%;justify-content:center}
  .bg{padding:9px 16px;background:transparent;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;color:var(--text-dim,rgba(255,255,255,.5));font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bg:hover{border-color:var(--text-dim);color:var(--text)}
  .bd{padding:8px 14px;background:rgba(192,80,80,.12);border:1px solid rgba(192,80,80,.25);border-radius:9px;color:#F5AAAA;font-size:12px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bd:hover{background:rgba(192,80,80,.22)}
  .al{border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.55;margin-bottom:16px}
  .al-e{background:rgba(192,80,80,.1);border:1px solid rgba(192,80,80,.25);color:#F5AAAA}
  .al-s{background:rgba(58,158,122,.1);border:1px solid rgba(58,158,122,.25);color:#88D8B8}
  .al-i{background:rgba(58,111,212,.1);border:1px solid rgba(58,111,212,.25);color:#A8CCFF}
  .al-w{background:rgba(200,150,50,.1);border:1px solid rgba(200,150,50,.25);color:#F5D08A}
  .fc{padding:14px 16px;border-radius:14px;background:var(--input-bg,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.07));transition:all .2s;cursor:pointer}
  .fc:hover{background:var(--card-bg);border-color:rgba(111,163,232,.25)}.fc.active{background:rgba(111,163,232,.08);border-color:rgba(111,163,232,.35)}
  .sb{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600}
  .sb-a{background:rgba(58,158,122,.15);color:#88D8B8;border:1px solid rgba(58,158,122,.25)}
  .sb-p{background:rgba(200,120,74,.15);color:#F5C098;border:1px solid rgba(200,120,74,.25)}
  .sb-i{background:rgba(120,120,140,.15);color:#B0B8C8;border:1px solid rgba(120,120,140,.25)}
  .mo{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
  .mb{background:var(--nav-bg,#111D2E);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 40px 80px rgba(0,0,0,.4)}
  .es{text-align:center;padding:48px 20px}
  .es .ic{font-size:40px;margin-bottom:14px;opacity:.4}
  .es h3{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:8px;opacity:.7}
  .es p{font-size:12px;color:var(--text-faint,rgba(255,255,255,.3));line-height:1.6;margin-bottom:20px}
  .note-card{padding:12px 14px;border-radius:12px;background:var(--input-bg,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.07));margin-bottom:8px}
  .chip{display:inline-flex;align-items:center;gap:6px;background:var(--input-bg,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:20px;padding:5px 11px;font-size:12px;color:var(--text,#E4EAF4)}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}

  @media(max-width:600px){
    .mb{padding:20px 16px;max-height:95vh;border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;right:0;width:100%;max-width:100%}
    .mo{align-items:flex-end;padding:0}
    .two-col{grid-template-columns:1fr!important}
    .hide-mobile{display:none!important}
    .nav-tab{font-size:11px}
    .logo-text{font-size:16px!important}
    .bp{font-size:12px;padding:9px 14px}
  }
`;
