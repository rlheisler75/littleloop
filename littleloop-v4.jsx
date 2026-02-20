import { useState, useRef, useEffect } from "react";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:"#EFF4FB", card:"#FFFFFF", border:"#D8E4F4",
  accent:"#3A6FD4", accentDim:"#2A52A8",
  green:"#3A9E7A", greenDim:"#2A7258",
  text:"#14243A", muted:"#7A90AA", soft:"#A8BCCC",
  white:"#FFF", red:"#C05050",
  sky:"#EBF3FF", skyBorder:"#BDD4F4",
};
const P = {
  bg:"#F8F4EF", card:"#FFFFFF", border:"#EAE0D4",
  accent:"#C8784A", violet:"#5A3F9E", violetDim:"#3B2A6E",
  teal:"#4E9E8A", text:"#2A1F14", muted:"#9A8878", soft:"#C4B4A4",
  white:"#FFF", red:"#B85050", lavender:"#EDE8FF",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=swap');`;
const GS = `
  ${FONTS}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif}
  input,textarea,select{font-family:'Outfit',sans-serif}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:#88886655;border-radius:4px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
  @keyframes notifIn{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}
  @keyframes notifOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(110%)}}
  .fade-in{animation:fadeIn 0.3s ease both}
  .pop-in{animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both}
`;

// ─── Role System ───────────────────────────────────────────────────────────────
const ROLES = {
  admin:     { label:"Admin",        color:"#3A6FD4", icon:"👑", desc:"Full access. Can manage family members." },
  member:    { label:"Member",       color:"#3A9E7A", icon:"👤", desc:"View feed, send messages, check in/out." },
  feed_only: { label:"Feed Only",    color:"#8B9FD4", icon:"👁️",  desc:"View feed and receive notifications only." },
  pickup:    { label:"Pickup Person",color:"#D48B6A", icon:"🚗", desc:"Check in/out only. No feed or messages." },
};

// Permissions per role
const CAN = {
  viewFeed:    r => ["admin","member","feed_only"].includes(r),
  sendMessage: r => ["admin","member"].includes(r),
  checkInOut:  r => ["admin","member","pickup"].includes(r),
  manageMembers: r => r === "admin",
};

// ─── Seed Data ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,9);
const NOW = Date.now();

const INIT = {
  families: {
    f1: { id:"f1", name:"Chen Family",  status:"active",  adminEmail:"sarah@chen.com" },
    f2: { id:"f2", name:"Ruiz Family",  status:"active",  adminEmail:"elena@ruiz.com" },
    f3: { id:"f3", name:"Park Family",  status:"pending", adminEmail:"james@park.com" },
  },
  members: {
    // Chen family — multiple members with different roles
    m1: { id:"m1", familyId:"f1", name:"Sarah Chen",   email:"sarah@chen.com",   avatar:"👩",   role:"admin",     status:"active" },
    m2: { id:"m2", familyId:"f1", name:"David Chen",   email:"david@chen.com",   avatar:"👨",   role:"member",    status:"active" },
    m3: { id:"m3", familyId:"f1", name:"Grandma Sue",  email:"sue@chen.com",     avatar:"👵",   role:"feed_only", status:"active" },
    m4: { id:"m4", familyId:"f1", name:"Uncle Ray",    email:"ray@chen.com",     avatar:"🧔",   role:"pickup",    status:"active" },
    // Ruiz family
    m5: { id:"m5", familyId:"f2", name:"Elena Ruiz",   email:"elena@ruiz.com",   avatar:"👩‍🦱", role:"admin",     status:"active" },
    m6: { id:"m6", familyId:"f2", name:"Carlos Ruiz",  email:"carlos@ruiz.com",  avatar:"👨‍🦱", role:"member",    status:"active" },
    // Park family — pending
    m7: { id:"m7", familyId:"f3", name:"James Park",   email:"james@park.com",   avatar:"👨",   role:"admin",     status:"pending" },
  },
  children: {
    ch1: { id:"ch1", familyId:"f1", name:"Lily",  age:4, avatar:"🌸", color:"#C8A96E",
      dob:"2021-03-14", photo:null,
      allergies:["Peanuts","Tree nuts"],
      medications:[{ name:"EpiPen", dose:"0.15mg", instructions:"Use if anaphylaxis suspected, call 911 immediately" }],
      medicalNotes:"Has a peanut allergy — always check labels. Carries an EpiPen in her backpack.",
      dietaryRestrictions:"No peanuts or tree nuts under any circumstances.",
      emergencyContacts:[{ name:"Grandma Sue", relation:"Grandmother", phone:"555-010-1234" }],
      behavioralNotes:"Responds well to gentle redirection. Needs a 5-minute warning before transitions.",
      lastUpdated:"2026-02-10",
    },
    ch2: { id:"ch2", familyId:"f1", name:"Owen",  age:2, avatar:"🐻", color:"#6AAF7B",
      dob:"2023-09-01", photo:null,
      allergies:["Dairy"],
      medications:[],
      medicalNotes:"Lactose intolerant. Oat milk only please.",
      dietaryRestrictions:"No dairy — oat milk provided in his bag.",
      emergencyContacts:[],
      behavioralNotes:"Still napping twice a day. Gets fussy if nap is skipped.",
      lastUpdated:"2026-01-28",
    },
    ch3: { id:"ch3", familyId:"f2", name:"Marco", age:6, avatar:"🦁", color:"#D96B6B",
      dob:"2019-06-22", photo:null,
      allergies:[],
      medications:[],
      medicalNotes:"No known allergies or medical conditions.",
      dietaryRestrictions:"None.",
      emergencyContacts:[{ name:"Uncle Pedro", relation:"Uncle", phone:"555-020-5678" }],
      behavioralNotes:"Very energetic. Loves dinosaurs — great topic for redirection.",
      lastUpdated:"2026-02-01",
    },
    ch4: { id:"ch4", familyId:"f3", name:"Zoe",   age:3, avatar:"🌙", color:"#8B78D4",
      dob:"2022-11-05", photo:null,
      allergies:[],
      medications:[],
      medicalNotes:"",
      dietaryRestrictions:"",
      emergencyContacts:[],
      behavioralNotes:"",
      lastUpdated:"2026-02-17",
    },
  },
  posts: {
    p1: { id:"p1", familyId:"f1", childIds:["ch1"],       authorRole:"sitter", type:"activity",  text:"Lily finished her first 48-piece puzzle today! Beaming with pride 🧩", photo:null, timestamp:NOW-7200000, likes:{}, mood:"proud",   pinned:true  },
    p2: { id:"p2", familyId:"f1", childIds:["ch1","ch2"], authorRole:"sitter", type:"meal",      text:"Both kids had great lunch. Owen tried avocado for the first time and loved it! 🥑", photo:null, timestamp:NOW-5400000, likes:{m1:true}, mood:"happy",   pinned:false },
    p3: { id:"p3", familyId:"f2", childIds:["ch3"],       authorRole:"sitter", type:"nap",       text:"Marco napped 90 mins, woke up energetic and ready for afternoon play.", photo:null, timestamp:NOW-3600000, likes:{}, mood:"rested",  pinned:false },
  },
  messages: {
    f1: [
      { id:"msg1", from:"m1", fromName:"Sarah",  text:"How are the kids this morning?",           ts:NOW-7000000 },
      { id:"msg2", from:"sitter", fromName:"Maya", text:"Wonderful! Owen just woke up 😊",         ts:NOW-6900000 },
      { id:"msg3", from:"m2", fromName:"David",  text:"What time is pickup today?",               ts:NOW-1800000 },
    ],
    f2: [
      { id:"msg4", from:"m5", fromName:"Elena",  text:"Marco has doctor appt at 4pm!",            ts:NOW-5000000 },
      { id:"msg5", from:"sitter", fromName:"Maya", text:"Got it, will have him ready 👍",          ts:NOW-4900000 },
    ],
    f3: [],
  },
  invoices: [
    { id:"inv1", familyId:"f1", type:"hourly",  hours:12, rate:18, extras:[],                            status:"paid",   dueDate:"2026-02-01", issuedDate:"2026-01-31", note:"Week of Jan 27",
      payments:[{ id:"pay1", amount:216, method:"Venmo", note:"Full payment", date:"2026-02-01" }] },
    { id:"inv2", familyId:"f2", type:"tuition", tuitionPeriod:"weekly", tuitionRate:320, extras:[{label:"Art supplies",amount:8}], status:"partial", dueDate:"2026-02-20", issuedDate:"2026-02-17", note:"Week of Feb 17",
      payments:[{ id:"pay2", amount:150, method:"Cash", note:"First half", date:"2026-02-17" }] },
  ],
  checkins: {
    ch1:{ status:"in",  time:"8:15 AM" },
    ch2:{ status:"in",  time:"8:20 AM" },
    ch3:{ status:"in",  time:"9:00 AM" },
    ch4:{ status:"out", time:"—" },
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = ts => { const m=Math.floor((Date.now()-ts)/60000); if(m<1)return"just now"; if(m<60)return`${m}m ago`; if(m<1440)return`${Math.floor(m/60)}h ago`; return`${Math.floor(m/1440)}d ago`; };
const fmtTime  = ts => new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDate  = d  => new Date(d).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"});
const invoiceTotal   = inv => ((inv.type==="hourly"?inv.hours*inv.rate:Number(inv.tuitionRate)) + (inv.extras||[]).reduce((s,e)=>s+Number(e.amount),0));
const amountPaid     = inv => (inv.payments||[]).reduce((s,p)=>s+Number(p.amount),0);
const amountRemaining= inv => Math.max(0, invoiceTotal(inv)-amountPaid(inv));
const invoiceStatus  = inv => { const tot=invoiceTotal(inv); const paid=amountPaid(inv); if(paid<=0)return"unpaid"; if(paid>=tot)return"paid"; return"partial"; };

// ─── PDF Export ────────────────────────────────────────────────────────────────
function exportInvoicePDF({ invoice, familyName, sitterName="Maya Rodriguez", mode="sitter" }) {
  const tot     = invoiceTotal(invoice);
  const paid    = amountPaid(invoice);
  const rem     = amountRemaining(invoice);
  const status  = invoiceStatus(invoice);
  const pct     = Math.min(100, Math.round((paid/tot)*100));

  const statusColor  = status==="paid"?"#2D7D5A":status==="partial"?"#B07A2A":"#B03A2A";
  const statusLabel  = status==="paid"?"PAID IN FULL":status==="partial"?"PARTIALLY PAID":"UNPAID";

  const breakdownRows = invoice.type==="hourly"
    ? `<tr><td>Childcare services (${invoice.hours} hrs × $${invoice.rate}/hr)</td><td>$${(invoice.hours*invoice.rate).toFixed(2)}</td></tr>`
    : `<tr><td>${invoice.tuitionPeriod.charAt(0).toUpperCase()+invoice.tuitionPeriod.slice(1)} tuition</td><td>$${Number(invoice.tuitionRate).toFixed(2)}</td></tr>`;

  const extrasRows = (invoice.extras||[]).map(e=>`<tr><td>${e.label}</td><td>$${Number(e.amount).toFixed(2)}</td></tr>`).join("");

  const paymentRows = (invoice.payments||[]).length>0
    ? (invoice.payments||[]).map(p=>`
        <tr>
          <td>${fmtDate(p.date)}</td>
          <td>${p.method}</td>
          <td>${p.note||"—"}</td>
          <td style="text-align:right;color:#2D7D5A;font-weight:700">$${Number(p.amount).toFixed(2)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="color:#aaa;font-style:italic">No payments recorded</td></tr>`;

  const progressBar = `
    <div style="margin:14px 0 6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;margin-bottom:5px">
        <span>Paid: <strong style="color:#2D7D5A">$${paid.toFixed(2)}</strong></span>
        <span>Remaining: <strong style="color:#B07A2A">$${rem.toFixed(2)}</strong></span>
      </div>
      <div style="height:8px;background:#eee;border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2D7D5A,#C8A96E);border-radius:99px"></div>
      </div>
      <div style="font-size:10px;color:#999;margin-top:3px">${pct}% paid</div>
    </div>`;

  const fsaNote = mode==="parent" ? `
    <div style="background:#EEF4FF;border:1px solid #B0C8FF;border-radius:8px;padding:12px 16px;margin-top:20px;font-size:11px;color:#3A5AA0;line-height:1.6">
      <strong>FSA / Dependent Care Reimbursement</strong><br>
      This receipt documents childcare expenses paid to an independent provider. 
      Provider: <strong>${sitterName}</strong>. 
      Keep this for your Flexible Spending Account or Dependent Care FSA submission.
    </div>` : `
    <div style="background:#F5F0E8;border:1px solid #D4B87A;border-radius:8px;padding:12px 16px;margin-top:20px;font-size:11px;color:#6A4A1A;line-height:1.6">
      <strong>Tax Record</strong><br>
      Retain this invoice for self-employment income reporting. 
      Family: <strong>${familyName}</strong>. 
      Invoice date: <strong>${fmtDate(invoice.issuedDate)}</strong>.
    </div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice — ${familyName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Outfit:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif;color:#1A1A1A;background:#fff;padding:48px 52px;max-width:720px;margin:0 auto}
  @media print{body{padding:28px 36px}@page{margin:0.5in}}
  h1{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#1A1A1A}
  .badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#F5F0E8;padding:8px 12px;text-align:left;font-weight:700;color:#5A4020;font-size:11px;letter-spacing:.5px;text-transform:uppercase}
  td{padding:9px 12px;border-bottom:1px solid #F0EAE0;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .total-row td{font-weight:700;font-size:15px;border-top:2px solid #D4B87A;padding-top:12px}
  .section-title{font-size:11px;font-weight:700;color:#888;letter-spacing:1px;text-transform:uppercase;margin:22px 0 8px}
  hr{border:none;border-top:1px solid #EDE5D8;margin:20px 0}
  .amount-big{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;color:#C8784A}
</style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div>
      <div style="font-size:12px;color:#999;margin-bottom:4px;letter-spacing:.5px">CHILDCARE INVOICE</div>
      <h1>littleloop</h1>
      <div style="font-size:13px;color:#666;margin-top:4px">${sitterName} · Independent Childcare Provider</div>
    </div>
    <div style="text-align:right">
      <span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusLabel}</span>
      <div style="font-size:11px;color:#999;margin-top:8px">Invoice #${invoice.id.slice(-6).toUpperCase()}</div>
      <div style="font-size:11px;color:#999">Issued: ${fmtDate(invoice.issuedDate)}</div>
      ${invoice.dueDate?`<div style="font-size:11px;color:#999">Due: ${fmtDate(invoice.dueDate)}</div>`:""}
    </div>
  </div>

  <!-- Parties -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div style="background:#F8F4EF;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:.8px;margin-bottom:6px">FROM</div>
      <div style="font-weight:700;font-size:14px">${sitterName}</div>
      <div style="font-size:12px;color:#666;margin-top:2px">Independent Childcare Provider</div>
    </div>
    <div style="background:#F8F4EF;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:.8px;margin-bottom:6px">TO</div>
      <div style="font-weight:700;font-size:14px">${familyName}</div>
      ${invoice.note?`<div style="font-size:12px;color:#666;margin-top:2px">${invoice.note}</div>`:""}
    </div>
  </div>

  <!-- Amount -->
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px">
    <div>
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:.8px;margin-bottom:2px">TOTAL DUE</div>
      <div class="amount-big">$${tot.toFixed(2)}</div>
    </div>
    <div style="flex:1">${status!=="unpaid"?progressBar:""}</div>
  </div>

  <!-- Line items -->
  <div class="section-title">Services</div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right;width:120px">Amount</th></tr></thead>
    <tbody>
      ${breakdownRows}
      ${extrasRows}
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align:right;color:#C8784A">$${tot.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${(invoice.payments||[]).length>0 ? `
  <div class="section-title">Payment History</div>
  <table>
    <thead><tr><th>Date</th><th>Method</th><th>Note</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;gap:32px;margin-top:10px;padding-top:10px;border-top:2px solid #D4B87A">
    <span style="font-size:13px;color:#666">Paid: <strong style="color:#2D7D5A">$${paid.toFixed(2)}</strong></span>
    <span style="font-size:13px;color:#666">Balance: <strong style="color:${rem>0?"#B07A2A":"#2D7D5A"}">$${rem.toFixed(2)}</strong></span>
  </div>` : ""}

  ${fsaNote}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #EDE5D8;display:flex;justify-content:space-between;font-size:10px;color:#bbb">
    <span>Generated by littleloop · Independent Childcare Platform</span>
    <span>${new Date().toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"})}</span>
  </div>

</body>
</html>`;

  // Open in new tab and trigger print
  const win = window.open("","_blank","width=800,height=900");
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}


function PaymentModal({ open, onClose, invoice, onRecord, dark }) {
  const [amount, setAmount]   = useState("");
  const [method, setMethod]   = useState("Venmo");
  const [note, setNote]       = useState("");
  const [err, setErr]         = useState("");
  if (!open||!invoice) return null;

  const tot       = invoiceTotal(invoice);
  const remaining = amountRemaining(invoice);
  const c         = dark ? S : P;
  const accentColor = dark ? S.accent : P.violet;
  const METHODS   = ["Venmo","Zelle","Cash","Check","PayPal","Bank Transfer","Other"];

  function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)            { setErr("Enter a valid amount."); return; }
    if (amt > remaining + 0.01)      { setErr(`Max remaining is $${remaining.toFixed(2)}.`); return; }
    onRecord({ id:`pay_${uid()}`, amount:amt, method, note, date:new Date().toISOString().slice(0,10) });
    setAmount(""); setNote(""); setErr("");
    onClose();
  }

  const pct = Math.min(100, Math.round((amountPaid(invoice)/tot)*100));

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"#00000077",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div onClick={e=>e.stopPropagation()} className="pop-in"
        style={{ background:c.card,borderRadius:18,padding:24,width:"100%",maxWidth:400,boxShadow:"0 24px 80px #00000066" }}>

        {/* Invoice summary */}
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:accentColor,marginBottom:4 }}>Record Payment</div>
        <div style={{ fontSize:12,color:dark?S.muted:P.muted,marginBottom:14 }}>{invoice.note} · {dark?db?.families?.[invoice.familyId]?.name:""}</div>

        {/* Progress bar */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5 }}>
            <span style={{ color:dark?S.soft:P.muted }}>Paid <strong style={{ color:dark?S.green:P.teal }}>${amountPaid(invoice).toFixed(2)}</strong></span>
            <span style={{ color:dark?S.muted:P.muted }}>Total <strong style={{ color:accentColor }}>${tot.toFixed(2)}</strong></span>
          </div>
          <div style={{ height:8,background:dark?S.bg:P.border,borderRadius:99,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,transition:"width 0.4s ease",
              background:`linear-gradient(90deg,${dark?S.green:P.teal},${accentColor})` }} />
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,marginTop:4,color:dark?S.muted:P.muted }}>
            <span>{pct}% paid</span>
            <span style={{ color:dark?S.accent:P.accent,fontWeight:700 }}>${remaining.toFixed(2)} remaining</span>
          </div>
        </div>

        {/* Quick-fill buttons */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:9,fontWeight:700,color:dark?S.muted:P.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:6 }}>QUICK FILL</div>
          <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
            {[remaining, remaining/2, 50, 100].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4).map(v=>(
              <div key={v} onClick={()=>setAmount(v.toFixed(2))}
                style={{ padding:"4px 11px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                  background:parseFloat(amount)===v?accentColor:`${accentColor}18`,
                  color:parseFloat(amount)===v?(dark?S.bg:"#fff"):accentColor,
                  transition:"all 0.15s",border:`1px solid ${accentColor}33` }}>
                ${v.toFixed(2)}{v===remaining?" (full)":v===remaining/2?" (half)":""}
              </div>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:dark?S.muted:P.muted,marginBottom:5 }}>AMOUNT ($)</div>
          <input type="number" value={amount} onChange={e=>{setAmount(e.target.value);setErr("");}}
            placeholder={`Up to $${remaining.toFixed(2)}`}
            style={{ width:"100%",padding:"10px 12px",borderRadius:9,border:`2px solid ${err?S.red:dark?S.border:P.border}`,
              background:dark?S.bg:P.bg,color:dark?S.text:P.text,fontSize:15,fontWeight:700 }} />
          {err&&<div style={{ fontSize:11,color:S.red,marginTop:4 }}>⚠️ {err}</div>}
        </div>

        {/* Method */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:dark?S.muted:P.muted,marginBottom:5 }}>PAYMENT METHOD</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {METHODS.map(m=>(
              <div key={m} onClick={()=>setMethod(m)}
                style={{ padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                  background:method===m?accentColor:`${accentColor}18`,
                  color:method===m?(dark?S.bg:"#fff"):accentColor,transition:"all 0.15s" }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:dark?S.muted:P.muted,marginBottom:5 }}>NOTE (optional)</div>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. First half, thank you!"
            style={{ width:"100%",padding:"8px 11px",borderRadius:9,border:`1px solid ${dark?S.border:P.border}`,background:dark?S.bg:P.bg,color:dark?S.text:P.text,fontSize:12 }} />
        </div>

        <div style={{ display:"flex",gap:8 }}>
          <button onClick={submit} style={{ flex:1,background:accentColor,border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:dark?S.bg:"#fff",cursor:"pointer",fontFamily:"'Outfit'" }}>
            Record ${parseFloat(amount)>0?parseFloat(amount).toFixed(2):"—"}
          </button>
          <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${dark?S.border:P.border}`,borderRadius:10,padding:"11px 16px",fontSize:13,color:dark?S.muted:P.muted,cursor:"pointer",fontFamily:"'Outfit'" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Card ──────────────────────────────────────────────────────────────
function InvoiceCard({ invoice, families, dark, onAddPayment, onMarkPaid, sitterView, onExportPDF }) {
  const [showPayments, setShowPayments] = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const c      = dark ? S : P;
  const tot    = invoiceTotal(invoice);
  const paid   = amountPaid(invoice);
  const rem    = amountRemaining(invoice);
  const status = invoiceStatus(invoice);
  const pct    = Math.min(100, Math.round((paid/tot)*100));
  const fam    = families?.[invoice.familyId];

  const statusMeta = {
    paid:    { label:"✅ Paid",    bg:dark?`${S.green}22`:`${P.teal}18`,    color:dark?S.green:P.teal    },
    partial: { label:"⏳ Partial", bg:dark?`${S.accent}22`:`${P.accent}18`, color:dark?S.accent:P.accent },
    unpaid:  { label:"💳 Unpaid",  bg:dark?`${S.red}22`:`${P.red}18`,       color:dark?S.red:P.red       },
  }[status];

  return (
    <>
      <div className="fade-in" style={{ background:c.card,borderRadius:14,padding:15,marginBottom:10,
        border:`1px solid ${status==="paid"?(dark?S.green+"44":P.teal+"44"):status==="partial"?(dark?S.accent+"55":P.accent+"44"):c.border}`,
        boxShadow:status==="partial"?`0 0 0 1px ${dark?S.accent+"22":P.accent+"22"}`:"none" }}>

        {/* Top row */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
          <div>
            {sitterView&&fam&&<div style={{ fontSize:10,fontWeight:700,color:dark?S.muted:P.muted,marginBottom:2 }}>{fam.name}</div>}
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:dark?S.accent:P.accent }}>${tot.toFixed(2)}</div>
            <div style={{ fontSize:11,color:dark?S.muted:P.muted }}>{invoice.note} · Issued {fmtDate(invoice.issuedDate)}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,background:statusMeta.bg,color:statusMeta.color }}>{statusMeta.label}</span>
            {invoice.dueDate&&<div style={{ fontSize:10,color:dark?S.muted:P.muted,marginTop:4 }}>Due {fmtDate(invoice.dueDate)}</div>}
          </div>
        </div>

        {/* Billing breakdown */}
        <div style={{ fontSize:11,color:dark?S.muted:P.muted,background:dark?S.bg:P.bg,borderRadius:8,padding:"7px 10px",marginBottom:10 }}>
          {invoice.type==="hourly" ? `${invoice.hours} hours × $${invoice.rate}/hr = $${(invoice.hours*invoice.rate).toFixed(2)}`
            : `${invoice.tuitionPeriod} tuition = $${Number(invoice.tuitionRate).toFixed(2)}`}
          {(invoice.extras||[]).map((e,i)=><div key={i}>+ {e.label}: ${Number(e.amount).toFixed(2)}</div>)}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
            <span style={{ color:dark?S.soft:P.muted }}>
              Paid <strong style={{ color:dark?S.green:P.teal }}>${paid.toFixed(2)}</strong>
              {paid>0&&<span style={{ color:dark?S.muted:P.soft }}> · {pct}%</span>}
            </span>
            {rem>0&&<span style={{ color:dark?S.accent:P.accent,fontWeight:700 }}>${rem.toFixed(2)} remaining</span>}
          </div>
          <div style={{ height:7,background:dark?S.bg:P.border,borderRadius:99,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,transition:"width 0.5s ease",
              background:status==="paid"
                ?`linear-gradient(90deg,${dark?S.green:P.teal},${dark?S.green:P.teal})`
                :`linear-gradient(90deg,${dark?S.green:P.teal},${dark?S.accent:P.accent})` }} />
          </div>
        </div>

        {/* Payment history toggle */}
        {(invoice.payments||[]).length>0&&(
          <button onClick={()=>setShowPayments(s=>!s)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,
            color:dark?S.muted:P.muted,padding:0,marginBottom:8,fontFamily:"'Outfit'",display:"flex",alignItems:"center",gap:4 }}>
            {showPayments?"▾":"▸"} {invoice.payments.length} payment{invoice.payments.length!==1?"s":""}
          </button>
        )}
        {showPayments&&(
          <div style={{ marginBottom:10 }}>
            {(invoice.payments||[]).map(p=>(
              <div key={p.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:dark?S.bg:P.bg,marginBottom:5 }}>
                <div style={{ width:7,height:7,borderRadius:"50%",background:dark?S.green:P.teal,flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:dark?S.green:P.teal }}>${Number(p.amount).toFixed(2)}</span>
                  <span style={{ fontSize:11,color:dark?S.muted:P.muted }}> via {p.method}</span>
                  {p.note&&<span style={{ fontSize:11,color:dark?S.soft:P.soft }}> · {p.note}</span>}
                </div>
                <div style={{ fontSize:10,color:dark?S.muted:P.muted }}>{fmtDate(p.date)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          {status!=="paid"&&(
            <>
              <button onClick={()=>setShowModal(true)} style={{
                flex:1, background:dark?`${S.accent}22`:`${P.violet}18`,
                border:`1px solid ${dark?S.accent+"55":P.violet+"44"}`,
                borderRadius:10,padding:"9px",fontSize:12,fontWeight:700,
                color:dark?S.accent:P.violet,cursor:"pointer",fontFamily:"'Outfit'",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>💵 Record Payment{rem<tot?" (Partial)":""}</button>
              {sitterView&&(
                <button onClick={()=>onMarkPaid(invoice.id)} style={{
                  background:dark?`${S.green}22`:`${P.teal}18`,border:`1px solid ${dark?S.green+"44":P.teal+"44"}`,
                  borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,
                  color:dark?S.green:P.teal,cursor:"pointer",fontFamily:"'Outfit'",
                }}>✅ Full</button>
              )}
            </>
          )}
          <button onClick={()=>onExportPDF(invoice)} style={{
            background:dark?`${S.accent}15`:`${P.accent}12`,
            border:`1px solid ${dark?S.accent+"44":P.accent+"33"}`,
            borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,
            color:dark?S.accent:P.accent,cursor:"pointer",fontFamily:"'Outfit'",
            display:"flex",alignItems:"center",gap:5,
            ...(status==="paid"?{width:"100%",justifyContent:"center"}:{}),
          }}>📄 Export PDF</button>
        </div>
      </div>

      <PaymentModal
        open={showModal}
        onClose={()=>setShowModal(false)}
        invoice={invoice}
        dark={dark}
        onRecord={payment=>onAddPayment(invoice.id, payment)}
      />
    </>
  );
}

const POST_TYPES = {
  activity:{label:"Activity",icon:"🎯"}, meal:{label:"Meal",icon:"🍽️"},
  nap:{label:"Nap",icon:"😴"}, photo:{label:"Photo",icon:"📸"},
  milestone:{label:"Milestone",icon:"⭐"}, note:{label:"Note",icon:"📝"},
};
const MOODS = ["happy","content","proud","excited","tired","fussy","rested","curious"];
const MOOD_EM = {happy:"😄",content:"😊",proud:"🌟",excited:"🎉",tired:"😴",fussy:"😤",rested:"✨",curious:"🤔"};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Btn({ children, onClick, color, ghost, small, disabled, style={} }) {
  const [hov, setHov] = useState(false);
  const bg = ghost ? "transparent" : hov ? color+"CC" : color;
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:bg, border:`1px solid ${color}${ghost?"88":"00"}`, borderRadius:8,
        padding:small?"4px 10px":"8px 16px", fontSize:small?11:12, fontWeight:600,
        color:ghost?color:"#fff", cursor:disabled?"not-allowed":"pointer",
        fontFamily:"'Outfit'", opacity:disabled?0.4:1, transition:"all 0.15s", ...style }}>
      {children}
    </button>
  );
}

function Modal({ open, onClose, children, dark }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"#00000077",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div onClick={e=>e.stopPropagation()} className="pop-in"
        style={{ background:dark?S.card:P.card, borderRadius:18, padding:24, width:"100%", maxWidth:460, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 24px 80px #00000066" }}>
        {children}
      </div>
    </div>
  );
}

function RoleBadge({ role, small }) {
  const r = ROLES[role];
  if (!r) return null;
  return (
    <span style={{ fontSize:small?9:10, fontWeight:700, padding:small?"2px 6px":"3px 9px", borderRadius:20,
      background:`${r.color}22`, color:r.color, display:"inline-flex", alignItems:"center", gap:3 }}>
      {r.icon} {r.label}
    </span>
  );
}

function NotifToast({ notifs, dismiss }) {
  return (
    <div style={{ position:"fixed",top:14,right:14,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
      {notifs.map(n=>(
        <div key={n.id} onClick={()=>dismiss(n.id)}
          style={{
            background:n.side==="sitter"?S.card:P.card,
            border:`1px solid ${n.side==="sitter"?S.accent+"55":P.violet+"44"}`,
            borderLeft:`3px solid ${n.side==="sitter"?S.accent:P.violet}`,
            borderRadius:12, padding:"10px 14px", minWidth:270, maxWidth:330,
            boxShadow:"0 8px 28px #00000044",
            animation:n.leaving?"notifOut 0.3s ease forwards":"notifIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
            pointerEvents:"all", cursor:"pointer",
          }}>
          <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
            <span style={{ fontSize:18 }}>{n.icon}</span>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:n.side==="sitter"?S.accent:P.violet }}>{n.title}</div>
              <div style={{ fontSize:11,color:n.side==="sitter"?S.soft:P.muted,lineHeight:1.4,marginTop:1 }}>{n.body}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoUpload({ onPhoto, dark, small }) {
  const ref = useRef();
  return (
    <>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>onPhoto(ev.target.result); r.readAsDataURL(f); }} />
      <button onClick={()=>ref.current.click()} style={{
        background:`${dark?S.accent:P.accent}22`, border:`1px dashed ${dark?S.accent:P.accent}66`,
        borderRadius:8, padding:small?"5px 10px":"7px 12px", fontSize:11, fontWeight:600,
        color:dark?S.accent:P.accent, cursor:"pointer", fontFamily:"'Outfit'", display:"flex", alignItems:"center", gap:5,
      }}>📷 {small?"Photo":"Add Photo"}</button>
    </>
  );
}

// ─── Label ─────────────────────────────────────────────────────────────────────
function Label({ children, color }) {
  return <div style={{ fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:color||S.muted,marginBottom:5 }}>{children}</div>;
}
function Input({ value, onChange, placeholder, type="text", dark, style={} }) {
  const c = dark?S:P;
  return <input value={value} onChange={onChange} placeholder={placeholder} type={type}
    style={{ width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${c.border}`,background:dark?c.bg:c.bg,color:c.text,fontSize:12,...style }} />;
}
function Select({ value, onChange, children, dark }) {
  const c = dark?S:P;
  return <select value={value} onChange={onChange}
    style={{ width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${c.border}`,background:dark?c.bg:c.bg,color:c.text,fontSize:12 }}>
    {children}
  </select>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILY MEMBERS PANEL (Parent Admin view)
// ═══════════════════════════════════════════════════════════════════════════════
function FamilyMembersPanel({ db, setDb, familyId, currentMemberId, pushNotif }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", role:"member", avatar:"👤" });
  const [confirmRemove, setConfirmRemove] = useState(null); // memberId to remove

  const family   = db.families[familyId];
  const members  = Object.values(db.members).filter(m=>m.familyId===familyId);
  const me       = db.members[currentMemberId];
  const iAmAdmin = me?.role === "admin";

  const adminCount = members.filter(m=>m.role==="admin"&&m.status==="active").length;

  const AVATARS = ["👩","👨","👵","👴","🧔","👩‍🦱","👧","🧒","👤"];

  function addMember() {
    if (!form.name.trim()||!form.email.trim()) return;
    const id = `m_${uid()}`;
    const nm = { id, familyId, name:form.name, email:form.email, role:form.role, avatar:form.avatar, status:"pending" };
    setDb(d=>({ ...d, members:{ ...d.members, [id]:nm } }));
    pushNotif({ side:"parent", icon:"📧", title:"Invite sent", body:`${form.name} invited as ${ROLES[form.role].label}` });
    setForm({ name:"", email:"", role:"member", avatar:"👤" });
    setShowAdd(false);
  }

  function changeRole(memberId, newRole) {
    // Guard: can't demote last admin
    const target = db.members[memberId];
    if (target.role==="admin" && newRole!=="admin" && adminCount<=1) {
      pushNotif({ side:"parent", icon:"⚠️", title:"Can't remove last admin", body:"Assign another admin first, then change this role." });
      return;
    }
    setDb(d=>({ ...d, members:{ ...d.members, [memberId]:{ ...d.members[memberId], role:newRole } } }));
    pushNotif({ side:"parent", icon:"✏️", title:"Role updated", body:`${db.members[memberId].name} is now ${ROLES[newRole].label}` });
  }

  function removeMember(memberId) {
    const target = db.members[memberId];
    if (target.role==="admin" && adminCount<=1) {
      pushNotif({ side:"parent", icon:"⚠️", title:"Can't remove last admin", body:"Assign another admin before removing this member." });
      setConfirmRemove(null); return;
    }
    if (memberId === currentMemberId) {
      pushNotif({ side:"parent", icon:"⚠️", title:"Can't remove yourself", body:"Ask another admin to remove you." });
      setConfirmRemove(null); return;
    }
    const { [memberId]:_, ...rest } = db.members;
    setDb(d=>({ ...d, members:rest }));
    setConfirmRemove(null);
  }

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,color:P.violet }}>Family Members</div>
          <div style={{ fontSize:11,color:P.muted,marginTop:1 }}>{family?.name} · {members.length} member{members.length!==1?"s":""}</div>
        </div>
        {iAmAdmin && <Btn color={P.violet} onClick={()=>setShowAdd(s=>!s)} small>+ Add Member</Btn>}
      </div>

      {/* Role Legend */}
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
        {Object.entries(ROLES).map(([k,v])=>(
          <div key={k} style={{ display:"flex",alignItems:"center",gap:4,background:`${v.color}18`,borderRadius:20,padding:"3px 10px" }}>
            <span style={{ fontSize:11 }}>{v.icon}</span>
            <span style={{ fontSize:10,fontWeight:600,color:v.color }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Add Member Form */}
      {iAmAdmin && showAdd && (
        <div className="fade-in" style={{ background:P.lavender,borderRadius:12,padding:14,marginBottom:14,border:`1px solid ${P.violet}33` }}>
          <Label color={P.violet}>NEW MEMBER</Label>
          <div style={{ marginBottom:8 }}>
            <Label>AVATAR</Label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {AVATARS.map(a=>(
                <div key={a} onClick={()=>setForm(f=>({...f,avatar:a}))}
                  style={{ width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",
                    background:form.avatar===a?`${P.violet}33`:"#f0f0f0",border:form.avatar===a?`2px solid ${P.violet}`:"2px solid transparent" }}>
                  {a}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><Label>NAME</Label><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Full name" /></div>
            <div><Label>EMAIL</Label><Input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com" /></div>
          </div>
          <div style={{ marginBottom:12 }}>
            <Label>ROLE</Label>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              {Object.entries(ROLES).filter(([k])=>k!=="admin").map(([k,v])=>(
                <div key={k} onClick={()=>setForm(f=>({...f,role:k}))}
                  style={{ padding:"8px 10px",borderRadius:10,cursor:"pointer",border:`2px solid ${form.role===k?v.color:P.border}`,
                    background:form.role===k?`${v.color}15`:"transparent",transition:"all 0.15s" }}>
                  <div style={{ fontSize:13,marginBottom:2 }}>{v.icon} <span style={{ fontWeight:700,fontSize:12,color:v.color }}>{v.label}</span></div>
                  <div style={{ fontSize:10,color:P.muted,lineHeight:1.3 }}>{v.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn color={P.violet} onClick={addMember}>Send Invite</Btn>
            <Btn color={P.muted} ghost onClick={()=>setShowAdd(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* Member List */}
      {members.map(m=>{
        const isMe = m.id===currentMemberId;
        const r = ROLES[m.role];
        return (
          <div key={m.id} className="fade-in" style={{
            background:P.card, borderRadius:12, padding:"12px 14px", marginBottom:8,
            border:`1px solid ${isMe?P.violet+"44":P.border}`,
            boxShadow:isMe?`0 0 0 2px ${P.violet}22`:"none",
          }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:38,height:38,borderRadius:"50%",background:`${r.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{m.avatar}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ fontWeight:600,fontSize:13 }}>{m.name}</span>
                  {isMe && <span style={{ fontSize:9,background:`${P.violet}22`,color:P.violet,padding:"1px 6px",borderRadius:20,fontWeight:700 }}>YOU</span>}
                  {m.status==="pending" && <span style={{ fontSize:9,background:"#D4884422",color:"#D48844",padding:"1px 6px",borderRadius:20,fontWeight:700 }}>⏳ PENDING</span>}
                </div>
                <div style={{ fontSize:11,color:P.muted }}>{m.email}</div>
              </div>

              {/* Role selector — admin only, can't change self if last admin */}
              {iAmAdmin && !isMe ? (
                <select value={m.role} onChange={e=>changeRole(m.id,e.target.value)}
                  style={{ padding:"4px 8px",borderRadius:8,border:`1px solid ${r.color}55`,background:`${r.color}18`,color:r.color,fontSize:11,fontWeight:700,cursor:"pointer" }}>
                  {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              ) : (
                <RoleBadge role={m.role} />
              )}

              {iAmAdmin && !isMe && (
                <button onClick={()=>setConfirmRemove(m.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:15,color:P.muted,padding:"2px 6px",borderRadius:6,transition:"color 0.15s" }}
                  title="Remove member">✕</button>
              )}
            </div>

            {/* Permission chips */}
            <div style={{ display:"flex",gap:5,marginTop:8,flexWrap:"wrap" }}>
              {[
                { can:CAN.viewFeed(m.role),    label:"View Feed" },
                { can:CAN.sendMessage(m.role), label:"Messaging" },
                { can:CAN.checkInOut(m.role),  label:"Check In/Out" },
                { can:CAN.manageMembers(m.role),label:"Manage Members" },
              ].map(p=>(
                <span key={p.label} style={{ fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:20,
                  background:p.can?"#4E9E8A18":"#99999918", color:p.can?P.teal:P.muted }}>
                  {p.can?"✓":"✗"} {p.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/* Confirm Remove Dialog */}
      <Modal open={!!confirmRemove} onClose={()=>setConfirmRemove(null)}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:36,marginBottom:10 }}>⚠️</div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,marginBottom:8 }}>Remove Member?</div>
          <div style={{ fontSize:13,color:P.muted,marginBottom:20 }}>
            <strong>{db.members[confirmRemove]?.name}</strong> will lose access to the family. This can't be undone.
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
            <Btn color={P.red} onClick={()=>removeMember(confirmRemove)}>Yes, Remove</Btn>
            <Btn color={P.muted} ghost onClick={()=>setConfirmRemove(null)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SITTER APP
// ═══════════════════════════════════════════════════════════════════════════════
function SitterApp({ db, setDb, pushNotif }) {
  const [tab, setTab]           = useState("feed");
  const [famFilter, setFamFilter] = useState("all");
  const [showPost, setShowPost]  = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [activeMsg, setActiveMsg] = useState("f1");
  const [msgInput, setMsgInput]  = useState("");
  const [sitterViewingChild, setSitterViewingChild] = useState(null);
  const msgEnd = useRef();

  const activeFams = Object.values(db.families).filter(f=>f.status==="active");
  const allFams    = Object.values(db.families);

  useEffect(()=>{ msgEnd.current?.scrollIntoView({behavior:"smooth"}); },[db.messages,activeMsg,tab]);

  // Post form
  const [pf, setPf] = useState({ familyId:"f1", childIds:[], type:"activity", text:"", mood:"happy", photo:null });
  function submitPost() {
    if (!pf.text.trim()&&!pf.photo) return;
    const post = { id:`post_${uid()}`, ...pf, authorRole:"sitter", timestamp:Date.now(), likes:{}, pinned:false };
    setDb(d=>({ ...d, posts:{ ...d.posts, [post.id]:post } }));
    pushNotif({ side:"parent", icon:"🌸", title:"New update from Maya", body:pf.text.slice(0,55)+(pf.text.length>55?"…":"") });
    setShowPost(false); setPf({ familyId:"f1", childIds:[], type:"activity", text:"", mood:"happy", photo:null });
  }

  // Invite form
  const [inv, setInv] = useState({ familyName:"", email:"", childrenStr:"" });
  function submitInvite() {
    if (!inv.email||!inv.familyName) return;
    const fid = `f_${uid()}`;
    const newFam = { id:fid, name:inv.familyName, status:"pending", adminEmail:inv.email };
    const kids = inv.childrenStr.split(",").map(s=>s.trim()).filter(Boolean)
      .map(name=>({ id:`ch_${uid()}`, familyId:fid, name, age:4, avatar:"🌟", color:"#8B78D4" }));
    const adminMember = { id:`m_${uid()}`, familyId:fid, name:inv.email.split("@")[0], email:inv.email, avatar:"👤", role:"admin", status:"pending" };
    setDb(d=>({
      ...d,
      families:{ ...d.families, [fid]:newFam },
      children:{ ...d.children, ...Object.fromEntries(kids.map(k=>[k.id,k])) },
      members:{ ...d.members, [adminMember.id]:adminMember },
      messages:{ ...d.messages, [fid]:[] },
    }));
    pushNotif({ side:"sitter", icon:"📧", title:"Invite sent!", body:`${inv.familyName} invited. ${inv.email} will be family admin.` });
    setShowInvite(false); setInv({ familyName:"", email:"", childrenStr:"" });
  }

  // Invoice form
  const [ivf, setIvf] = useState({ familyId:"f1", type:"hourly", hours:10, rate:20, tuitionPeriod:"weekly", tuitionRate:300, extras:[], note:"", dueDate:"" });
  const [ivEx, setIvEx] = useState({ label:"", amount:"" });
  function submitInvoice() {
    const inv2 = { id:`inv_${uid()}`, ...ivf, payments:[], issuedDate:new Date().toISOString().slice(0,10) };
    setDb(d=>({ ...d, invoices:[...(d.invoices||[]),inv2] }));
    pushNotif({ side:"parent", icon:"💰", title:"New invoice from Maya", body:`$${invoiceTotal(inv2).toFixed(2)} due ${inv2.dueDate||"soon"}` });
    setShowInvoice(false);
  }

  function addPayment(invoiceId, payment) {
    setDb(d=>({ ...d, invoices:d.invoices.map(i=>{
      if(i.id!==invoiceId) return i;
      const payments=[...(i.payments||[]),payment];
      return {...i, payments};
    })}));
    const inv2 = db.invoices.find(i=>i.id===invoiceId);
    const fam  = inv2?db.families[inv2.familyId]?.name:"";
    pushNotif({ side:"parent", icon:"💵", title:"Payment recorded", body:`$${payment.amount.toFixed(2)} via ${payment.method}${fam?` · ${fam}`:""}` });
  }

  function markFullyPaid(invoiceId) {
    setDb(d=>({ ...d, invoices:d.invoices.map(i=>{
      if(i.id!==invoiceId) return i;
      const tot=invoiceTotal(i); const paid=amountPaid(i); const rem=Math.max(0,tot-paid);
      if(rem<=0) return i;
      const payment={ id:`pay_${uid()}`, amount:rem, method:"Manual", note:"Marked as fully paid", date:new Date().toISOString().slice(0,10) };
      return {...i, payments:[...(i.payments||[]),payment]};
    })}));
  }

  function sendMsg() {
    if (!msgInput.trim()) return;
    const msg = { id:`msg_${uid()}`, from:"sitter", fromName:"Maya", text:msgInput, ts:Date.now() };
    setDb(d=>({ ...d, messages:{ ...d.messages, [activeMsg]:[...(d.messages[activeMsg]||[]),msg] } }));
    pushNotif({ side:"parent", icon:"💬", title:"Message from Maya", body:msgInput.slice(0,55) });
    setMsgInput("");
  }

  // ── Summary Report ──
  const thisYear = new Date().getFullYear();
  const [showReport, setShowReport] = useState(false);
  const [rFrom, setRFrom] = useState(`${thisYear}-01-01`);
  const [rTo,   setRTo]   = useState(`${thisYear}-12-31`);
  const [rFam,  setRFam]  = useState("all");

  const QUICK_RANGES = [
    { label:"This Year",      from:`${thisYear}-01-01`,      to:`${thisYear}-12-31` },
    { label:"Last Year",      from:`${thisYear-1}-01-01`,    to:`${thisYear-1}-12-31` },
    { label:"Q1",             from:`${thisYear}-01-01`,      to:`${thisYear}-03-31` },
    { label:"Q2",             from:`${thisYear}-04-01`,      to:`${thisYear}-06-30` },
    { label:"Q3",             from:`${thisYear}-07-01`,      to:`${thisYear}-09-30` },
    { label:"Q4",             from:`${thisYear}-10-01`,      to:`${thisYear}-12-31` },
    { label:"Last 30 days",   from:new Date(Date.now()-30*864e5).toISOString().slice(0,10), to:new Date().toISOString().slice(0,10) },
    { label:"Last 90 days",   from:new Date(Date.now()-90*864e5).toISOString().slice(0,10), to:new Date().toISOString().slice(0,10) },
  ];

  function getReportInvoices() {
    return (db.invoices||[]).filter(inv => {
      const d = inv.issuedDate;
      if (d < rFrom || d > rTo) return false;
      if (rFam !== "all" && inv.familyId !== rFam) return false;
      return true;
    }).sort((a,b) => a.issuedDate.localeCompare(b.issuedDate));
  }

  function exportSummaryReport() {
    const invs    = getReportInvoices();
    const allFamsMap = db.families;

    const grandTotal   = invs.reduce((s,i)=>s+invoiceTotal(i),0);
    const grandPaid    = invs.reduce((s,i)=>s+amountPaid(i),0);
    const grandUnpaid  = grandTotal - grandPaid;

    // Group by family
    const byFamily = {};
    invs.forEach(inv => {
      if (!byFamily[inv.familyId]) byFamily[inv.familyId] = [];
      byFamily[inv.familyId].push(inv);
    });

    const familySections = Object.entries(byFamily).map(([fid, finvs]) => {
      const famName = allFamsMap[fid]?.name || "Unknown Family";
      const famTotal = finvs.reduce((s,i)=>s+invoiceTotal(i),0);
      const famPaid  = finvs.reduce((s,i)=>s+amountPaid(i),0);
      const rows = finvs.map(inv => {
        const tot  = invoiceTotal(inv);
        const paid = amountPaid(inv);
        const rem  = amountRemaining(inv);
        const st   = invoiceStatus(inv);
        const stColor = st==="paid"?"#2D7D5A":st==="partial"?"#B07A2A":"#B03A2A";
        const stLabel = st==="paid"?"Paid":st==="partial"?"Partial":"Unpaid";
        const desc = inv.type==="hourly"
          ? `${inv.hours}h × $${inv.rate}/hr`
          : `${inv.tuitionPeriod} tuition`;
        return `
          <tr>
            <td style="font-family:monospace;font-size:11px;color:#888">#${inv.id.slice(-6).toUpperCase()}</td>
            <td>${fmtDate(inv.issuedDate)}</td>
            <td>${inv.dueDate?fmtDate(inv.dueDate):"—"}</td>
            <td style="color:#555">${inv.note||"—"}</td>
            <td style="color:#666;font-size:11px">${desc}</td>
            <td style="text-align:right;font-weight:600">$${tot.toFixed(2)}</td>
            <td style="text-align:right;color:#2D7D5A">$${paid.toFixed(2)}</td>
            <td style="text-align:right;color:${rem>0?"#B07A2A":"#2D7D5A"}">$${rem.toFixed(2)}</td>
            <td style="text-align:center"><span style="background:${stColor}22;color:${stColor};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${stLabel}</span></td>
          </tr>`;
      }).join("");

      return `
        <div style="margin-bottom:28px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#1A1A1A">${famName}</div>
            <div style="font-size:12px;color:#666">
              ${finvs.length} invoice${finvs.length!==1?"s":""} &nbsp;·&nbsp;
              Total <strong style="color:#C8784A">$${famTotal.toFixed(2)}</strong> &nbsp;·&nbsp;
              Paid <strong style="color:#2D7D5A">$${famPaid.toFixed(2)}</strong>
              ${famTotal-famPaid>0?` &nbsp;·&nbsp; Outstanding <strong style="color:#B07A2A">$${(famTotal-famPaid).toFixed(2)}</strong>`:""}
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#F5F0E8">
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Inv #</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Issued</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Due</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Note</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Type</th>
                <th style="padding:7px 10px;text-align:right;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Total</th>
                <th style="padding:7px 10px;text-align:right;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Paid</th>
                <th style="padding:7px 10px;text-align:right;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Balance</th>
                <th style="padding:7px 10px;text-align:center;font-size:10px;color:#5A4020;letter-spacing:.5px;text-transform:uppercase">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#FDF6EC;border-top:2px solid #D4B87A">
                <td colspan="5" style="padding:8px 10px;font-weight:700;font-size:12px">Family Subtotal</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:#C8784A">$${famTotal.toFixed(2)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:#2D7D5A">$${famPaid.toFixed(2)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:${famTotal-famPaid>0?"#B07A2A":"#2D7D5A"}">$${(famTotal-famPaid).toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }).join('<hr style="border:none;border-top:1px dashed #E0D8CC;margin:8px 0 28px">');

    const familyLabel = rFam==="all" ? "All Families" : (allFamsMap[rFam]?.name||"");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice Summary Report — ${thisYear}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Outfit:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif;color:#1A1A1A;background:#fff;padding:44px 52px;max-width:860px;margin:0 auto}
  @media print{body{padding:24px 32px}@page{margin:0.4in;size:landscape}}
  table td{border-bottom:1px solid #F0EAE0;padding:7px 10px;vertical-align:top}
  table tbody tr:hover{background:#FDFAF5}
</style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #D4B87A">
    <div>
      <div style="font-size:11px;color:#999;letter-spacing:.6px;margin-bottom:4px">INVOICE SUMMARY REPORT</div>
      <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700">Maya Rodriguez</div>
      <div style="font-size:13px;color:#666;margin-top:3px">Independent Childcare Provider · littleloop</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#999;margin-bottom:4px">REPORTING PERIOD</div>
      <div style="font-size:15px;font-weight:700;color:#C8784A">${fmtDate(rFrom)} — ${fmtDate(rTo)}</div>
      <div style="font-size:12px;color:#666;margin-top:3px">${familyLabel}</div>
      <div style="font-size:10px;color:#bbb;margin-top:4px">Generated ${new Date().toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"})}</div>
    </div>
  </div>

  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px">
    ${[
      { label:"Total Invoiced", val:`$${grandTotal.toFixed(2)}`, color:"#C8784A" },
      { label:"Total Collected", val:`$${grandPaid.toFixed(2)}`, color:"#2D7D5A" },
      { label:"Outstanding", val:`$${grandUnpaid.toFixed(2)}`, color:grandUnpaid>0?"#B07A2A":"#2D7D5A" },
      { label:"Invoices", val:`${invs.length}`, color:"#5A3F9E" },
    ].map(c=>`
      <div style="background:#F8F4EF;border-radius:10px;padding:14px 16px;border-left:3px solid ${c.color}">
        <div style="font-size:10px;color:#888;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px">${c.label}</div>
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:${c.color}">${c.val}</div>
      </div>`).join("")}
  </div>

  <!-- Per-family sections -->
  ${invs.length===0
    ? `<div style="text-align:center;padding:60px 0;color:#aaa;font-size:14px">No invoices found for this date range.</div>`
    : familySections}

  <!-- Grand Total -->
  ${invs.length>0 ? `
  <div style="margin-top:28px;padding:16px 20px;background:#14243A;border-radius:12px;display:flex;justify-content:space-between;align-items:center">
    <div style="color:#C8A96E;font-family:'Playfair Display',serif;font-size:15px;font-weight:700">Grand Total · ${invs.length} invoice${invs.length!==1?"s":""}</div>
    <div style="display:flex;gap:32px;align-items:center">
      <div style="text-align:right">
        <div style="font-size:10px;color:#7A90AA;font-weight:700;letter-spacing:.5px">INVOICED</div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#3A6FD4">$${grandTotal.toFixed(2)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#7A90AA;font-weight:700;letter-spacing:.5px">COLLECTED</div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#3A9E7A">$${grandPaid.toFixed(2)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#7A90AA;font-weight:700;letter-spacing:.5px">OUTSTANDING</div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:${grandUnpaid>0?"#D4A050":"#3A9E7A"}">$${grandUnpaid.toFixed(2)}</div>
      </div>
    </div>
  </div>
  <div style="margin-top:14px;padding:12px 16px;background:#F5F0E8;border-radius:8px;font-size:11px;color:#6A4A1A;line-height:1.6">
    <strong>Tax Note:</strong> This summary report covers childcare income earned between ${fmtDate(rFrom)} and ${fmtDate(rTo)}. 
    Retain all individual invoices as supporting documentation for Schedule C (self-employment income) filings.
  </div>` : ""}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #EDE5D8;display:flex;justify-content:space-between;font-size:10px;color:#bbb">
    <span>littleloop · Independent Childcare Platform</span>
    <span>Confidential · For tax and accounting purposes only</span>
  </div>

</body>
</html>`;

    const win = window.open("","_blank","width=1000,height=900");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  const visiblePosts = Object.values(db.posts)
    .filter(p=>famFilter==="all"||p.familyId===famFilter)
    .sort((a,b)=>b.pinned-a.pinned||b.timestamp-a.timestamp);

  const unread = Object.values(db.messages).reduce((a,t)=>{ const l=t[t.length-1]; return a+(l&&l.from!=="sitter"?1:0); },0);

  const navItems = [{id:"feed",icon:"🏠",label:"Feed"},{id:"families",icon:"👨‍👩‍👧",label:"Families"},{id:"messages",icon:"💬",label:"Messages"},{id:"invoices",icon:"💰",label:"Invoices"}];

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",background:S.bg,color:S.text,fontFamily:"'Outfit',sans-serif" }}>
      {/* Header */}
      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${S.accent},${S.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>🌿</div>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:S.accent }}>littleloop</div>
          <div style={{ fontSize:9,color:S.muted }}>Maya Rodriguez · Sitter</div>
        </div>
        <div style={{ marginLeft:"auto",display:"flex",gap:7 }}>
          <Btn small color={S.green} ghost onClick={()=>setShowInvite(true)}>+ Invite Family</Btn>
          <Btn small color={S.accent} onClick={()=>setShowPost(true)}>+ Post</Btn>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display:"flex",borderBottom:`1px solid ${S.border}` }}>
        {navItems.map(n=>(
          <div key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1,padding:"9px 0",textAlign:"center",cursor:"pointer",fontSize:11,fontWeight:600,
            color:tab===n.id?S.accent:S.muted, borderBottom:tab===n.id?`2px solid ${S.accent}`:"2px solid transparent",
            transition:"all 0.15s", position:"relative",
          }}>
            {n.icon} {n.label}
            {n.id==="messages"&&unread>0&&<span style={{ position:"absolute",top:6,right:"8%",background:S.green,color:S.bg,borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 5px" }}>{unread}</span>}
          </div>
        ))}
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:14 }}>
        {/* ── FEED ── */}
        {tab==="feed"&&<>
          <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
            {[{id:"all",name:"All Families"},...activeFams].map(f=>(
              <div key={f.id} onClick={()=>setFamFilter(f.id)} style={{
                padding:"3px 11px",borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:600,
                background:famFilter===f.id?S.accent:`${S.accent}18`,color:famFilter===f.id?S.bg:S.accent,transition:"all 0.15s",
              }}>{f.name}</div>
            ))}
          </div>
          {visiblePosts.map((post,i)=>{
            const kids = post.childIds.map(id=>db.children[id]).filter(Boolean);
            const fam  = db.families[post.familyId];
            return (
              <div key={post.id} className="fade-in" style={{ background:S.card,borderRadius:12,padding:13,marginBottom:9,
                border:`1px solid ${post.pinned?S.accent+"55":S.border}`,animationDelay:`${i*.04}s` }}>
                <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:8 }}>
                  <div style={{ display:"flex" }}>
                    {kids.map(k=><div key={k.id} style={{ width:26,height:26,borderRadius:"50%",background:`${k.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,border:`2px solid ${S.card}`,marginRight:-5 }}>{k.avatar}</div>)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:600 }}>{kids.map(k=>k.name).join(" & ")}</div>
                    <div style={{ fontSize:10,color:S.muted }}>{fam?.name} · {POST_TYPES[post.type]?.icon} {POST_TYPES[post.type]?.label} · {timeAgo(post.timestamp)}</div>
                  </div>
                  <span style={{ fontSize:10,background:`${S.green}22`,color:S.green,padding:"2px 8px",borderRadius:20,fontWeight:600 }}>{MOOD_EM[post.mood]} {post.mood}</span>
                  <button onClick={()=>setDb(d=>({...d,posts:{...d.posts,[post.id]:{...d.posts[post.id],pinned:!d.posts[post.id].pinned}}}))}
                    style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:post.pinned?1:0.25,padding:0 }}>📌</button>
                </div>
                {post.photo&&<img src={post.photo} alt="" style={{ width:"100%",borderRadius:8,maxHeight:150,objectFit:"cover",marginBottom:8 }} />}
                <p style={{ fontSize:12,lineHeight:1.55,color:S.soft }}>{post.text}</p>
                <div style={{ marginTop:6,fontSize:10,color:S.muted }}>❤️ {Object.keys(post.likes).length} from parents</div>
              </div>
            );
          })}
        </>}

        {/* ── FAMILIES ── */}
        {tab==="families"&&<>
          {allFams.map(fam=>{
            const kids    = Object.values(db.children).filter(c=>c.familyId===fam.id);
            const members = Object.values(db.members).filter(m=>m.familyId===fam.id);
            return (
              <div key={fam.id} className="fade-in" style={{ background:S.card,borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${S.border}` }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                  <div style={{ fontWeight:700,fontSize:14 }}>{fam.name}</div>
                  <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
                    background:fam.status==="active"?`${S.green}22`:`${S.accent}22`,color:fam.status==="active"?S.green:S.accent }}>
                    {fam.status==="pending"?"⏳ Pending":"✅ Active"}
                  </span>
                </div>
                {fam.status==="pending"&&<div style={{ fontSize:11,color:S.muted,marginBottom:8 }}>Admin invite sent to {fam.adminEmail}</div>}
                <div style={{ marginBottom:10 }}>
                  <Label>CHILDREN</Label>
                  <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                    {kids.length===0&&<span style={{ fontSize:11,color:S.muted,fontStyle:"italic" }}>None added</span>}
                    {kids.map(k=>{
                      const hasAllergies=(k.allergies||[]).length>0;
                      const hasMeds=(k.medications||[]).length>0;
                      return (
                        <div key={k.id} onClick={()=>setSitterViewingChild(k.id)}
                          style={{ display:"flex",alignItems:"center",gap:10,background:S.bg,borderRadius:10,padding:"9px 12px",cursor:"pointer",
                            border:`1px solid ${hasAllergies?"#C86060aa":S.border}`,transition:"all 0.15s" }}>
                          <div style={{ width:36,height:36,borderRadius:9,background:`${k.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0,border:`2px solid ${k.color}44` }}>
                            {k.photo?<img src={k.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:7}}/>:k.avatar}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,fontWeight:700,color:S.text }}>{k.name}, {k.age}</div>
                            <div style={{ display:"flex",gap:4,marginTop:3,flexWrap:"wrap" }}>
                              {hasAllergies&&<span style={{ fontSize:9,fontWeight:700,background:"#C8606022",color:"#C86060",padding:"1px 6px",borderRadius:20 }}>⚠️ {k.allergies.join(", ")}</span>}
                              {hasMeds&&<span style={{ fontSize:9,fontWeight:700,background:`${S.accent}22`,color:S.accent,padding:"1px 6px",borderRadius:20 }}>💊 {k.medications.length} med{k.medications.length!==1?"s":""}</span>}
                              {(k.emergencyContacts||[]).length>0&&<span style={{ fontSize:9,color:S.muted,padding:"1px 6px",borderRadius:20,background:`${S.muted}18` }}>🚨 {k.emergencyContacts.length} contact{k.emergencyContacts.length!==1?"s":""}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize:13,color:S.muted }}>›</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>MEMBERS ({members.length})</Label>
                  <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                    {members.map(m=>(
                      <div key={m.id} style={{ display:"flex",alignItems:"center",gap:4,background:S.bg,borderRadius:20,padding:"3px 10px" }}>
                        <span style={{ fontSize:12 }}>{m.avatar}</span>
                        <span style={{ fontSize:11 }}>{m.name.split(" ")[0]}</span>
                        <RoleBadge role={m.role} small />
                        {m.status==="pending"&&<span style={{ fontSize:9,color:"#D48844" }}>⏳</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>}

        {/* ── MESSAGES ── */}
        {tab==="messages"&&<>
          <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
            {activeFams.map(f=>{
              const t=db.messages[f.id]||[]; const l=t[t.length-1]; const unr=l&&l.from!=="sitter";
              return (
                <div key={f.id} onClick={()=>setActiveMsg(f.id)}
                  style={{ padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                    background:activeMsg===f.id?S.accent:`${S.accent}18`,color:activeMsg===f.id?S.bg:S.accent,
                    position:"relative",transition:"all 0.15s" }}>
                  {f.name.split(" ")[0]}
                  {unr&&activeMsg!==f.id&&<span style={{ position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:S.green }} />}
                </div>
              );
            })}
          </div>
          <div style={{ background:S.card,borderRadius:12,border:`1px solid ${S.border}`,overflow:"hidden" }}>
            <div style={{ padding:"9px 13px",borderBottom:`1px solid ${S.border}`,fontSize:12,fontWeight:700,color:S.accent }}>
              {db.families[activeMsg]?.name}
              <span style={{ fontWeight:400,color:S.muted,fontSize:10,marginLeft:8 }}>
                {Object.values(db.members).filter(m=>m.familyId===activeMsg&&CAN.sendMessage(m.role)).map(m=>m.name.split(" ")[0]).join(", ")}
              </span>
            </div>
            <div style={{ minHeight:180,maxHeight:280,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:7 }}>
              {(db.messages[activeMsg]||[]).map(msg=>(
                <div key={msg.id} style={{ display:"flex",justifyContent:msg.from==="sitter"?"flex-end":"flex-start" }}>
                  <div style={{ maxWidth:"78%",padding:"7px 11px",
                    borderRadius:msg.from==="sitter"?"11px 11px 3px 11px":"11px 11px 11px 3px",
                    background:msg.from==="sitter"?S.accent:`${S.accent}22`,
                    color:msg.from==="sitter"?S.bg:S.text,fontSize:12,lineHeight:1.5 }}>
                    {msg.from!=="sitter"&&<div style={{ fontSize:9,fontWeight:700,marginBottom:2,opacity:0.6 }}>{msg.fromName}</div>}
                    {msg.text}
                    <div style={{ fontSize:9,opacity:0.5,marginTop:2,textAlign:msg.from==="sitter"?"right":"left" }}>{fmtTime(msg.ts)}</div>
                  </div>
                </div>
              ))}
              <div ref={msgEnd} />
            </div>
            <div style={{ padding:9,borderTop:`1px solid ${S.border}`,display:"flex",gap:7 }}>
              <input value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()}
                placeholder="Reply to family…" style={{ flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${S.border}`,background:S.bg,color:S.text,fontSize:12 }} />
              <Btn color={S.accent} onClick={sendMsg} small>Send</Btn>
            </div>
          </div>
        </>}

        {/* ── INVOICES ── */}
        {tab==="invoices"&&<>
          {/* Toolbar */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap" }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,color:S.accent }}>Invoices</div>
            <div style={{ display:"flex",gap:7 }}>
              <Btn small color={S.green} ghost onClick={()=>setShowReport(true)}>📊 Summary Report</Btn>
              <Btn small color={S.accent} onClick={()=>setShowInvoice(true)}>+ New Invoice</Btn>
            </div>
          </div>

          {(db.invoices||[]).map(inv2=>(
            <InvoiceCard key={inv2.id} invoice={inv2} families={db.families} dark sitterView
              onAddPayment={addPayment} onMarkPaid={markFullyPaid}
              onExportPDF={inv=>exportInvoicePDF({ invoice:inv, familyName:db.families[inv.familyId]?.name||"Family", sitterName:"Maya Rodriguez", mode:"sitter" })} />
          ))}
        </>}
      </div>

      {/* ── Summary Report Modal ── */}
      <Modal open={showReport} onClose={()=>setShowReport(false)} dark>
        <div style={{ color:S.text }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,color:S.green,marginBottom:4 }}>Summary Report</div>
          <p style={{ fontSize:11,color:S.muted,marginBottom:16,lineHeight:1.5 }}>Select a date range to generate an itemised summary — perfect for year-end taxes or sending to a family.</p>

          {/* Quick ranges */}
          <div style={{ marginBottom:14 }}>
            <Label>QUICK SELECT</Label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {QUICK_RANGES.map(q=>{
                const active = rFrom===q.from && rTo===q.to;
                return (
                  <div key={q.label} onClick={()=>{ setRFrom(q.from); setRTo(q.to); }}
                    style={{ padding:"4px 11px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                      background:active?S.green:`${S.green}18`,color:active?S.bg:S.green,
                      border:`1px solid ${active?S.green:S.green+"33"}`,transition:"all 0.15s" }}>
                    {q.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom date range */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
            <div>
              <Label>FROM</Label>
              <input type="date" value={rFrom} onChange={e=>setRFrom(e.target.value)}
                style={{ width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${S.border}`,background:S.bg,color:S.text,fontSize:12 }} />
            </div>
            <div>
              <Label>TO</Label>
              <input type="date" value={rTo} onChange={e=>setRTo(e.target.value)}
                style={{ width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${S.border}`,background:S.bg,color:S.text,fontSize:12 }} />
            </div>
          </div>

          {/* Family filter */}
          <div style={{ marginBottom:16 }}>
            <Label>FAMILY FILTER</Label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {[{id:"all",name:"All Families"},...Object.values(db.families).filter(f=>f.status==="active")].map(f=>{
                const active = rFam===f.id;
                return (
                  <div key={f.id} onClick={()=>setRFam(f.id)}
                    style={{ padding:"4px 11px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                      background:active?S.accent:`${S.accent}18`,color:active?S.bg:S.accent,transition:"all 0.15s" }}>
                    {f.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview count */}
          {(()=>{
            const preview = getReportInvoices();
            const tot = preview.reduce((s,i)=>s+invoiceTotal(i),0);
            const paid = preview.reduce((s,i)=>s+amountPaid(i),0);
            return (
              <div style={{ background:`${S.green}12`,border:`1px solid ${S.green}33`,borderRadius:10,padding:"11px 14px",marginBottom:16,display:"flex",gap:20,flexWrap:"wrap" }}>
                <div><div style={{ fontSize:9,color:S.muted,fontWeight:700,letterSpacing:.8,textTransform:"uppercase" }}>Invoices</div>
                  <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:S.accent }}>{preview.length}</div></div>
                <div><div style={{ fontSize:9,color:S.muted,fontWeight:700,letterSpacing:.8,textTransform:"uppercase" }}>Total Invoiced</div>
                  <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:S.accent }}>${tot.toFixed(2)}</div></div>
                <div><div style={{ fontSize:9,color:S.muted,fontWeight:700,letterSpacing:.8,textTransform:"uppercase" }}>Collected</div>
                  <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:S.green }}>${paid.toFixed(2)}</div></div>
                <div><div style={{ fontSize:9,color:S.muted,fontWeight:700,letterSpacing:.8,textTransform:"uppercase" }}>Outstanding</div>
                  <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:tot-paid>0?S.accent:S.green }}>${(tot-paid).toFixed(2)}</div></div>
              </div>
            );
          })()}

          <div style={{ display:"flex",gap:8 }}>
            <button onClick={exportSummaryReport} style={{ flex:1,background:S.green,border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:S.bg,cursor:"pointer",fontFamily:"'Outfit'",display:"flex",alignItems:"center",justifyContent:"center",gap:7 }}>
              📄 Export Summary PDF
            </button>
            <button onClick={()=>setShowReport(false)} style={{ background:"transparent",border:`1px solid ${S.border}`,borderRadius:10,padding:"11px 16px",fontSize:13,color:S.muted,cursor:"pointer",fontFamily:"'Outfit'" }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Post Modal ── */}
      <Modal open={showPost} onClose={()=>setShowPost(false)} dark>
        <div style={{ color:S.text }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,color:S.accent,marginBottom:14 }}>New Update</div>
          <div style={{ marginBottom:9 }}><Label>FAMILY</Label>
            <Select value={pf.familyId} onChange={e=>setPf(f=>({...f,familyId:e.target.value,childIds:[]}))} dark>
              {activeFams.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div style={{ marginBottom:9 }}><Label>CHILDREN</Label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {Object.values(db.children).filter(c=>c.familyId===pf.familyId).map(k=>(
                <div key={k.id} onClick={()=>setPf(f=>({...f,childIds:f.childIds.includes(k.id)?f.childIds.filter(x=>x!==k.id):[...f.childIds,k.id]}))}
                  style={{ padding:"4px 11px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                    background:pf.childIds.includes(k.id)?k.color:`${k.color}22`,color:pf.childIds.includes(k.id)?S.bg:k.color,transition:"all 0.15s" }}>
                  {k.avatar} {k.name}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9 }}>
            <div><Label>TYPE</Label>
              <Select value={pf.type} onChange={e=>setPf(f=>({...f,type:e.target.value}))} dark>
                {Object.entries(POST_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </Select>
            </div>
            <div><Label>MOOD</Label>
              <Select value={pf.mood} onChange={e=>setPf(f=>({...f,mood:e.target.value}))} dark>
                {MOODS.map(m=><option key={m} value={m}>{MOOD_EM[m]} {m}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ marginBottom:9 }}>
            <textarea value={pf.text} onChange={e=>setPf(f=>({...f,text:e.target.value}))} placeholder="Share a moment…" rows={3}
              style={{ width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${S.border}`,background:S.bg,color:S.text,fontSize:12,resize:"none" }} />
          </div>
          {pf.photo&&<img src={pf.photo} alt="" style={{ width:"100%",borderRadius:8,maxHeight:130,objectFit:"cover",marginBottom:8 }} />}
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            <PhotoUpload onPhoto={url=>setPf(f=>({...f,photo:url}))} dark />
            {pf.photo&&<Btn small color={S.red} ghost onClick={()=>setPf(f=>({...f,photo:null}))}>✕ Remove</Btn>}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn color={S.accent} onClick={submitPost}>Post Update</Btn>
            <Btn color={S.muted} ghost onClick={()=>setShowPost(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Invite Modal ── */}
      <Modal open={showInvite} onClose={()=>setShowInvite(false)} dark>
        <div style={{ color:S.text }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,color:S.green,marginBottom:6 }}>Invite a Family</div>
          <p style={{ fontSize:11,color:S.muted,marginBottom:14,lineHeight:1.5 }}>The email address you enter will become the <strong style={{ color:S.accent }}>family admin</strong> — they can add other members and manage access levels.</p>
          {[
            {k:"familyName",l:"FAMILY NAME",p:"e.g. The Johnson Family"},
            {k:"email",l:"ADMIN EMAIL (becomes family admin)",p:"parent@example.com"},
            {k:"childrenStr",l:"CHILDREN'S NAMES (comma separated)",p:"e.g. Emma, Jack"},
          ].map(f=>(
            <div key={f.k} style={{ marginBottom:10 }}><Label>{f.l}</Label><Input value={inv[f.k]} onChange={e=>setInv(i=>({...i,[f.k]:e.target.value}))} placeholder={f.p} dark /></div>
          ))}
          <div style={{ background:`${S.green}11`,border:`1px solid ${S.green}33`,borderRadius:8,padding:"9px 11px",fontSize:10,color:S.green,marginBottom:14,lineHeight:1.5 }}>
            🔒 <strong>Privacy:</strong> Once they join, the family admin controls who can view their family's data. Parents and members can only see their own family's updates, messages, and invoices.
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn color={S.green} onClick={submitInvite}>Send Invite</Btn>
            <Btn color={S.muted} ghost onClick={()=>setShowInvite(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Invoice Modal ── */}
      <Modal open={showInvoice} onClose={()=>setShowInvoice(false)} dark>
        <div style={{ color:S.text }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,color:S.accent,marginBottom:14 }}>New Invoice</div>
          <div style={{ marginBottom:9 }}><Label>FAMILY</Label>
            <Select value={ivf.familyId} onChange={e=>setIvf(f=>({...f,familyId:e.target.value}))} dark>
              {activeFams.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:9 }}>
            {[{v:"hourly",l:"Hourly Rate"},{v:"tuition",l:"Flat Tuition"}].map(t=>(
              <div key={t.v} onClick={()=>setIvf(f=>({...f,type:t.v}))}
                style={{ flex:1,padding:"8px",borderRadius:9,textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:600,
                  background:ivf.type===t.v?S.accent:`${S.accent}18`,color:ivf.type===t.v?S.bg:S.accent,transition:"all 0.15s" }}>{t.l}</div>
            ))}
          </div>
          {ivf.type==="hourly"
            ?<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9 }}>
               <div><Label>HOURS</Label><Input type="number" value={ivf.hours} onChange={e=>setIvf(f=>({...f,hours:e.target.value}))} dark /></div>
               <div><Label>RATE ($/hr)</Label><Input type="number" value={ivf.rate} onChange={e=>setIvf(f=>({...f,rate:e.target.value}))} dark /></div>
             </div>
            :<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9 }}>
               <div><Label>PERIOD</Label>
                 <Select value={ivf.tuitionPeriod} onChange={e=>setIvf(f=>({...f,tuitionPeriod:e.target.value}))} dark>
                   <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                 </Select>
               </div>
               <div><Label>RATE ($)</Label><Input type="number" value={ivf.tuitionRate} onChange={e=>setIvf(f=>({...f,tuitionRate:e.target.value}))} dark /></div>
             </div>
          }
          <div style={{ marginBottom:9 }}>
            <Label>ADD-ONS / EXTRAS</Label>
            {ivf.extras.map((e,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:6,marginBottom:5 }}>
                <span style={{ flex:1,fontSize:11,color:S.soft }}>{e.label}: +${Number(e.amount).toFixed(2)}</span>
                <button onClick={()=>setIvf(f=>({...f,extras:f.extras.filter((_,j)=>j!==i)}))} style={{ background:"none",border:"none",color:S.red,cursor:"pointer" }}>✕</button>
              </div>
            ))}
            <div style={{ display:"flex",gap:6 }}>
              <Input value={ivEx.label} onChange={e=>setIvEx(x=>({...x,label:e.target.value}))} placeholder="Label" dark style={{ flex:2 }} />
              <Input type="number" value={ivEx.amount} onChange={e=>setIvEx(x=>({...x,amount:e.target.value}))} placeholder="$" dark style={{ flex:1 }} />
              <Btn small color={S.accent} ghost onClick={()=>{ if(ivEx.label&&ivEx.amount){setIvf(f=>({...f,extras:[...f.extras,ivEx]}));setIvEx({label:"",amount:""});} }}>+ Add</Btn>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9 }}>
            <div><Label>DUE DATE</Label><Input type="date" value={ivf.dueDate} onChange={e=>setIvf(f=>({...f,dueDate:e.target.value}))} dark /></div>
            <div><Label>NOTE</Label><Input value={ivf.note} onChange={e=>setIvf(f=>({...f,note:e.target.value}))} placeholder="e.g. Week of Feb 17" dark /></div>
          </div>
          <div style={{ background:`${S.accent}18`,borderRadius:9,padding:"9px 13px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:11,color:S.muted }}>Total</span>
            <span style={{ fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,color:S.accent }}>${invoiceTotal(ivf).toFixed(2)}</span>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn color={S.accent} onClick={submitInvoice}>Send Invoice</Btn>
            <Btn color={S.muted} ghost onClick={()=>setShowInvoice(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Child Profile (read-only for sitter) ── */}
      <ChildProfileModal
        open={!!sitterViewingChild}
        child={sitterViewingChild ? db.children[sitterViewingChild] : null}
        onClose={()=>setSitterViewingChild(null)}
        onSave={()=>{}}
        canEdit={false}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHILD PROFILE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ChildProfileModal({ child, open, onClose, onSave, canEdit }) {
  const [form, setForm] = useState(null);
  const [activeSection, setActiveSection] = useState("basics");
  const [newAllergy, setNewAllergy] = useState("");
  const [newMed, setNewMed] = useState({ name:"", dose:"", instructions:"" });
  const [newContact, setNewContact] = useState({ name:"", relation:"", phone:"" });
  const photoRef = useRef();

  useEffect(()=>{ if (child && open) setForm({ ...child }); }, [child, open]);
  if (!open || !form) return null;

  const CHILD_AVATARS = ["🌸","🐻","🦁","🌙","🐬","🦊","🐯","🐧","🌺","🦋","⭐","🎠"];
  const CHILD_COLORS  = ["#C8A96E","#6AAF7B","#D96B6B","#8B78D4","#5A9E8F","#D4885A","#6A8FD4","#C86A8F"];

  function calcAge(dob) {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25*24*60*60*1000));
  }

  function handleSave() {
    const age = calcAge(form.dob) ?? form.age;
    onSave({ ...form, age, lastUpdated: new Date().toISOString().slice(0,10) });
    onClose();
  }

  function handlePhoto(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setForm(x=>({...x, photo:ev.target.result}));
    r.readAsDataURL(f);
  }

  const SECTIONS = [
    { id:"basics",   label:"Basics",    icon:"👤" },
    { id:"health",   label:"Health",    icon:"🏥" },
    { id:"emergency",label:"Emergency", icon:"🚨" },
    { id:"notes",    label:"Notes",     icon:"📝" },
  ];

  const inp = (key, placeholder, type="text", opts={}) => (
    <input type={type} value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
      placeholder={placeholder} disabled={!canEdit}
      style={{ width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${P.border}`,
        background:canEdit?P.bg:"#F8F8F8",color:canEdit?P.text:"#888",fontSize:12,...(opts.style||{}) }} />
  );

  const textarea = (key, placeholder, rows=3) => (
    <textarea value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
      placeholder={placeholder} disabled={!canEdit} rows={rows}
      style={{ width:"100%",padding:"8px 11px",borderRadius:8,border:`1px solid ${P.border}`,
        background:canEdit?P.bg:"#F8F8F8",color:canEdit?P.text:"#888",fontSize:12,resize:"vertical" }} />
  );

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"#00000077",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div onClick={e=>e.stopPropagation()} className="pop-in"
        style={{ background:P.card,borderRadius:20,width:"100%",maxWidth:520,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px #00000055" }}>

        {/* Header */}
        <div style={{ padding:"20px 22px 0",flexShrink:0 }}>
          <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:16 }}>
            {/* Photo + avatar */}
            <div style={{ position:"relative",flexShrink:0 }}>
              <div style={{ width:72,height:72,borderRadius:16,overflow:"hidden",background:`${form.color}22`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,
                border:`3px solid ${form.color}55` }}>
                {form.photo
                  ? <img src={form.photo} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  : form.avatar}
              </div>
              {canEdit && (
                <>
                  <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto} />
                  <div onClick={()=>photoRef.current.click()}
                    style={{ position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:"50%",
                      background:P.violet,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,cursor:"pointer",boxShadow:"0 2px 6px #00000033",color:"#fff" }}>📷</div>
                </>
              )}
            </div>

            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} disabled={!canEdit}
                  style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,border:"none",
                    background:"transparent",color:P.text,width:"100%",outline:"none",
                    borderBottom:canEdit?`2px solid ${P.violet}44`:"2px solid transparent",paddingBottom:2 }} />
              </div>
              {/* Avatar picker */}
              {canEdit && (
                <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:6 }}>
                  {CHILD_AVATARS.map(a=>(
                    <div key={a} onClick={()=>setForm(f=>({...f,avatar:a,photo:null}))}
                      style={{ width:26,height:26,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:15,cursor:"pointer",background:form.avatar===a&&!form.photo?`${P.violet}22`:"#F0EAE0",
                        border:form.avatar===a&&!form.photo?`2px solid ${P.violet}`:"2px solid transparent" }}>{a}</div>
                  ))}
                </div>
              )}
              {/* Color picker */}
              {canEdit && (
                <div style={{ display:"flex",gap:5 }}>
                  {CHILD_COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:18,height:18,borderRadius:"50%",cursor:"pointer",background:c,
                        border:form.color===c?"3px solid #333":"3px solid transparent",
                        boxShadow:form.color===c?"0 0 0 1px #ccc":"none" }} />
                  ))}
                </div>
              )}
            </div>

            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:20,cursor:"pointer",color:P.muted,padding:4 }}>✕</button>
          </div>

          {/* Section tabs */}
          <div style={{ display:"flex",borderBottom:`1px solid ${P.border}`,marginBottom:0 }}>
            {SECTIONS.map(s=>(
              <div key={s.id} onClick={()=>setActiveSection(s.id)}
                style={{ flex:1,padding:"8px 4px",textAlign:"center",cursor:"pointer",fontSize:10,fontWeight:700,
                  color:activeSection===s.id?P.violet:P.muted,
                  borderBottom:activeSection===s.id?`2px solid ${P.violet}`:"2px solid transparent",
                  transition:"all 0.15s" }}>
                {s.icon} {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex:1,overflowY:"auto",padding:"16px 22px" }}>

          {/* ── BASICS ── */}
          {activeSection==="basics" && <>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
              <div><Label color={P.muted}>DATE OF BIRTH</Label>{inp("dob","","date")}</div>
              <div><Label color={P.muted}>AGE (auto)</Label>
                <div style={{ padding:"8px 11px",borderRadius:8,background:"#F8F8F8",fontSize:12,color:P.muted,border:`1px solid ${P.border}` }}>
                  {calcAge(form.dob)!=null ? `${calcAge(form.dob)} years old` : form.age ? `${form.age} years old` : "—"}
                </div>
              </div>
            </div>
            <div style={{ marginBottom:10 }}><Label color={P.muted}>DIETARY RESTRICTIONS</Label>{textarea("dietaryRestrictions","e.g. No peanuts, vegetarian…",2)}</div>
          </>}

          {/* ── HEALTH ── */}
          {activeSection==="health" && <>
            {/* Allergies */}
            <div style={{ marginBottom:14 }}>
              <Label color={P.muted}>ALLERGIES</Label>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {(form.allergies||[]).length===0 && <span style={{ fontSize:12,color:P.muted,fontStyle:"italic" }}>No allergies listed</span>}
                {(form.allergies||[]).map((a,i)=>(
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:4,background:"#FFE8E8",borderRadius:20,padding:"3px 10px",border:"1px solid #FFB0B0" }}>
                    <span style={{ fontSize:12,fontWeight:600,color:"#B03A3A" }}>⚠️ {a}</span>
                    {canEdit && <button onClick={()=>setForm(f=>({...f,allergies:f.allergies.filter((_,j)=>j!==i)}))}
                      style={{ background:"none",border:"none",cursor:"pointer",color:"#B03A3A",fontSize:13,lineHeight:1,padding:0 }}>×</button>}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div style={{ display:"flex",gap:7 }}>
                  <input value={newAllergy} onChange={e=>setNewAllergy(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&newAllergy.trim()){ setForm(f=>({...f,allergies:[...(f.allergies||[]),newAllergy.trim()]})); setNewAllergy(""); }}}
                    placeholder="Add allergy (press Enter)"
                    style={{ flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${P.border}`,fontSize:12 }} />
                  <Btn small color={P.red} onClick={()=>{ if(newAllergy.trim()){ setForm(f=>({...f,allergies:[...(f.allergies||[]),newAllergy.trim()]})); setNewAllergy(""); }}}>+ Add</Btn>
                </div>
              )}
            </div>

            {/* Medications */}
            <div style={{ marginBottom:14 }}>
              <Label color={P.muted}>MEDICATIONS</Label>
              {(form.medications||[]).map((m,i)=>(
                <div key={i} style={{ background:"#FFF8EC",borderRadius:10,padding:"10px 12px",marginBottom:7,border:"1px solid #F0D890",position:"relative" }}>
                  <div style={{ fontWeight:700,fontSize:12,color:"#7A5A10",marginBottom:2 }}>💊 {m.name}</div>
                  <div style={{ fontSize:11,color:"#8A6A20" }}>Dose: {m.dose}</div>
                  <div style={{ fontSize:11,color:"#6A5010",marginTop:2,lineHeight:1.4 }}>{m.instructions}</div>
                  {canEdit && <button onClick={()=>setForm(f=>({...f,medications:f.medications.filter((_,j)=>j!==i)}))}
                    style={{ position:"absolute",top:8,right:8,background:"none",border:"none",cursor:"pointer",color:"#B07A20",fontSize:14 }}>✕</button>}
                </div>
              ))}
              {(form.medications||[]).length===0 && <div style={{ fontSize:12,color:P.muted,fontStyle:"italic",marginBottom:8 }}>No medications listed</div>}
              {canEdit && (
                <div style={{ background:P.lavender,borderRadius:10,padding:12,border:`1px solid ${P.violet}22` }}>
                  <div style={{ fontSize:10,fontWeight:700,color:P.violet,marginBottom:8 }}>ADD MEDICATION</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7 }}>
                    <div><Label color={P.muted}>NAME</Label><input value={newMed.name} onChange={e=>setNewMed(m=>({...m,name:e.target.value}))} placeholder="e.g. EpiPen" style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11 }} /></div>
                    <div><Label color={P.muted}>DOSE</Label><input value={newMed.dose} onChange={e=>setNewMed(m=>({...m,dose:e.target.value}))} placeholder="e.g. 0.15mg" style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11 }} /></div>
                  </div>
                  <div style={{ marginBottom:7 }}><Label color={P.muted}>INSTRUCTIONS</Label><textarea value={newMed.instructions} onChange={e=>setNewMed(m=>({...m,instructions:e.target.value}))} placeholder="When and how to administer…" rows={2} style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11,resize:"none" }} /></div>
                  <Btn small color={P.violet} onClick={()=>{ if(newMed.name.trim()){ setForm(f=>({...f,medications:[...(f.medications||[]),{...newMed}]})); setNewMed({name:"",dose:"",instructions:""}); }}}>+ Add Medication</Btn>
                </div>
              )}
            </div>

            <div style={{ marginBottom:10 }}><Label color={P.muted}>OTHER MEDICAL NOTES</Label>{textarea("medicalNotes","Conditions, doctor info, health history…",3)}</div>
          </>}

          {/* ── EMERGENCY ── */}
          {activeSection==="emergency" && <>
            <div style={{ marginBottom:14 }}>
              <Label color={P.muted}>EMERGENCY CONTACTS</Label>
              {(form.emergencyContacts||[]).map((c,i)=>(
                <div key={i} style={{ background:"#F0F8FF",borderRadius:10,padding:"10px 12px",marginBottom:7,border:"1px solid #B0D4F0",display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:"50%",background:"#B0D4F022",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>🚨</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700,fontSize:12 }}>{c.name}</div>
                    <div style={{ fontSize:11,color:P.muted }}>{c.relation}</div>
                    <div style={{ fontSize:12,color:P.teal,fontWeight:600 }}>📞 {c.phone}</div>
                  </div>
                  {canEdit && <button onClick={()=>setForm(f=>({...f,emergencyContacts:f.emergencyContacts.filter((_,j)=>j!==i)}))}
                    style={{ background:"none",border:"none",cursor:"pointer",color:P.muted,fontSize:15 }}>✕</button>}
                </div>
              ))}
              {(form.emergencyContacts||[]).length===0 && <div style={{ fontSize:12,color:P.muted,fontStyle:"italic",marginBottom:8 }}>No emergency contacts added</div>}
              {canEdit && (
                <div style={{ background:P.lavender,borderRadius:10,padding:12,border:`1px solid ${P.violet}22` }}>
                  <div style={{ fontSize:10,fontWeight:700,color:P.violet,marginBottom:8 }}>ADD EMERGENCY CONTACT</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7 }}>
                    <div><Label color={P.muted}>NAME</Label><input value={newContact.name} onChange={e=>setNewContact(c=>({...c,name:e.target.value}))} placeholder="Full name" style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11 }} /></div>
                    <div><Label color={P.muted}>RELATIONSHIP</Label><input value={newContact.relation} onChange={e=>setNewContact(c=>({...c,relation:e.target.value}))} placeholder="e.g. Grandmother" style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11 }} /></div>
                  </div>
                  <div style={{ marginBottom:7 }}><Label color={P.muted}>PHONE</Label><input value={newContact.phone} onChange={e=>setNewContact(c=>({...c,phone:e.target.value}))} placeholder="555-000-0000" style={{ width:"100%",padding:"6px 9px",borderRadius:7,border:`1px solid ${P.border}`,fontSize:11 }} /></div>
                  <Btn small color={P.violet} onClick={()=>{ if(newContact.name.trim()){ setForm(f=>({...f,emergencyContacts:[...(f.emergencyContacts||[]),{...newContact}]})); setNewContact({name:"",relation:"",phone:""}); }}}>+ Add Contact</Btn>
                </div>
              )}
            </div>
          </>}

          {/* ── NOTES ── */}
          {activeSection==="notes" && <>
            <div style={{ marginBottom:12 }}><Label color={P.muted}>BEHAVIORAL NOTES</Label>{textarea("behavioralNotes","Comfort items, triggers, routines, what works…",4)}</div>
            <div style={{ marginBottom:12 }}><Label color={P.muted}>DIETARY RESTRICTIONS</Label>{textarea("dietaryRestrictions","Specific foods to avoid, meal preferences…",3)}</div>
            {form.lastUpdated && <div style={{ fontSize:10,color:P.soft,marginTop:8 }}>Last updated {fmtDate(form.lastUpdated)}</div>}
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 22px",borderTop:`1px solid ${P.border}`,display:"flex",gap:8,flexShrink:0 }}>
          {canEdit
            ? <><button onClick={handleSave} style={{ flex:1,background:`linear-gradient(135deg,${P.violet},#3B2A6E)`,border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"'Outfit'" }}>Save Profile</button>
               <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${P.border}`,borderRadius:10,padding:"11px 16px",fontSize:13,color:P.muted,cursor:"pointer",fontFamily:"'Outfit'" }}>Cancel</button></>
            : <button onClick={onClose} style={{ flex:1,background:P.lavender,border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:600,color:P.violet,cursor:"pointer",fontFamily:"'Outfit'" }}>Close</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Child Profile Card (compact, clickable) ───────────────────────────────────
function ChildProfileCard({ child, onClick, showAlerts=true }) {
  const ci_status = null; // passed in from parent if needed
  const hasAllergies = (child.allergies||[]).length > 0;
  const hasMeds = (child.medications||[]).length > 0;
  return (
    <div onClick={onClick} style={{
      background:P.card, borderRadius:14, padding:14, cursor:"pointer",
      border:`1px solid ${hasAllergies?"#FFB0B055":P.border}`,
      boxShadow:`0 2px 10px #00000008`,
      transition:"all 0.15s",
    }}>
      <div style={{ display:"flex",gap:12,alignItems:"center" }}>
        {/* Photo / avatar */}
        <div style={{ width:52,height:52,borderRadius:12,overflow:"hidden",background:`${child.color}22`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0,
          border:`2px solid ${child.color}55` }}>
          {child.photo ? <img src={child.photo} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : child.avatar}
        </div>

        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:P.text }}>{child.name}</div>
          <div style={{ fontSize:11,color:P.muted }}>
            {child.dob ? `Born ${fmtDate(child.dob)} · ` : ""}{child.age} yrs old
          </div>
          {/* Alert badges */}
          {showAlerts && (
            <div style={{ display:"flex",gap:5,marginTop:5,flexWrap:"wrap" }}>
              {hasAllergies && <span style={{ fontSize:9,fontWeight:700,background:"#FFE8E8",color:"#B03A3A",padding:"2px 7px",borderRadius:20,border:"1px solid #FFB0B0" }}>⚠️ {child.allergies.join(", ")}</span>}
              {hasMeds && <span style={{ fontSize:9,fontWeight:700,background:"#FFF8EC",color:"#7A5A10",padding:"2px 7px",borderRadius:20,border:"1px solid #F0D890" }}>💊 {child.medications.length} med{child.medications.length!==1?"s":""}</span>}
              {(child.emergencyContacts||[]).length>0 && <span style={{ fontSize:9,fontWeight:600,background:"#F0F8FF",color:"#3A6A9A",padding:"2px 7px",borderRadius:20,border:"1px solid #B0D4F0" }}>🚨 {child.emergencyContacts.length} contact{child.emergencyContacts.length!==1?"s":""}</span>}
            </div>
          )}
        </div>
        <div style={{ color:P.muted,fontSize:16 }}>›</div>
      </div>
    </div>
  );
}


function ParentApp({ db, setDb, pushNotif }) {
  const [activeMemberId, setActiveMemberId] = useState("m1");
  const [tab, setTab] = useState("feed");
  const [msgInput, setMsgInput] = useState("");
  const [editingChild, setEditingChild] = useState(null); // childId being edited/viewed
  const msgEnd = useRef();

  const me       = db.members[activeMemberId];
  const familyId = me?.familyId;
  const family   = db.families[familyId];

  // PRIVACY SCOPE — everything filtered to my family only
  const myChildren = Object.values(db.children).filter(c=>c.familyId===familyId);
  const myMembers  = Object.values(db.members).filter(m=>m.familyId===familyId);
  const myPosts    = Object.values(db.posts).filter(p=>p.familyId===familyId).sort((a,b)=>b.pinned-a.pinned||b.timestamp-a.timestamp);
  const myMessages = db.messages[familyId]||[];
  const myInvoices = (db.invoices||[]).filter(i=>i.familyId===familyId);

  const iAmAdmin   = me?.role==="admin";
  const canFeed    = CAN.viewFeed(me?.role);
  const canMsg     = CAN.sendMessage(me?.role);
  const canCheckin = CAN.checkInOut(me?.role);

  useEffect(()=>{ msgEnd.current?.scrollIntoView({behavior:"smooth"}); },[db.messages,familyId,tab]);

  function sendMsg() {
    if (!canMsg||!msgInput.trim()) return;
    const msg = { id:`msg_${uid()}`, from:activeMemberId, fromName:me?.name.split(" ")[0], text:msgInput, ts:Date.now() };
    setDb(d=>({ ...d, messages:{ ...d.messages, [familyId]:[...(d.messages[familyId]||[]),msg] } }));
    pushNotif({ side:"sitter", icon:"💬", title:`Message from ${me?.name.split(" ")[0]}`, body:msgInput.slice(0,55) });
    setMsgInput("");
  }

  function toggleLike(postId) {
    if (!canFeed) return;
    setDb(d=>{ const p=d.posts[postId]; const likes={...p.likes}; likes[activeMemberId]?delete likes[activeMemberId]:likes[activeMemberId]=true; return {...d,posts:{...d.posts,[postId]:{...p,likes}}}; });
  }

  function toggleCheckin(childId) {
    if (!canCheckin) return;
    setDb(d=>{ const ci=d.checkins[childId]; const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
      return {...d,checkins:{...d.checkins,[childId]:{status:ci?.status==="in"?"out":"in",time:now}}}; });
    pushNotif({ side:"sitter", icon:"✅", title:`${db.children[childId]?.name} checked ${db.checkins[childId]?.status==="in"?"out":"in"}`, body:`By ${me?.name.split(" ")[0]} · ${me?.role}` });
  }

  function uploadPhoto(url) {
    const post = { id:`post_${uid()}`, familyId, childIds:myChildren.map(c=>c.id), authorRole:"parent",
      type:"photo", text:`📸 Shared by ${me?.name.split(" ")[0]}`, photo:url, timestamp:Date.now(), likes:{}, mood:"happy", pinned:false };
    setDb(d=>({...d,posts:{...d.posts,[post.id]:post}}));
    pushNotif({ side:"sitter", icon:"📸", title:`${me?.name.split(" ")[0]} shared a photo`, body:"New photo from the family!" });
  }

  function addPayment(invoiceId, payment) {
    setDb(d=>({ ...d, invoices:d.invoices.map(i=>{
      if(i.id!==invoiceId) return i;
      return { ...i, payments:[...(i.payments||[]), payment] };
    })}));
    pushNotif({ side:"sitter", icon:"💵", title:`Payment received from ${me?.name.split(" ")[0]}`, body:`$${payment.amount.toFixed(2)} via ${payment.method}` });
  }

  function saveChildProfile(updated) {
    setDb(d=>({ ...d, children:{ ...d.children, [updated.id]:updated } }));
    pushNotif({ side:"sitter", icon:"👶", title:`${updated.name}'s profile updated`, body:`Updated by ${me?.name.split(" ")[0]}` });
  }

  const allMembers = Object.values(db.members);
  const navItems = [
    {id:"feed",    icon:"🌸", label:"Updates",  show:canFeed},
    {id:"children",icon:"👶", label:"Children", show:canFeed||canCheckin},
    {id:"messages",icon:"💬", label:"Chat",     show:canMsg},
    {id:"checkin", icon:"✅", label:"Check In",  show:canCheckin},
    {id:"members", icon:"👨‍👩‍👧",label:"Family",  show:true},
    {id:"invoices",icon:"💳", label:"Invoices", show:iAmAdmin||["admin","member"].includes(me?.role)},
  ].filter(n=>n.show);

  // Auto-select first available tab when switching members
  useEffect(()=>{
    if (!navItems.find(n=>n.id===tab)) setTab(navItems[0]?.id||"members");
  },[activeMemberId]);

  const unreadMsg  = myMessages.length>0 && myMessages[myMessages.length-1]?.from==="sitter";
  const unpaidInv  = myInvoices.filter(i=>i.status==="unpaid").length;

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",background:P.bg,color:P.text,fontFamily:"'Outfit',sans-serif" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#2E1F66,#5A3F9E)`,padding:"12px 16px" }}>
        {/* Member switcher */}
        <div style={{ display:"flex",gap:5,marginBottom:10,flexWrap:"wrap" }}>
          {allMembers.map(m=>{
            const r=ROLES[m.role];
            return (
              <div key={m.id} onClick={()=>setActiveMemberId(m.id)} title={`${m.name} · ${r.label}`}
                style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:20,cursor:"pointer",
                  background:activeMemberId===m.id?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.06)",
                  border:`1px solid ${activeMemberId===m.id?"rgba(255,255,255,0.4)":"transparent"}`,
                  transition:"all 0.15s" }}>
                <span style={{ fontSize:13 }}>{m.avatar}</span>
                <span style={{ fontSize:10,fontWeight:600,color:activeMemberId===m.id?"#fff":"rgba(255,255,255,0.5)" }}>
                  {m.name.split(" ")[0]}
                </span>
                <span style={{ fontSize:9,padding:"1px 5px",borderRadius:20,background:`${r.color}44`,color:r.color,fontWeight:700 }}>{r.icon}</span>
                {m.familyId&&<span style={{ width:5,height:5,borderRadius:"50%",background:db.families[m.familyId]?.status==="active"?"#3A9E7A":"#888" }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,color:"#fff",fontWeight:700 }}>
              {me?.name.split(" ")[0]} · <span style={{ color:ROLES[me?.role]?.color,fontSize:13 }}>{ROLES[me?.role]?.icon} {ROLES[me?.role]?.label}</span>
            </div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1 }}>{family?.name} · {myChildren.map(c=>c.name).join(", ")}</div>
          </div>
          {canFeed && <PhotoUpload onPhoto={uploadPhoto} small />}
        </div>
      </div>

      {/* Children pills */}
      <div style={{ display:"flex",gap:7,padding:"9px 14px",background:P.card,borderBottom:`1px solid ${P.border}`,flexWrap:"wrap" }}>
        {myChildren.map(k=>{
          const ci = db.checkins[k.id];
          return (
            <div key={k.id} style={{ display:"flex",alignItems:"center",gap:5,background:`${k.color}15`,borderRadius:20,padding:"4px 11px" }}>
              <span style={{ fontSize:13 }}>{k.avatar}</span>
              <span style={{ fontSize:11,fontWeight:600,color:k.color }}>{k.name}, {k.age}</span>
              <span style={{ fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:20,background:ci?.status==="in"?"#4E9E8A22":"#99999922",color:ci?.status==="in"?P.teal:P.muted }}>
                {ci?.status==="in"?"✅ In":"🚪 Out"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Nav */}
      <div style={{ display:"flex",borderBottom:`1px solid ${P.border}`,background:P.card }}>
        {navItems.map(n=>(
          <div key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1,padding:"9px 0",textAlign:"center",cursor:"pointer",
            fontSize:10,fontWeight:600,
            color:tab===n.id?P.violet:P.muted,
            borderBottom:tab===n.id?`2px solid ${P.violet}`:"2px solid transparent",
            transition:"all 0.15s",position:"relative",
          }}>
            {n.icon} {n.label}
            {n.id==="messages"&&unreadMsg&&<span style={{ position:"absolute",top:5,right:"10%",width:6,height:6,borderRadius:"50%",background:P.violet }} />}
            {n.id==="invoices"&&unpaidInv>0&&<span style={{ position:"absolute",top:5,right:"5%",background:P.accent,color:"#fff",borderRadius:20,fontSize:8,fontWeight:700,padding:"1px 4px" }}>{unpaidInv}</span>}
          </div>
        ))}
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:14 }}>
        {/* ── FEED ── */}
        {tab==="feed"&&canFeed&&<>
          {myPosts.length===0&&<div style={{ textAlign:"center",padding:"40px 0",color:P.muted,fontSize:12 }}>🌱 No updates yet!</div>}
          {myPosts.map((post,i)=>{
            const kids=post.childIds.map(id=>db.children[id]).filter(Boolean);
            const liked=!!post.likes[activeMemberId];
            const likeCount=Object.values(post.likes).filter(Boolean).length;
            return (
              <div key={post.id} className="fade-in" style={{ background:P.card,borderRadius:14,padding:15,marginBottom:11,
                boxShadow:`0 2px 12px ${post.pinned?"#5A3F9E1A":"#00000008"}`,
                border:`1px solid ${post.pinned?"#B49FE8":P.border}`, animationDelay:`${i*.05}s` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                    <div style={{ width:24,height:24,borderRadius:"50%",background:post.authorRole==="sitter"?"linear-gradient(135deg,#3A6FD4,#3A9E7A)":"rgba(90,63,158,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>
                      {post.authorRole==="sitter"?"🌿":me?.avatar}
                    </div>
                    <div>
                      <span style={{ fontSize:11,fontWeight:700 }}>{post.authorRole==="sitter"?"Maya":me?.name.split(" ")[0]}</span>
                      <span style={{ fontSize:10,color:P.muted }}> · {timeAgo(post.timestamp)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                    <span style={{ fontSize:9,background:`${P.teal}18`,color:P.teal,padding:"2px 7px",borderRadius:20,fontWeight:600 }}>{POST_TYPES[post.type]?.icon} {POST_TYPES[post.type]?.label}</span>
                    {post.pinned&&<span style={{ fontSize:10,color:"#B49FE8" }}>📌</span>}
                  </div>
                </div>
                {kids.length>0&&<div style={{ display:"flex",gap:4,marginBottom:7 }}>
                  {kids.map(k=><span key={k.id} style={{ fontSize:10,background:`${k.color}18`,color:k.color,padding:"2px 8px",borderRadius:20,fontWeight:600 }}>{k.avatar} {k.name}</span>)}
                </div>}
                {post.photo&&<img src={post.photo} alt="" style={{ width:"100%",borderRadius:9,maxHeight:170,objectFit:"cover",marginBottom:9 }} />}
                <p style={{ fontFamily:"'Playfair Display',serif",fontSize:13,lineHeight:1.7,color:P.text,marginBottom:10,fontStyle:"italic" }}>"{post.text}"</p>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <span style={{ fontSize:11,color:P.muted }}>{MOOD_EM[post.mood]} <b>{post.mood}</b></span>
                  <button onClick={()=>toggleLike(post.id)} style={{
                    display:"flex",alignItems:"center",gap:4,
                    background:liked?`${P.violet}18`:"transparent",border:`1px solid ${liked?"#B49FE8":P.border}`,
                    borderRadius:20,padding:"4px 11px",cursor:"pointer",fontSize:11,fontWeight:600,
                    color:liked?P.violet:P.muted,transition:"all 0.15s",fontFamily:"'Outfit'",
                  }}>{liked?"💜":"🤍"} {likeCount>0?likeCount:""} {liked?"Loved":"Love"}</button>
                </div>
              </div>
            );
          })}
        </>}

        {/* ── CHILDREN PROFILES ── */}
        {tab==="children"&&<>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,color:P.violet }}>Children</div>
            {!iAmAdmin&&!canFeed&&<div style={{ fontSize:11,color:P.muted }}>View only</div>}
          </div>
          {myChildren.map(k=>(
            <div key={k.id} style={{ marginBottom:10 }}>
              <ChildProfileCard child={k} onClick={()=>setEditingChild(k.id)} />
            </div>
          ))}
          {myChildren.length===0&&<div style={{ textAlign:"center",padding:"40px 0",color:P.muted,fontSize:12 }}>No children added yet</div>}
          <div style={{ fontSize:10,color:P.muted,textAlign:"center",marginTop:4,lineHeight:1.5 }}>
            {iAmAdmin||canFeed
              ? "Tap a child to view or edit their profile, allergies, medications and emergency contacts."
              : "Tap a child to view their profile."}
          </div>
        </>}

        {/* ── CHAT ── */}
        {tab==="messages"&&canMsg&&<>
          <div style={{ background:P.card,borderRadius:12,border:`1px solid ${P.border}`,overflow:"hidden" }}>
            <div style={{ padding:"9px 13px",borderBottom:`1px solid ${P.border}`,display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🌿</div>
              <div><div style={{ fontSize:12,fontWeight:700 }}>Maya Rodriguez</div><div style={{ fontSize:10,color:P.muted }}>Your sitter · {family?.name}</div></div>
              <div style={{ marginLeft:"auto",display:"flex",gap:4 }}>
                {myMembers.filter(m=>CAN.sendMessage(m.role)).map(m=>(
                  <div key={m.id} title={m.name} style={{ width:22,height:22,borderRadius:"50%",background:`${ROLES[m.role].color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11 }}>{m.avatar}</div>
                ))}
              </div>
            </div>
            <div style={{ minHeight:160,maxHeight:300,overflowY:"auto",padding:11,display:"flex",flexDirection:"column",gap:7 }}>
              {myMessages.length===0&&<div style={{ textAlign:"center",color:P.muted,fontSize:11,marginTop:20 }}>💬 Send Maya a message</div>}
              {myMessages.map(msg=>{
                const isMe=msg.from===activeMemberId;
                const isSitter=msg.from==="sitter";
                const sender=db.members[msg.from];
                return (
                  <div key={msg.id} style={{ display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:5 }}>
                    {!isMe&&<div style={{ width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,
                      background:isSitter?"linear-gradient(135deg,#3A6FD4,#3A9E7A)":sender?`${ROLES[sender.role]?.color}22`:"#eee" }}>
                      {isSitter?"🌿":sender?.avatar||"👤"}
                    </div>}
                    <div style={{ maxWidth:"75%",padding:"8px 12px",
                      borderRadius:isMe?"12px 12px 3px 12px":"12px 12px 12px 3px",
                      background:isMe?`linear-gradient(135deg,${P.violet},#3B2A6E)`:isSitter?P.lavender:P.border,
                      color:isMe?"#fff":P.text,fontSize:12,lineHeight:1.5,
                      boxShadow:isMe?`0 2px 8px ${P.violet}44`:"none" }}>
                      {!isMe&&<div style={{ fontSize:9,fontWeight:700,marginBottom:1,opacity:0.6 }}>{isSitter?"Maya":msg.fromName}</div>}
                      {msg.text}
                      <div style={{ fontSize:9,opacity:0.5,marginTop:2,textAlign:isMe?"right":"left" }}>{fmtTime(msg.ts)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEnd} />
            </div>
            <div style={{ padding:9,borderTop:`1px solid ${P.border}`,display:"flex",gap:7 }}>
              <input value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()}
                placeholder="Message Maya…" style={{ flex:1,padding:"7px 10px",borderRadius:9,border:`1px solid ${P.border}`,background:P.bg,color:P.text,fontSize:12 }} />
              <Btn color={P.violet} onClick={sendMsg} small>Send</Btn>
            </div>
          </div>
        </>}

        {/* ── CHECK IN/OUT ── */}
        {tab==="checkin"&&canCheckin&&<>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,color:P.teal,marginBottom:12 }}>Check In / Out</div>
          {myChildren.map(k=>{
            const ci=db.checkins[k.id];
            const isIn=ci?.status==="in";
            return (
              <div key={k.id} className="fade-in" style={{ background:P.card,borderRadius:12,padding:14,marginBottom:9,border:`1px solid ${P.border}`,display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:44,height:44,borderRadius:"50%",background:`${k.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{k.avatar}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,fontSize:14 }}>{k.name}</div>
                  <div style={{ fontSize:11,color:P.muted }}>{isIn?"Checked in":"Last seen"} · {ci?.time||"—"}</div>
                </div>
                <Btn color={isIn?P.muted:P.teal} onClick={()=>toggleCheckin(k.id)} small>
                  {isIn?"🚪 Check Out":"✅ Check In"}
                </Btn>
              </div>
            );
          })}
          <div style={{ fontSize:10,color:P.muted,textAlign:"center",marginTop:8 }}>
            Checking in/out as <strong>{me?.name}</strong> ({ROLES[me?.role]?.label})
          </div>
        </>}

        {/* ── FAMILY MEMBERS ── */}
        {tab==="members"&&(
          <FamilyMembersPanel
            db={db} setDb={setDb}
            familyId={familyId}
            currentMemberId={activeMemberId}
            pushNotif={pushNotif}
          />
        )}

        {/* ── INVOICES ── */}
        {tab==="invoices"&&<>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12,color:P.accent }}>Invoices from Maya</div>
          {myInvoices.length===0&&<div style={{ textAlign:"center",padding:"30px 0",color:P.muted,fontSize:12 }}>No invoices yet</div>}
          {myInvoices.map(inv2=>(
            <InvoiceCard key={inv2.id} invoice={inv2} families={db.families} dark={false} sitterView={false}
              onAddPayment={addPayment} onMarkPaid={()=>{}}
              onExportPDF={inv=>exportInvoicePDF({ invoice:inv, familyName:family?.name||"My Family", sitterName:"Maya Rodriguez", mode:"parent" })} />
          ))}
        </>}

        {/* ── ROLE RESTRICTION NOTICE ── */}
        {tab==="feed"&&!canFeed&&(
          <div style={{ textAlign:"center",padding:"50px 20px",color:P.muted }}>
            <div style={{ fontSize:36,marginBottom:12 }}>🚗</div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:8 }}>Pickup Access Only</div>
            <div style={{ fontSize:12,lineHeight:1.6 }}>As a <strong>{ROLES[me?.role]?.label}</strong>, your access is limited to checking children in and out. Contact the family admin to request additional access.</div>
          </div>
        )}
      </div>

      {/* ── Child Profile Modal ── */}
      <ChildProfileModal
        open={!!editingChild}
        child={editingChild ? db.children[editingChild] : null}
        onClose={()=>setEditingChild(null)}
        onSave={saveChildProfile}
        canEdit={iAmAdmin || me?.role==="member"}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [db, setDb] = useState(INIT);
  const [notifs, setNotifs] = useState([]);

  function pushNotif({ side, icon, title, body }) {
    const id = uid();
    setNotifs(n=>[...n,{id,side,icon,title,body}]);
    setTimeout(()=>{ setNotifs(n=>n.map(x=>x.id===id?{...x,leaving:true}:x)); setTimeout(()=>setNotifs(n=>n.filter(x=>x.id!==id)),350); },4200);
  }
  function dismissNotif(id) {
    setNotifs(n=>n.map(x=>x.id===id?{...x,leaving:true}:x));
    setTimeout(()=>setNotifs(n=>n.filter(x=>x.id!==id)),350);
  }

  return (
    <>
      <style>{GS}</style>
      <NotifToast notifs={notifs} dismiss={dismissNotif} />
      <div style={{ display:"flex",height:"100vh",overflow:"hidden",background:"#111" }}>
        {/* Sitter */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          <div style={{ background:"#D8E4F4",padding:"4px 13px",display:"flex",alignItems:"center",gap:6,borderBottom:`1px solid ${S.border}` }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:S.green,display:"inline-block" }} />
            <span style={{ fontSize:9,color:S.muted,fontWeight:700,letterSpacing:1.1,textTransform:"uppercase" }}>Sitter View · Maya</span>
          </div>
          <div style={{ flex:1,overflow:"hidden" }}><SitterApp db={db} setDb={setDb} pushNotif={pushNotif} /></div>
        </div>
        {/* Divider */}
        <div style={{ width:2,background:"linear-gradient(to bottom,#3A6FD4,#5A3F9E,#3A9E7A)",flexShrink:0 }} />
        {/* Parent */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          <div style={{ background:"#2E1F66",padding:"4px 13px",display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#B49FE8",display:"inline-block" }} />
            <span style={{ fontSize:9,color:"#B49FE8",fontWeight:700,letterSpacing:1.1,textTransform:"uppercase" }}>Parent View · Privacy Scoped per Family</span>
          </div>
          <div style={{ flex:1,overflow:"hidden" }}><ParentApp db={db} setDb={setDb} pushNotif={pushNotif} /></div>
        </div>
      </div>
    </>
  );
}
