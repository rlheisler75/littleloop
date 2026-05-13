import { useState, useEffect, useRef } from 'react';

export default function LandingPage({ onSitterSignup, onFamilySignup, onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState({});
  const observerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) setVisible(v => ({ ...v, [e.target.dataset.id]: true }));
      }),
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-id]').forEach(el => observerRef.current.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const reveal = (id) => visible[id] ? 'revealed' : 'hidden';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300;1,9..144,500&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --sage: #4A7C65;
          --sage-light: #6BA589;
          --sage-pale: #C8DDD5;
          --cream: #F7F3EE;
          --cream-dark: #EDE7DC;
          --bark: #3D2E22;
          --bark-light: #6B5344;
          --sky: #A8C5D8;
          --gold: #C4963A;
          --text: #2A1F17;
          --muted: #8A7668;
        }

        .ll-landing {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--text);
          overflow-x: hidden;
        }

        /* NAV */
        .ll-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 20px 48px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all .3s ease;
        }
        .ll-nav.scrolled {
          background: rgba(247,243,238,.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(74,124,101,.12);
          padding: 16px 48px;
        }
        .ll-nav-brand { display: flex; flex-direction: column; line-height: 1; padding: 4px 0; }
        .ll-nav-logo { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; color: var(--sage); letter-spacing: -.3px; display: flex; align-items: center; gap: 8px; }
        .ll-logomark { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 300; font-style: italic; color: var(--sage); line-height: 1; }
        .ll-nav-sub { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-top: 4px; padding-left: 34px; }
        .ll-nav-links { display: flex; align-items: center; gap: 32px; }
        .ll-nav-links a { font-size: 14px; color: var(--bark-light); text-decoration: none; transition: color .2s; cursor: pointer; }
        .ll-nav-links a:hover { color: var(--sage); }
        .ll-nav-cta { background: var(--sage); color: #fff; padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; transition: all .2s; }
        .ll-nav-cta:hover { background: var(--sage-light); transform: translateY(-1px); }

        /* HERO */
        .ll-hero {
          min-height: 100vh;
          display: grid; grid-template-columns: 1fr 1fr;
          padding: 0 48px; padding-top: 100px;
          gap: 48px; align-items: center;
          position: relative; overflow: hidden;
        }
        .ll-hero::before {
          content: '';
          position: absolute; top: -200px; right: -200px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(74,124,101,.12) 0%, transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        .ll-hero::after {
          content: '';
          position: absolute; bottom: -100px; left: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(168,197,216,.18) 0%, transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        .ll-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(74,124,101,.1); border: 1px solid rgba(74,124,101,.2);
          padding: 6px 14px; border-radius: 100px; margin-bottom: 24px;
          font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--sage);
        }
        .ll-hero-eyebrow span { width: 6px; height: 6px; background: var(--sage); border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        .ll-hero-title {
          font-family: 'Fraunces', serif;
          font-size: clamp(42px, 5vw, 68px);
          font-weight: 500; line-height: 1.08;
          letter-spacing: -.02em; color: var(--bark);
          margin-bottom: 24px;
        }
        .ll-hero-title em { font-style: italic; color: var(--sage); }
        .ll-hero-desc {
          font-size: 17px; line-height: 1.7; color: var(--muted);
          max-width: 480px; margin-bottom: 40px;
        }
        .ll-hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }
        .ll-btn-primary {
          background: var(--sage); color: #fff;
          padding: 15px 30px; border-radius: 100px;
          font-size: 15px; font-weight: 500; border: none; cursor: pointer;
          transition: all .25s; display: inline-flex; align-items: center; gap: 8px;
        }
        .ll-btn-primary:hover { background: var(--bark); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(74,124,101,.3); }
        .ll-btn-secondary {
          background: transparent; color: var(--bark);
          padding: 15px 30px; border-radius: 100px;
          font-size: 15px; font-weight: 500;
          border: 1.5px solid rgba(61,46,34,.2); cursor: pointer;
          transition: all .25s;
        }
        .ll-btn-secondary:hover { border-color: var(--sage); color: var(--sage); }

        /* Hero visual */
        .ll-hero-visual {
          position: relative; display: flex; justify-content: center; align-items: center;
        }
        .ll-hero-card-stack { position: relative; width: 340px; height: 420px; }
        .ll-profile-card {
          position: absolute; background: #fff;
          border-radius: 20px; padding: 24px;
          box-shadow: 0 20px 60px rgba(61,46,34,.1);
          transition: transform .3s;
        }
        .ll-profile-card:nth-child(1) { width: 300px; top: 0; left: 20px; z-index: 3; }
        .ll-profile-card:nth-child(2) { width: 280px; top: 30px; left: 0; z-index: 2; transform: rotate(-3deg); opacity: .7; }
        .ll-profile-card:nth-child(3) { width: 280px; top: 20px; left: 40px; z-index: 1; transform: rotate(4deg); opacity: .4; }
        .ll-profile-avatar {
          width: 56px; height: 56px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 14px;
          font-family: 'Fraunces', serif; font-weight: 500; color: #fff;
        }
        .ll-profile-name { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; color: var(--bark); margin-bottom: 4px; }
        .ll-profile-detail { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
        .ll-profile-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .ll-badge { font-size: 11px; padding: 4px 10px; border-radius: 100px; font-weight: 500; }
        .ll-badge-green { background: rgba(74,124,101,.1); color: var(--sage); }
        .ll-badge-sky { background: rgba(168,197,216,.3); color: #4A7A9B; }
        .ll-badge-gold { background: rgba(196,150,58,.12); color: var(--gold); }
        .ll-floating-stat {
          position: absolute; background: #fff; border-radius: 14px;
          padding: 12px 16px; box-shadow: 0 8px 24px rgba(61,46,34,.1);
          display: flex; align-items: center; gap: 10px; white-space: nowrap;
        }
        .ll-floating-stat .stat-icon { font-size: 20px; }
        .ll-floating-stat .stat-text { font-size: 12px; color: var(--muted); }
        .ll-floating-stat .stat-val { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 500; color: var(--bark); }
        .ll-stat-1 { bottom: 30px; left: -20px; z-index: 10; animation: float1 4s ease-in-out infinite; }
        .ll-stat-2 { top: 10px; right: -30px; z-index: 10; animation: float2 5s ease-in-out infinite; }
        @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }

        /* SCROLL ANIMATIONS */
        .hidden { opacity: 0; transform: translateY(32px); transition: opacity .7s ease, transform .7s ease; }
        .revealed { opacity: 1; transform: translateY(0); }

        /* SECTION SHARED */
        .ll-section { padding: 100px 48px; }
        .ll-section-label {
          font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
          color: var(--sage); font-weight: 500; margin-bottom: 16px;
        }
        .ll-section-title {
          font-family: 'Fraunces', serif; font-size: clamp(32px, 4vw, 50px);
          font-weight: 500; line-height: 1.1; letter-spacing: -.02em;
          color: var(--bark); margin-bottom: 20px;
        }
        .ll-section-title em { font-style: italic; color: var(--sage); }
        .ll-section-desc { font-size: 16px; line-height: 1.7; color: var(--muted); max-width: 520px; }

        /* SITTER SECTION */
        .ll-sitter { background: var(--bark); color: #fff; }
        .ll-sitter .ll-section-title { color: var(--sage-pale); }
        .ll-sitter .ll-section-title em { color: var(--sage-light); }
        .ll-sitter .ll-section-desc { color: rgba(255,255,255,.6); }
        .ll-sitter .ll-section-label { color: var(--sage-light); }
        .ll-sitter-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center; margin-top: 64px;
        }
        .ll-features { display: flex; flex-direction: column; gap: 28px; }
        .ll-feature { display: flex; gap: 18px; align-items: flex-start; }
        .ll-feature-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: rgba(74,124,101,.2); display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .ll-feature-title { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 500; color: var(--sage-pale); margin-bottom: 6px; }
        .ll-feature-desc { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,.5); }

        /* Pricing card */
        .ll-pricing-card {
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
          border-radius: 24px; padding: 36px; position: relative; overflow: hidden;
        }
        .ll-pricing-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--sage), var(--sky));
        }
        .ll-price-label { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--sage-light); margin-bottom: 20px; }
        .ll-price-options { display: flex; gap: 12px; margin-bottom: 28px; }
        .ll-price-option {
          flex: 1; padding: 16px 14px; border-radius: 14px; text-align: center; cursor: pointer;
          border: 1.5px solid rgba(255,255,255,.1); transition: all .2s; position: relative;
        }
        .ll-price-option.active { border-color: var(--sage-light); background: rgba(74,124,101,.15); }
        .ll-price-option-save {
          position: absolute; top: -10px; right: 8px;
          background: var(--gold); color: #fff; font-size: 9px; font-weight: 700;
          padding: 2px 8px; border-radius: 100px; letter-spacing: .05em;
        }
        .ll-price-per { font-size: 11px; color: rgba(255,255,255,.4); margin-bottom: 4px; }
        .ll-price-amount { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 500; color: #fff; }
        .ll-price-amount span { font-size: 14px; font-weight: 300; color: rgba(255,255,255,.5); }
        .ll-price-features { margin-bottom: 28px; }
        .ll-price-feature { display: flex; gap: 10px; align-items: center; padding: 8px 0; font-size: 14px; color: rgba(255,255,255,.7); border-bottom: 1px solid rgba(255,255,255,.05); }
        .ll-price-feature:last-child { border-bottom: none; }
        .ll-price-check { color: var(--sage-light); font-size: 16px; }
        .ll-trial-note { font-size: 12px; color: rgba(255,255,255,.4); text-align: center; margin-top: 14px; }

        /* FAMILY SECTION */
        .ll-family { background: var(--cream-dark); }
        .ll-family-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center; margin-top: 64px;
        }
        .ll-family-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ll-family-card {
          background: #fff; border-radius: 18px; padding: 24px;
          box-shadow: 0 4px 20px rgba(61,46,34,.06); transition: transform .25s, box-shadow .25s;
        }
        .ll-family-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(61,46,34,.1); }
        .ll-family-card:nth-child(1) { grid-column: span 2; background: var(--sage); color: #fff; }
        .ll-family-card-icon { font-size: 28px; margin-bottom: 14px; }
        .ll-family-card-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500; margin-bottom: 8px; }
        .ll-family-card:nth-child(1) .ll-family-card-title { color: #fff; }
        .ll-family-card-desc { font-size: 13px; line-height: 1.6; color: var(--muted); }
        .ll-family-card:nth-child(1) .ll-family-card-desc { color: rgba(255,255,255,.7); }

        /* HOW IT WORKS */
        .ll-how { background: var(--cream); }
        .ll-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 64px; }
        .ll-step { position: relative; padding: 32px; background: #fff; border-radius: 20px; box-shadow: 0 2px 16px rgba(61,46,34,.05); }
        .ll-step-num {
          font-family: 'Fraunces', serif; font-size: 64px; font-weight: 300;
          color: rgba(74,124,101,.15); line-height: 1; margin-bottom: 16px;
          position: absolute; top: 16px; right: 20px;
        }
        .ll-step-icon { font-size: 28px; margin-bottom: 14px; }
        .ll-step-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; color: var(--bark); margin-bottom: 10px; }
        .ll-step-desc { font-size: 14px; line-height: 1.6; color: var(--muted); }

        /* FOOTER */
        .ll-footer {
          background: var(--bark); color: rgba(255,255,255,.5);
          padding: 48px; display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 20px;
        }
        .ll-footer-brand .ll-nav-logo { font-size: 18px; }
        .ll-footer-brand .ll-nav-sub { color: rgba(255,255,255,.3); }
        .ll-footer-links { display: flex; gap: 24px; }
        .ll-footer-links a { font-size: 13px; color: rgba(255,255,255,.4); text-decoration: none; cursor: pointer; transition: color .2s; }
        .ll-footer-links a:hover { color: var(--sage-light); }
        .ll-footer-copy { font-size: 12px; color: rgba(255,255,255,.3); }

        /* CTA BAND */
        .ll-cta-band {
          background: var(--sage); padding: 80px 48px; text-align: center;
          position: relative; overflow: hidden;
        }
        .ll-cta-band::before {
          content: ''; position: absolute; font-size: 300px; opacity: .04;
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none; line-height: 1;
        }
        .ll-cta-band-title { font-family: 'Fraunces', serif; font-size: clamp(28px, 4vw, 48px); font-weight: 500; color: #fff; margin-bottom: 16px; letter-spacing: -.02em; }
        .ll-cta-band-desc { font-size: 16px; color: rgba(255,255,255,.7); margin-bottom: 36px; }
        .ll-cta-band-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .ll-btn-white { background: #fff; color: var(--sage); padding: 15px 30px; border-radius: 100px; font-size: 15px; font-weight: 500; border: none; cursor: pointer; transition: all .25s; }
        .ll-btn-white:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,.15); }
        .ll-btn-outline-white { background: transparent; color: #fff; padding: 15px 30px; border-radius: 100px; font-size: 15px; font-weight: 500; border: 1.5px solid rgba(255,255,255,.4); cursor: pointer; transition: all .25s; }
        .ll-btn-outline-white:hover { border-color: #fff; background: rgba(255,255,255,.1); }

        @media (max-width: 768px) {
          .ll-hero { grid-template-columns: 1fr; padding: 80px 24px 48px; }
          .ll-hero-visual { display: none; }
          .ll-section { padding: 64px 24px; }
          .ll-nav { padding: 16px 24px; }
          .ll-nav.scrolled { padding: 12px 24px; }
          .ll-nav-links { display: none; }
          .ll-sitter-grid, .ll-family-grid, .ll-how-grid { grid-template-columns: 1fr; }
          .ll-family-cards { grid-template-columns: 1fr; }
          .ll-family-card:nth-child(1) { grid-column: span 1; }
          .ll-footer { flex-direction: column; padding: 32px 24px; text-align: center; }
          .ll-cta-band { padding: 64px 24px; }
        }
      `}</style>

      <div className="ll-landing">
        {/* NAV */}
        <nav className={`ll-nav ${scrolled ? 'scrolled' : ''}`}>
          <div className="ll-nav-brand">
            <span className="ll-nav-logo"><span style={{fontFamily:"Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif", fontSize:"inherit", lineHeight:1}}>➿</span> littleloop</span>
            <span className="ll-nav-sub">by Loopware Solutions</span>
          </div>
          <div className="ll-nav-links">
            <a onClick={() => document.getElementById('gps-tracking')?.scrollIntoView({ behavior: 'smooth' })}>GPS Tracking</a>
            <a onClick={() => document.getElementById('for-sitters')?.scrollIntoView({ behavior: 'smooth' })}>For Sitters</a>
            <a onClick={() => document.getElementById('for-families')?.scrollIntoView({ behavior: 'smooth' })}>For Families</a>
            <a onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How It Works</a>
            <a onClick={onLogin}>Sign in</a>
          </div>
          <button className="ll-nav-cta" onClick={onFamilySignup}>Get Started Free</button>
        </nav>

        {/* HERO */}
        <section className="ll-hero">
          <div>
            <div className="ll-hero-eyebrow">
              <span></span> Live GPS tracking · Verified sitters · Free for families
            </div>
            <h1 className="ll-hero-title">
              Know they're safe.<br/><em>Always.</em>
            </h1>
            <p className="ll-hero-desc">
              littleloop connects you with verified local sitters — and lets you <strong>track field trips live on a map</strong>, so you always know where your kids are. Free for families, nationwide.
            </p>
            <div className="ll-hero-actions">
              <button className="ll-btn-primary" onClick={onFamilySignup}>
                Find a Sitter Free →
              </button>
              <button className="ll-btn-secondary" onClick={onSitterSignup}>
                Join as a Sitter
              </button>
            </div>
            <div style={{display:'flex', gap:24, marginTop:28, flexWrap:'wrap'}}>
              <span style={{display:'flex', alignItems:'center', gap:7, fontSize:13, color:'var(--muted)', fontWeight:500}}>🔒 Free for families</span>
              <span style={{display:'flex', alignItems:'center', gap:7, fontSize:13, color:'var(--muted)', fontWeight:500}}>📍 Live GPS tracking</span>
              <span style={{display:'flex', alignItems:'center', gap:7, fontSize:13, color:'var(--muted)', fontWeight:500}}>✓ Verified sitters</span>
            </div>
          </div>

          <div className="ll-hero-visual">
            <div style={{position:'relative', width:'100%', maxWidth:480}}>
              <img
                src="/screenshots/family-gps-desktop.png"
                alt="littleloop family dashboard with live GPS tracking"
                style={{width:'100%', borderRadius:20, boxShadow:'0 32px 80px rgba(61,46,34,.18)', border:'1px solid rgba(74,124,101,.15)'}}
              />
              <div className="ll-floating-stat" style={{position:'absolute', bottom:-16, left:-20, zIndex:10, animation:'float1 4s ease-in-out infinite'}}>
                <div className="stat-icon">📍</div>
                <div>
                  <div className="stat-val">Live GPS</div>
                  <div className="stat-text">parents see location in real time</div>
                </div>
              </div>
              <div className="ll-floating-stat" style={{position:'absolute', top:20, right:-24, zIndex:10, animation:'float2 5s ease-in-out infinite'}}>
                <div className="stat-icon">✅</div>
                <div>
                  <div className="stat-val">Emma & Liam checked in</div>
                  <div className="stat-text">by Sarah Mitchell · just now</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GPS FIELD TRIP SECTION */}
        <section className="ll-section" id="gps-tracking" style={{background:'var(--bark)', padding:'100px 48px'}}>
          <div data-id="gps-label" className={reveal('gps-label')} style={{marginBottom:64}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.25)', borderRadius:100, padding:'6px 16px', marginBottom:16}}>
              <div style={{width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 3px rgba(34,197,94,0.3)'}}/>
              <span style={{fontSize:12, fontWeight:600, color:'#4ade80', letterSpacing:'.08em', textTransform:'uppercase'}}>Live Feature</span>
            </div>
            <div className="ll-section-label" style={{color:'var(--sage-light)'}}>Field Trip Tracker</div>
            <h2 className="ll-section-title" style={{color:'var(--sage-pale)'}}>Track field trips<br/><em>live on a map.</em></h2>
            <p className="ll-section-desc" style={{color:'rgba(255,255,255,.55)'}}>When your sitter takes the kids out, you see exactly where they are in real time. No other childcare platform does this. Peace of mind, built right in.</p>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center'}}>
            <div data-id="gps-screenshot" className={reveal('gps-screenshot')}>
              <div style={{position:'relative'}}>
                <img
                  src="/screenshots/gps-map-closeup.png"
                  alt="littleloop live GPS field trip tracking map"
                  style={{width:'100%', borderRadius:20, boxShadow:'0 24px 60px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.08)'}}
                />
                <div style={{position:'absolute', bottom:-12, right:-12, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)', borderRadius:12, padding:'10px 16px', display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:8, height:8, borderRadius:'50%', background:'#22c55e'}}/>
                  <span style={{fontSize:13, color:'#4ade80', fontWeight:600}}>GPS tracking active</span>
                </div>
              </div>
            </div>

            <div data-id="gps-features" style={{transitionDelay:'.15s'}} className={reveal('gps-features')}>
              <div style={{display:'flex', flexDirection:'column', gap:28}}>
                {[
                  { icon:'📍', title:'Real-time map view', desc:'Parents see a live map updated continuously while the sitter is out with the kids. No refreshing, no guessing.' },
                  { icon:'👨‍👩‍👧', title:'Multi-family sharing', desc:'If the sitter watches kids from multiple families, all parents see the same live location simultaneously.' },
                  { icon:'✅', title:'Child check-ins', desc:'Sitters check kids in at the start of each session. Parents see exactly who is checked in and when.' },
                  { icon:'🔔', title:'Trip alerts', desc:'Get notified the moment a field trip begins and when everyone is safely back home.' },
                ].map(f => (
                  <div key={f.title} style={{display:'flex', gap:18, alignItems:'flex-start'}}>
                    <div style={{width:44, height:44, borderRadius:12, flexShrink:0, background:'rgba(74,124,101,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>{f.icon}</div>
                    <div>
                      <div style={{fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:500, color:'var(--sage-pale)', marginBottom:5}}>{f.title}</div>
                      <div style={{fontSize:14, lineHeight:1.6, color:'rgba(255,255,255,.5)'}}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="ll-btn-primary" style={{marginTop:40}} onClick={onFamilySignup}>
                Sign up free to see it live →
              </button>
            </div>
          </div>
        </section>

        {/* FOR SITTERS */}
        <section className="ll-section ll-sitter" id="for-sitters">
          <div data-id="sitter-label" className={reveal('sitter-label')}>
            <div className="ll-section-label">For Sitters</div>
            <h2 className="ll-section-title">Your babysitting<br/>career, <em>elevated.</em></h2>
            <p className="ll-section-desc">Build your reputation, manage your schedule, and connect with families who are looking for exactly what you offer — all in one place.</p>
          </div>

          <div className="ll-sitter-grid">
            <div className="ll-features" data-id="sitter-features" style={{transitionDelay:'.1s'}} className={`ll-features ${reveal('sitter-features')}`}>
              {[
                { icon: '👤', title: 'Your professional profile', desc: 'Showcase your experience, certifications, and availability. Families can find and vet you before reaching out.' },
                { icon: '💬', title: 'Built-in messaging', desc: 'Communicate directly with families through secure in-app messaging. No sharing personal phone numbers.' },
                { icon: '💰', title: 'Invoice & session tracking', desc: 'Send invoices, track sessions, and keep your earnings organized — all from your dashboard.' },
                { icon: '🛡️', title: 'Verified badge system', desc: 'Get your background check, CPR card, and other certifications verified. Stand out to families who care about safety.' },
              ].map(f => (
                <div key={f.title} className="ll-feature">
                  <div className="ll-feature-icon">{f.icon}</div>
                  <div>
                    <div className="ll-feature-title">{f.title}</div>
                    <div className="ll-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div data-id="pricing-card" className={reveal('pricing-card')}>
              <div style={{position:'relative'}}>
                <img
                  src="/screenshots/sitter-dashboard-live.png"
                  alt="Sarah Mitchell sitter dashboard with field trip live"
                  style={{width:'100%', borderRadius:20, boxShadow:'0 24px 60px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.08)'}}
                />
                <div style={{position:'absolute', top:16, right:16, background:'rgba(34,197,94,.9)', borderRadius:100, padding:'6px 14px', display:'flex', alignItems:'center', gap:6}}>
                  <div style={{width:7, height:7, borderRadius:'50%', background:'white'}}/>
                  <span style={{fontSize:12, color:'white', fontWeight:700}}>LIVE</span>
                </div>
              </div>
              <div style={{marginTop:24, background:'rgba(255,255,255,.06)', borderRadius:16, padding:'20px 24px', border:'1px solid rgba(255,255,255,.1)'}}>
                <div style={{fontSize:12, color:'var(--sage-light)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:16}}>Simple, flat pricing</div>
                <div style={{display:'flex', gap:12, marginBottom:20}}>
                  <div style={{flex:1, padding:'14px', borderRadius:12, textAlign:'center', border:'1.5px solid var(--sage-light)', background:'rgba(74,124,101,.15)'}}>
                    <div style={{fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:4}}>Monthly</div>
                    <div style={{fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:500, color:'#fff'}}>$5<span style={{fontSize:14, color:'rgba(255,255,255,.5)'}}>/mo</span></div>
                  </div>
                  <div style={{flex:1, padding:'14px', borderRadius:12, textAlign:'center', border:'1.5px solid rgba(255,255,255,.1)', position:'relative'}}>
                    <div style={{position:'absolute', top:-10, right:8, background:'var(--gold)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:100}}>SAVE 17%</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:4}}>Yearly</div>
                    <div style={{fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:500, color:'#fff'}}>$50<span style={{fontSize:14, color:'rgba(255,255,255,.5)'}}>/yr</span></div>
                  </div>
                </div>
                <button className="ll-btn-primary" style={{width:'100%', justifyContent:'center'}} onClick={onSitterSignup}>
                  Start free trial
                </button>
                <div style={{fontSize:12, color:'rgba(255,255,255,.4)', textAlign:'center', marginTop:12}}>First 20 sitters get 3 months free</div>
              </div>
            </div>
          </div>
        </section>

        {/* FOR FAMILIES */}
        <section className="ll-section ll-family" id="for-families">
          <div data-id="family-label" className={reveal('family-label')}>
            <div className="ll-section-label">For Families</div>
            <h2 className="ll-section-title">Find childcare you<br/>can <em>actually trust.</em></h2>
            <p className="ll-section-desc">Browse verified local sitters, track field trips live on a map, and connect directly — no agency fees, no middlemen. Families always use littleloop free.</p>
          </div>

          <div className="ll-family-grid">
            <div className="ll-family-cards" data-id="family-cards" className={`ll-family-cards ${reveal('family-cards')}`}>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">📍</div>
                <div className="ll-family-card-title">Live GPS field trip tracking</div>
                <div className="ll-family-card-desc">See exactly where your kids are on a live map whenever the sitter takes them out.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">🆓</div>
                <div className="ll-family-card-title">Always free for families</div>
                <div className="ll-family-card-desc">Browse profiles, message sitters, and manage everything at no cost — ever.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">🛡️</div>
                <div className="ll-family-card-title">Verified credentials</div>
                <div className="ll-family-card-desc">Every verified badge is admin-confirmed — CPR, background checks, and more.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">💬</div>
                <div className="ll-family-card-title">Direct communication</div>
                <div className="ll-family-card-desc">Message sitters directly. No phone tag, no agency go-betweens.</div>
              </div>
            </div>

            <div data-id="family-desc" style={{transitionDelay:'.15s'}} className={reveal('family-desc')}>
              <img
                src="/screenshots/family-gps-desktop.png"
                alt="Family dashboard showing live GPS tracking and kids checked in"
                style={{width:'100%', borderRadius:20, boxShadow:'0 20px 50px rgba(61,46,34,.12)', border:'1px solid rgba(74,124,101,.1)', marginBottom:28}}
              />
              <h3 style={{fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:500, color:'var(--bark)', marginBottom:20, lineHeight:1.2}}>From browsing to booked in minutes</h3>
              {[
                { n:'01', t:'Create a free account', d:'Sign up as a family in seconds — no payment info required.' },
                { n:'02', t:'Browse sitter profiles', d:'Search local sitters by experience, certifications, and availability.' },
                { n:'03', t:'Message and connect', d:'Reach out directly and build an ongoing relationship with sitters you trust.' },
              ].map(s => (
                <div key={s.n} style={{display:'flex', gap:16, marginBottom:24, alignItems:'flex-start'}}>
                  <div style={{fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:300, color:'var(--sage)', lineHeight:1, flexShrink:0, width:48}}>{s.n}</div>
                  <div>
                    <div style={{fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500, color:'var(--bark)', marginBottom:4}}>{s.t}</div>
                    <div style={{fontSize:14, color:'var(--muted)', lineHeight:1.6}}>{s.d}</div>
                  </div>
                </div>
              ))}
              <button className="ll-btn-primary" style={{marginTop:8}} onClick={onFamilySignup}>
                Find a sitter →
              </button>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="ll-section ll-how" id="how-it-works">
          <div data-id="how-label" className={`hidden ${reveal('how-label')}`} style={{textAlign:'center'}}>
            <div className="ll-section-label" style={{display:'flex',justifyContent:'center'}}>How It Works</div>
            <h2 className="ll-section-title" style={{textAlign:'center'}}>Simple by <em>design.</em></h2>
          </div>
          <div className="ll-how-grid">
            {[
              { n:'01', icon:'✍️', title:'Sitter creates a profile', desc:'Sign up, complete onboarding, upload your certifications, and set your availability. Your profile goes live immediately.' },
              { n:'02', icon:'🔎', title:'Families discover you', desc:'Local families browse sitters on Littleloop, filter by what matters to them, and reach out directly through the app.' },
              { n:'03', icon:'🤝', title:'You connect & get booked', desc:'Chat, confirm details, and manage the relationship — invoices, session notes, and all — right from your dashboard.' },
            ].map((s, i) => (
              <div key={s.n} className={`ll-step hidden ${reveal('step-' + i)}`} data-id={`step-${i}`} style={{transitionDelay:`${i * .15}s`}}>
                <div className="ll-step-num">{s.n}</div>
                <div className="ll-step-icon">{s.icon}</div>
                <div className="ll-step-title">{s.title}</div>
                <div className="ll-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BAND */}
        <section className="ll-cta-band">
          <div data-id="cta" className={reveal('cta')}>
            <h2 className="ll-cta-band-title">Know they're safe. Always.</h2>
            <p className="ll-cta-band-desc">First 20 sitters get 3 months free. Families are always free.</p>
            <div className="ll-cta-band-actions">
              <button className="ll-btn-white" onClick={onSitterSignup}>Join as a Sitter</button>
              <button className="ll-btn-outline-white" onClick={onFamilySignup}>Find a Sitter</button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="ll-footer">
          <div className="ll-footer-brand">
            <div className="ll-nav-brand">
              <span className="ll-nav-logo"><span style={{fontFamily:"Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif", fontSize:"inherit", lineHeight:1}}>➿</span> littleloop</span>
              <span className="ll-nav-sub">by Loopware Solutions</span>
            </div>
          </div>
          <div className="ll-footer-links">
            <a onClick={onSitterSignup}>Sitter Sign Up</a>
            <a onClick={onFamilySignup}>Family Sign Up</a>
            <a onClick={onLogin}>Sign In</a>
          </div>
          <div className="ll-footer-copy">© 2026 Loopware Solutions LLC. All rights reserved. · littleloop is a product of Loopware Solutions LLC</div>
        </footer>
      </div>
    </>
  );
}
