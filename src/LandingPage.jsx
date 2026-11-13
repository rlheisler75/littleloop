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
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          /* Names kept from the old palette so inline styles pick up the new colors. */
          --sage: #FF6B57;        /* coral, primary */
          --sage-light: #FF8E7D;
          --sage-pale: #FFE4DE;
          --cream: #FFFBF3;       /* warm white */
          --cream-dark: #FFF1DC;  /* soft peach */
          --bark: #2B2D6B;        /* deep indigo */
          --bark-light: #4A4E8F;
          --sky: #4CB5F5;
          --gold: #FFC23C;        /* sunshine */
          --mint: #2FC79B;
          --grape: #8B6CF6;
          --lilac: #F1ECFF;
          --text: #22244D;
          --muted: #686B90;
        }

        .ll-landing {
          font-family: 'Nunito', sans-serif;
          background: var(--cream);
          color: var(--text);
          overflow-x: hidden;
        }
        .ll-landing h1, .ll-landing h2, .ll-landing h3 { font-family: 'Fredoka', sans-serif; }

        /* NAV */
        .ll-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 20px 48px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all .3s ease;
        }
        .ll-nav.scrolled {
          background: rgba(255,251,243,.92);
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 24px rgba(43,45,107,.06);
          padding: 14px 48px;
        }
        .ll-nav-brand { display: flex; flex-direction: column; line-height: 1; padding: 4px 0; }
        .ll-nav-logo { font-family: 'Fredoka', sans-serif; font-size: 26px; font-weight: 600; color: var(--bark); letter-spacing: -.3px; display: flex; align-items: center; gap: 8px; }
        .ll-nav-sub { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-top: 4px; padding-left: 38px; }
        .ll-nav-links { display: flex; align-items: center; gap: 30px; }
        .ll-nav-links a { font-size: 15px; font-weight: 700; color: var(--bark-light); text-decoration: none; transition: color .2s; cursor: pointer; }
        .ll-nav-links a:hover { color: var(--sage); }
        .ll-nav-cta { font-family: 'Fredoka', sans-serif; background: var(--sage); color: #fff; padding: 10px 24px; border-radius: 100px; font-size: 16px; font-weight: 500; border: none; cursor: pointer; transition: all .2s; box-shadow: 0 4px 0 #E04E3A; }
        .ll-nav-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #E04E3A; }

        /* HERO */
        .ll-hero {
          min-height: 100vh;
          display: grid; grid-template-columns: 1.05fr 1fr;
          padding: 110px 48px 60px;
          gap: 56px; align-items: center;
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 88% 18%, rgba(255,194,60,.28) 0, transparent 32%),
            radial-gradient(circle at 8% 92%, rgba(76,181,245,.20) 0, transparent 30%),
            radial-gradient(circle at 60% 100%, rgba(47,199,155,.14) 0, transparent 28%),
            var(--cream);
        }
        .ll-shape { position: absolute; pointer-events: none; z-index: 0; }
        .ll-shape.s1 { top: 120px; left: 46%; width: 22px; height: 22px; border-radius: 50%; background: var(--gold); animation: bob 6s ease-in-out infinite; }
        .ll-shape.s2 { top: 70%; left: 3%; width: 16px; height: 16px; border-radius: 4px; background: var(--grape); animation: bob 7s ease-in-out infinite reverse; }
        .ll-shape.s3 { bottom: 12%; left: 44%; width: 28px; height: 28px; border-radius: 50%; border: 5px solid var(--mint); animation: bob 5s ease-in-out infinite; }
        .ll-shape.s4 { top: 22%; right: 4%; font-size: 30px; color: var(--sky); animation: spin 14s linear infinite; }
        .ll-shape.s5 { top: 16%; left: 2%; font-size: 26px; color: var(--sage); animation: bob 8s ease-in-out infinite; }
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ll-hero > div:not(.ll-shape) { position: relative; z-index: 1; }

        .ll-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: #fff; border: 2px solid var(--sage-pale);
          padding: 7px 16px; border-radius: 100px; margin-bottom: 26px;
          font-size: 13px; font-weight: 800; color: var(--sage);
          box-shadow: 0 4px 14px rgba(255,107,87,.12);
        }
        .ll-hero-eyebrow span { width: 8px; height: 8px; background: var(--mint); border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.35)} }
        .ll-hero-title {
          font-family: 'Fredoka', sans-serif;
          font-size: clamp(42px, 5.2vw, 70px);
          font-weight: 600; line-height: 1.06;
          color: var(--bark);
          margin-bottom: 24px;
        }
        .ll-hero-title em {
          font-style: normal; color: var(--sage); white-space: nowrap;
          background: linear-gradient(transparent 68%, rgba(255,194,60,.55) 68%, rgba(255,194,60,.55) 90%, transparent 90%);
        }
        .ll-hero-desc {
          font-size: 18px; line-height: 1.7; color: var(--muted);
          max-width: 500px; margin-bottom: 36px;
        }
        .ll-hero-desc strong { color: var(--bark); }
        .ll-hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }
        .ll-btn-primary {
          font-family: 'Fredoka', sans-serif;
          background: var(--sage); color: #fff;
          padding: 15px 30px; border-radius: 100px;
          font-size: 17px; font-weight: 500; border: none; cursor: pointer;
          transition: all .2s; display: inline-flex; align-items: center; gap: 8px;
          box-shadow: 0 5px 0 #E04E3A;
        }
        .ll-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 7px 0 #E04E3A, 0 14px 28px rgba(255,107,87,.25); }
        .ll-btn-primary:active { transform: translateY(3px); box-shadow: 0 2px 0 #E04E3A; }
        .ll-btn-secondary {
          font-family: 'Fredoka', sans-serif;
          background: #fff; color: var(--bark);
          padding: 15px 30px; border-radius: 100px;
          font-size: 17px; font-weight: 500;
          border: 2px solid #E4E1F5; cursor: pointer;
          transition: all .2s; box-shadow: 0 5px 0 #E4E1F5;
        }
        .ll-btn-secondary:hover { transform: translateY(-2px); border-color: var(--sky); box-shadow: 0 7px 0 #CDE9FB; }
        .ll-hero-chips { display: flex; gap: 10px; margin-top: 30px; flex-wrap: wrap; }
        .ll-hero-chips span { font-size: 13px; font-weight: 800; padding: 6px 12px; border-radius: 100px; }
        .ll-hero-chips span:nth-child(1) { background: #DDF7EE; color: #138A68; }
        .ll-hero-chips span:nth-child(2) { background: #DDF0FD; color: #1C7DBF; }
        .ll-hero-chips span:nth-child(3) { background: #FFF1CC; color: #A9740A; }

        /* Hero visual */
        .ll-hero-visual { position: relative; display: flex; justify-content: center; align-items: center; }
        .ll-hero-frame {
          position: relative; width: 100%; max-width: 500px; padding: 14px;
          background: #fff; border-radius: 32px; transform: rotate(1.5deg);
          box-shadow: 0 30px 70px rgba(43,45,107,.16);
        }
        .ll-hero-frame::before {
          content: ''; position: absolute; top: -18px; right: -18px; width: 120px; height: 120px;
          background: var(--gold); border-radius: 40% 60% 55% 45%; z-index: -1;
        }
        .ll-hero-frame::after {
          content: ''; position: absolute; bottom: -22px; left: -22px; width: 150px; height: 150px;
          background: var(--sky); opacity: .85; border-radius: 55% 45% 40% 60%; z-index: -1;
        }
        .ll-hero-frame img { display: block; width: 100%; border-radius: 22px; }
        .ll-floating-stat {
          position: absolute; background: #fff; border-radius: 18px;
          padding: 12px 16px; box-shadow: 0 12px 30px rgba(43,45,107,.14);
          display: flex; align-items: center; gap: 10px; white-space: nowrap;
        }
        .ll-floating-stat .stat-icon { font-size: 18px; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .ll-floating-stat .stat-text { font-size: 12px; color: var(--muted); }
        .ll-floating-stat .stat-val { font-family: 'Fredoka', sans-serif; font-size: 15px; font-weight: 600; color: var(--bark); }
        @keyframes float1 { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0) rotate(-3.5deg)} 50%{transform:translateY(6px) rotate(-3.5deg)} }

        /* WAVES between sections */
        .ll-wave { display: block; width: 100%; height: 60px; margin-bottom: -1px; }

        /* SCROLL ANIMATIONS */
        .hidden { opacity: 0; transform: translateY(32px); transition: opacity .7s ease, transform .7s ease; }
        .revealed { opacity: 1; transform: translateY(0); }

        /* SECTION SHARED */
        .ll-section { padding: 90px 48px; }
        .ll-section-label {
          display: inline-block; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
          color: var(--sage); background: var(--sage-pale); padding: 5px 14px; border-radius: 100px; margin-bottom: 18px;
        }
        .ll-section-title {
          font-family: 'Fredoka', sans-serif; font-size: clamp(32px, 4vw, 50px);
          font-weight: 600; line-height: 1.1;
          color: var(--bark); margin-bottom: 18px;
        }
        .ll-section-title em { font-style: normal; color: var(--sage); }
        .ll-section-desc { font-size: 17px; line-height: 1.7; color: var(--muted); max-width: 540px; }

        /* Colorful icon tiles (shared) */
        .ll-tile { width: 48px; height: 48px; border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .ll-c0 { background: #FFE4DE; } .ll-c1 { background: #DDF0FD; } .ll-c2 { background: #DDF7EE; } .ll-c3 { background: #FFF1CC; } .ll-c4 { background: #ECE6FF; }

        /* GPS SECTION: night sky */
        .ll-gps { background: var(--bark); position: relative; overflow: hidden; }
        .ll-gps::before {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
          background-image: radial-gradient(rgba(255,255,255,.18) 1.2px, transparent 1.2px);
          background-size: 28px 28px;
        }
        .ll-gps > * { position: relative; }
        .ll-gps .ll-section-label { background: rgba(255,194,60,.18); color: var(--gold); }
        .ll-gps .ll-section-title { color: #fff; }
        .ll-gps .ll-section-title em { color: var(--gold); }
        .ll-gps .ll-section-desc { color: rgba(255,255,255,.72); }
        .ll-gps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        .ll-gps-feature-title { font-family: 'Fredoka', sans-serif; font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .ll-gps-feature-desc { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,.68); }

        /* SITTER SECTION: lilac */
        .ll-sitter { background: var(--lilac); }
        .ll-sitter .ll-section-label { background: #E2D9FF; color: var(--grape); }
        .ll-sitter .ll-section-title em { color: var(--grape); }
        .ll-sitter-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 56px; align-items: center; margin-top: 56px;
        }
        .ll-features { display: flex; flex-direction: column; gap: 16px; }
        .ll-feature { display: flex; gap: 16px; align-items: flex-start; background: #fff; padding: 18px; border-radius: 22px; box-shadow: 0 6px 20px rgba(139,108,246,.08); }
        .ll-feature-title { font-family: 'Fredoka', sans-serif; font-size: 18px; font-weight: 600; color: var(--bark); margin-bottom: 4px; }
        .ll-feature-desc { font-size: 14.5px; line-height: 1.6; color: var(--muted); }
        .ll-shot { width: 100%; border-radius: 24px; border: 8px solid #fff; box-shadow: 0 24px 60px rgba(43,45,107,.16); display: block; }

        /* Pricing */
        .ll-pricing { margin-top: 26px; background: #fff; border-radius: 26px; padding: 24px; box-shadow: 0 10px 30px rgba(139,108,246,.12); }
        .ll-pricing-label { font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--grape); margin-bottom: 18px; }
        .ll-plans { display: flex; gap: 12px; margin-bottom: 18px; }
        .ll-plan { flex: 1; padding: 18px 12px 14px; border-radius: 18px; text-align: center; border: 2px solid #ECE8F8; position: relative; }
        .ll-plan.free { border-color: var(--mint); background: #F0FBF7; }
        .ll-plan-name { font-size: 13px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
        .ll-plan-price { font-family: 'Fredoka', sans-serif; font-size: 32px; font-weight: 600; color: var(--bark); line-height: 1.1; }
        .ll-plan-price span { font-size: 15px; font-weight: 500; color: var(--muted); }
        .ll-plan-note { font-size: 12.5px; color: var(--muted); margin-top: 6px; line-height: 1.4; }
        .ll-plan-tag { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: var(--mint); color: #fff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
        .ll-pricing-note { font-size: 13px; color: var(--muted); text-align: center; margin-top: 12px; }

        /* FAMILY SECTION */
        .ll-family { background: var(--cream-dark); }
        .ll-family .ll-section-label { background: #DDF0FD; color: #1C7DBF; }
        .ll-family .ll-section-title em { color: #1C7DBF; }
        .ll-family-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 56px; align-items: center; margin-top: 56px;
        }
        .ll-family-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ll-family-card {
          background: #fff; border-radius: 24px; padding: 24px;
          box-shadow: 0 6px 20px rgba(43,45,107,.06); transition: transform .25s, box-shadow .25s;
        }
        .ll-family-card:hover { transform: translateY(-4px) rotate(-.5deg); box-shadow: 0 14px 36px rgba(43,45,107,.1); }
        .ll-family-card:nth-child(1) { background: linear-gradient(135deg, var(--sky), #3A8FE0); color: #fff; }
        .ll-family-card-icon { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 14px; }
        .ll-family-card:nth-child(1) .ll-family-card-icon { background: rgba(255,255,255,.25); }
        .ll-family-card:nth-child(2) .ll-family-card-icon { background: #DDF7EE; }
        .ll-family-card:nth-child(3) .ll-family-card-icon { background: #FFF1CC; }
        .ll-family-card:nth-child(4) .ll-family-card-icon { background: #FFE4DE; }
        .ll-family-card-title { font-family: 'Fredoka', sans-serif; font-size: 18px; font-weight: 600; color: var(--bark); margin-bottom: 6px; }
        .ll-family-card-desc { font-size: 14px; line-height: 1.6; color: var(--muted); }
        .ll-family-card:nth-child(1) .ll-family-card-title { color: #fff; }
        .ll-family-card:nth-child(1) .ll-family-card-desc { color: rgba(255,255,255,.9); }
        .ll-step-row { display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-start; }
        .ll-step-dot { font-family: 'Fredoka', sans-serif; width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #fff; font-size: 17px; }

        /* HOW IT WORKS */
        .ll-how { background: var(--cream); }
        .ll-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 56px; }
        .ll-step { position: relative; padding: 30px; background: #fff; border-radius: 28px; box-shadow: 0 8px 26px rgba(43,45,107,.07); border-top: 6px solid var(--sage); }
        .ll-step:nth-child(2) { border-top-color: var(--sky); }
        .ll-step:nth-child(3) { border-top-color: var(--mint); }
        .ll-step-num { font-family: 'Fredoka', sans-serif; font-size: 56px; font-weight: 600; color: #F1EEF9; line-height: 1; position: absolute; top: 16px; right: 22px; }
        .ll-step-icon { font-size: 30px; margin-bottom: 14px; position: relative; }
        .ll-step-title { font-family: 'Fredoka', sans-serif; font-size: 20px; font-weight: 600; color: var(--bark); margin-bottom: 8px; position: relative; }
        .ll-step-desc { font-size: 15px; line-height: 1.6; color: var(--muted); position: relative; }

        /* CTA BAND */
        .ll-cta-band {
          background: linear-gradient(135deg, var(--sage) 0%, #FF8E5E 100%); padding: 84px 48px; text-align: center;
          position: relative; overflow: hidden;
        }
        .ll-cta-band::before, .ll-cta-band::after { content: ''; position: absolute; border-radius: 50%; pointer-events: none; }
        .ll-cta-band::before { width: 260px; height: 260px; background: rgba(255,194,60,.35); top: -90px; left: -60px; }
        .ll-cta-band::after { width: 200px; height: 200px; background: rgba(255,255,255,.14); bottom: -80px; right: 6%; }
        .ll-cta-band > * { position: relative; }
        .ll-cta-band-title { font-family: 'Fredoka', sans-serif; font-size: clamp(30px, 4vw, 50px); font-weight: 600; color: #fff; margin-bottom: 14px; }
        .ll-cta-band-desc { font-size: 17px; color: rgba(255,255,255,.92); margin-bottom: 34px; }
        .ll-cta-band-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .ll-btn-white { font-family: 'Fredoka', sans-serif; background: #fff; color: var(--sage); padding: 15px 30px; border-radius: 100px; font-size: 17px; font-weight: 500; border: none; cursor: pointer; transition: all .2s; box-shadow: 0 5px 0 rgba(0,0,0,.12); }
        .ll-btn-white:hover { transform: translateY(-2px); }
        .ll-btn-outline-white { font-family: 'Fredoka', sans-serif; background: transparent; color: #fff; padding: 15px 30px; border-radius: 100px; font-size: 17px; font-weight: 500; border: 2px solid rgba(255,255,255,.75); cursor: pointer; transition: all .2s; }
        .ll-btn-outline-white:hover { border-color: #fff; background: rgba(255,255,255,.12); }

        /* FOOTER */
        .ll-footer {
          background: var(--bark); color: rgba(255,255,255,.6);
          padding: 44px 48px; display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 20px;
        }
        .ll-footer .ll-nav-logo { color: #fff; font-size: 22px; }
        .ll-footer-brand .ll-nav-sub { color: rgba(255,255,255,.45); }
        .ll-footer-links { display: flex; gap: 24px; }
        .ll-footer-links a { font-size: 14px; font-weight: 700; color: rgba(255,255,255,.7); text-decoration: none; cursor: pointer; transition: color .2s; }
        .ll-footer-links a:hover { color: var(--gold); }
        .ll-footer-copy { font-size: 12px; color: rgba(255,255,255,.45); }

        @media (max-width: 900px) {
          .ll-hero { grid-template-columns: 1fr; padding: 96px 20px 56px; min-height: auto; gap: 40px; }
          .ll-floating-stat { display: none; }
          .ll-shape.s1, .ll-shape.s3, .ll-shape.s5 { display: none; }
          .ll-section { padding: 64px 20px; }
          .ll-nav, .ll-nav.scrolled { padding: 14px 20px; }
          .ll-nav-links { display: none; }
          .ll-sitter-grid, .ll-family-grid, .ll-how-grid, .ll-gps-grid { grid-template-columns: 1fr; gap: 36px; }
          .ll-family-cards { grid-template-columns: 1fr; }
          .ll-footer { flex-direction: column; padding: 32px 20px; text-align: center; }
          .ll-footer-links { flex-wrap: wrap; justify-content: center; }
          .ll-cta-band { padding: 64px 20px; }
          .ll-hero-title em { white-space: normal; }
          .ll-hero-frame { transform: none; }
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
            <a onClick={() => document.getElementById('gps-tracking')?.scrollIntoView({ behavior: 'smooth' })}>Field Trips</a>
            <a onClick={() => document.getElementById('for-sitters')?.scrollIntoView({ behavior: 'smooth' })}>For Sitters</a>
            <a onClick={() => document.getElementById('for-families')?.scrollIntoView({ behavior: 'smooth' })}>For Parents</a>
            <a onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How It Works</a>
            <a onClick={onLogin}>Sign in</a>
          </div>
          <button className="ll-nav-cta" onClick={onSitterSignup}>Start Free</button>
        </nav>

        {/* HERO */}
        <section className="ll-hero">
          <div className="ll-shape s1"/>
          <div className="ll-shape s2"/>
          <div className="ll-shape s3"/>
          <div className="ll-shape s4">✦</div>
          <div className="ll-shape s5">♥</div>

          <div>
            <div className="ll-hero-eyebrow">
              <span></span> For independent sitters &amp; nannies
            </div>
            <h1 className="ll-hero-title">
              Parents know they're safe.<br/><em>You look like a pro.</em>
            </h1>
            <p className="ll-hero-desc">
              littleloop is the app independent sitters run their childcare on: check-ins, daily photo updates, <strong>live GPS field trips</strong> and invoices in one place. The families you care for get real peace of mind. Start free with up to 2 families.
            </p>
            <div className="ll-hero-actions">
              <button className="ll-btn-primary" onClick={onSitterSignup}>
                Start free as a Sitter →
              </button>
              <button className="ll-btn-secondary" onClick={onFamilySignup}>
                I'm a parent
              </button>
            </div>
            <div className="ll-hero-chips">
              <span>✓ No card needed</span>
              <span>📍 Live GPS field trips</span>
              <span>💛 Always free for parents</span>
            </div>
          </div>

          <div className="ll-hero-visual">
            <div className="ll-hero-frame">
              <img src="/screenshots/family-gps-desktop.png" alt="littleloop parent view with a live field trip map"/>
              <div className="ll-floating-stat" style={{bottom:-22, left:-30, zIndex:10, animation:'float1 4s ease-in-out infinite'}}>
                <div className="stat-icon ll-c2">📍</div>
                <div>
                  <div className="stat-val">Live field trip</div>
                  <div className="stat-text">parents see the map in real time</div>
                </div>
              </div>
              <div className="ll-floating-stat" style={{top:26, right:-34, zIndex:10, animation:'float2 5s ease-in-out infinite'}}>
                <div className="stat-icon ll-c0">✅</div>
                <div>
                  <div className="stat-val">Emma &amp; Liam checked in</div>
                  <div className="stat-text">just now</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Wave from="var(--cream)" to="var(--bark)"/>

        {/* GPS FIELD TRIP SECTION */}
        <section className="ll-section ll-gps" id="gps-tracking">
          <div data-id="gps-label" className={reveal('gps-label')} style={{marginBottom:56}}>
            <div className="ll-section-label">🚌 Field Trip Tracker</div>
            <h2 className="ll-section-title">Park, library, zoo?<br/><em>Parents can follow along.</em></h2>
            <p className="ll-section-desc">When you head out with the kids, parents see where you are on a live map, so they never have to text "where are you?"</p>
          </div>

          <div className="ll-gps-grid">
            <div data-id="gps-screenshot" className={reveal('gps-screenshot')}>
              <img className="ll-shot" src="/screenshots/gps-map-closeup.png" alt="littleloop live field trip map" style={{borderColor:'rgba(255,255,255,.12)'}}/>
            </div>

            <div data-id="gps-features" style={{transitionDelay:'.15s'}} className={reveal('gps-features')}>
              <div style={{display:'flex', flexDirection:'column', gap:24}}>
                {[
                  { icon:'📍', title:'Real-time map', desc:'A live map that updates while you\'re out. No refreshing, no guessing.' },
                  { icon:'👨‍👩‍👧', title:'Every family at once', desc:'Watching kids from more than one family? Each parent sees the same live trip.' },
                  { icon:'✅', title:'Check-ins', desc:'Check kids in when they arrive. Parents see who\'s with you and since when.' },
                  { icon:'🔔', title:'Trip alerts', desc:'Parents get a ping when the outing starts and when everyone is safely back.' },
                ].map((f, i) => (
                  <div key={f.title} style={{display:'flex', gap:16, alignItems:'flex-start'}}>
                    <div className={`ll-tile ll-c${i}`}>{f.icon}</div>
                    <div>
                      <div className="ll-gps-feature-title">{f.title}</div>
                      <div className="ll-gps-feature-desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="ll-btn-primary" style={{marginTop:36}} onClick={onSitterSignup}>
                Try it free →
              </button>
            </div>
          </div>
        </section>

        <Wave from="var(--bark)" to="var(--lilac)"/>

        {/* FOR SITTERS */}
        <section className="ll-section ll-sitter" id="for-sitters">
          <div data-id="sitter-label" className={reveal('sitter-label')}>
            <div className="ll-section-label">For Sitters</div>
            <h2 className="ll-section-title">Less admin,<br/><em>more playtime.</em></h2>
            <p className="ll-section-desc">Look professional, keep parents happy, and get paid on time, all from your phone.</p>
          </div>

          <div className="ll-sitter-grid">
            <div data-id="sitter-features" style={{transitionDelay:'.1s'}} className={`ll-features ${reveal('sitter-features')}`}>
              {[
                { icon: '📸', title: 'Daily updates parents love', desc: 'Share photos, meals, naps and milestones in a private family feed.' },
                { icon: '💰', title: 'Invoices that get paid', desc: 'Send an invoice in seconds. Parents pay by Venmo, Zelle, Cash App or however you like.' },
                { icon: '💬', title: 'Messaging, minus the group texts', desc: 'Chat with each family in the app, without handing out your personal number.' },
                { icon: '🛡️', title: 'Show off your credentials', desc: 'Get your CPR card and background check verified, and earn badges parents trust.' },
              ].map((f, i) => (
                <div key={f.title} className="ll-feature">
                  <div className={`ll-tile ll-c${i}`}>{f.icon}</div>
                  <div>
                    <div className="ll-feature-title">{f.title}</div>
                    <div className="ll-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div data-id="pricing-card" className={reveal('pricing-card')}>
              <img className="ll-shot" src="/screenshots/sitter-dashboard-live.png" alt="littleloop sitter dashboard"/>
              <div className="ll-pricing">
                <div className="ll-pricing-label">Simple pricing</div>
                <div className="ll-plans">
                  <div className="ll-plan free">
                    <div className="ll-plan-tag">Start here</div>
                    <div className="ll-plan-name">Free</div>
                    <div className="ll-plan-price">$0</div>
                    <div className="ll-plan-note">Up to 2 families<br/>Every feature</div>
                  </div>
                  <div className="ll-plan">
                    <div className="ll-plan-name">Pro</div>
                    <div className="ll-plan-price">$5<span>/mo</span></div>
                    <div className="ll-plan-note">Unlimited families<br/>or $50/yr</div>
                  </div>
                </div>
                <button className="ll-btn-primary" style={{width:'100%', justifyContent:'center'}} onClick={onSitterSignup}>
                  Start free
                </button>
                <div className="ll-pricing-note">No card needed. Upgrade only when you need more families.</div>
              </div>
            </div>
          </div>
        </section>

        <Wave from="var(--lilac)" to="var(--cream-dark)"/>

        {/* FOR FAMILIES */}
        <section className="ll-section ll-family" id="for-families">
          <div data-id="family-label" className={reveal('family-label')}>
            <div className="ll-section-label">For Parents</div>
            <h2 className="ll-section-title">See their day,<br/><em>as it happens.</em></h2>
            <p className="ll-section-desc">When your sitter uses littleloop, you get check-in alerts, photo updates, a live map on field trips, and simple invoices you can pay however you like. Always free for parents.</p>
          </div>

          <div className="ll-family-grid">
            <div data-id="family-cards" className={`ll-family-cards ${reveal('family-cards')}`}>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">📍</div>
                <div className="ll-family-card-title">Live field trip map</div>
                <div className="ll-family-card-desc">See exactly where your kids are whenever your sitter takes them out.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">💛</div>
                <div className="ll-family-card-title">Always free</div>
                <div className="ll-family-card-desc">Updates, messages, check-ins and invoices at no cost, ever.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">🛡️</div>
                <div className="ll-family-card-title">Verified badges</div>
                <div className="ll-family-card-desc">CPR and background-check badges are confirmed by our team.</div>
              </div>
              <div className="ll-family-card">
                <div className="ll-family-card-icon">📸</div>
                <div className="ll-family-card-title">Little moments</div>
                <div className="ll-family-card-desc">Photos, meals, naps and milestones, right when they happen.</div>
              </div>
            </div>

            <div data-id="family-desc" style={{transitionDelay:'.15s'}} className={reveal('family-desc')}>
              <img className="ll-shot" src="/screenshots/sitter-profile.png" alt="A verified sitter profile on littleloop" style={{marginBottom:30}}/>
              <h3 style={{fontSize:28, fontWeight:600, color:'var(--bark)', marginBottom:22, lineHeight:1.2}}>Get your sitter on littleloop</h3>
              {[
                { t:'Share littleloop with your sitter', d:'It’s free for them to start, and they’ll send you an invite.', c:'var(--sage)' },
                { t:'Accept the invite', d:'Add your kids, allergies and emergency contacts in a couple of minutes. No payment info.', c:'var(--sky)' },
                { t:'Stay in the loop', d:'Check-ins, updates, messages and invoices, all in one place.', c:'var(--mint)' },
              ].map((s, i) => (
                <div key={s.t} className="ll-step-row">
                  <div className="ll-step-dot" style={{background:s.c}}>{i + 1}</div>
                  <div>
                    <div style={{fontFamily:"'Fredoka',sans-serif", fontSize:18, fontWeight:600, color:'var(--bark)', marginBottom:2}}>{s.t}</div>
                    <div style={{fontSize:15, color:'var(--muted)', lineHeight:1.6}}>{s.d}</div>
                  </div>
                </div>
              ))}
              <button className="ll-btn-primary" style={{marginTop:8}} onClick={onFamilySignup}>
                Create a parent account →
              </button>
            </div>
          </div>
        </section>

        <Wave from="var(--cream-dark)" to="var(--cream)"/>

        {/* HOW IT WORKS */}
        <section className="ll-section ll-how" id="how-it-works">
          <div data-id="how-label" className={reveal('how-label')} style={{textAlign:'center'}}>
            <div className="ll-section-label">How It Works</div>
            <h2 className="ll-section-title" style={{textAlign:'center'}}>Up and running <em>in minutes.</em></h2>
          </div>
          <div className="ll-how-grid">
            {[
              { n:'1', icon:'✍️', title:'Sign up free', desc:'Create your sitter account in a minute. No card needed, and every feature is included for up to 2 families.' },
              { n:'2', icon:'💌', title:'Invite your families', desc:'Send each family an invite. They join free and add their kids, allergies and emergency contacts.' },
              { n:'3', icon:'🎈', title:'Run your day', desc:'Check kids in, post updates, share a live map on outings, and send invoices, all from your phone.' },
            ].map((s, i) => (
              <div key={s.n} className={`ll-step ${reveal('step-' + i)}`} data-id={`step-${i}`} style={{transitionDelay:`${i * .15}s`}}>
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
            <h2 className="ll-cta-band-title">Happy kids. Calm parents.<br/>Easy days for you.</h2>
            <p className="ll-cta-band-desc">Free for sitters with up to 2 families. Always free for parents.</p>
            <div className="ll-cta-band-actions">
              <button className="ll-btn-white" onClick={onSitterSignup}>Start free as a Sitter</button>
              <button className="ll-btn-outline-white" onClick={onFamilySignup}>I'm a parent</button>
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
            <a onClick={onFamilySignup}>Parent Sign Up</a>
            <a onClick={onLogin}>Sign In</a>
          </div>
          <div className="ll-footer-copy">© 2026 Loopware Solutions LLC. All rights reserved. · littleloop is a product of Loopware Solutions LLC</div>
        </footer>
      </div>
    </>
  );
}

// Wavy divider: the top takes the previous section's color, the wave fills with the next one.
function Wave({ from, to }) {
  return (
    <div style={{ background: from, lineHeight: 0 }} aria-hidden="true">
      <svg className="ll-wave" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,32 C180,64 360,0 540,24 C720,48 900,64 1080,36 C1260,8 1350,20 1440,30 L1440,60 L0,60 Z" style={{ fill: to }}/>
      </svg>
    </div>
  );
}
