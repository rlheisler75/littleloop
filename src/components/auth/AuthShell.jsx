import LoopMark from '../ui/LoopMark';
// Styled to match the landing page (coral / sun / sky / mint, Fredoka + Nunito).
export const AUTH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');
.ll-auth {
  --coral: #FF6B57; --coral-dark: #E04E3A; --coral-pale: #FFE4DE;
  --cream: #FFFBF3; --indigo: #2B2D6B; --indigo-light: #4A4E8F;
  --sky: #4CB5F5; --sun: #FFC23C; --mint: #2FC79B; --ink: #22244D; --muted: #686B90;
  position: relative; z-index: 1; min-height: 100vh; padding: 32px 16px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: 'Nunito', sans-serif; color: var(--ink);
  background:
    radial-gradient(circle at 88% 12%, rgba(255,194,60,.30) 0, transparent 30%),
    radial-gradient(circle at 6% 90%, rgba(76,181,245,.20) 0, transparent 30%),
    radial-gradient(circle at 70% 100%, rgba(47,199,155,.14) 0, transparent 28%),
    var(--cream);
}
.ll-auth * { box-sizing: border-box; }
.ll-auth-wrap { width: 100%; max-width: 420px; }
.ll-auth-back { background: none; border: none; cursor: pointer; color: var(--indigo-light); font: 700 14px 'Nunito', sans-serif; padding: 0; margin-bottom: 18px; }
.ll-auth-back:hover { color: var(--coral); }
.ll-auth-brand { text-align: center; margin-bottom: 22px; }
.ll-auth-logo { font: 600 32px 'Fredoka', sans-serif; color: var(--indigo); display: inline-flex; align-items: center; gap: 8px; }
.ll-auth-tag { font-size: 13px; color: var(--muted); margin-top: 4px; }
.ll-auth-card { background: #fff; border-radius: 24px; padding: 26px 24px 22px; box-shadow: 0 12px 40px rgba(43,45,107,.10); border: 2px solid #F3EDE3; }
.ll-auth-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #F6F1E8; border-radius: 100px; padding: 4px; margin-bottom: 20px; }
.ll-auth-tab { border: none; background: none; border-radius: 100px; padding: 10px 8px; cursor: pointer; font: 500 15px 'Fredoka', sans-serif; color: var(--muted); }
.ll-auth-tab.on { background: #fff; color: var(--indigo); box-shadow: 0 2px 8px rgba(43,45,107,.10); }
.ll-auth-title { font: 600 24px 'Fredoka', sans-serif; color: var(--indigo); margin: 0 0 4px; }
.ll-auth-sub { font-size: 14px; color: var(--muted); margin: 0 0 18px; line-height: 1.5; }
.ll-auth-label { display: block; font-size: 13px; font-weight: 800; color: var(--indigo-light); margin-bottom: 6px; }
.ll-auth-roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
.ll-auth-role { border-radius: 16px; padding: 14px 8px 12px; cursor: pointer; text-align: center; background: #fff; border: 2px solid #ECE6DC; transition: all .15s; font-family: 'Nunito', sans-serif; color: var(--ink); }
.ll-auth-role:hover { border-color: var(--coral-pale); }
.ll-auth-role.on { border-color: var(--coral); background: #FFF5F2; box-shadow: 0 4px 0 var(--coral-pale); }
.ll-auth-role .i { font-size: 28px; line-height: 1; }
.ll-auth-role .t { font: 600 16px 'Fredoka', sans-serif; color: var(--indigo); margin-top: 6px; }
.ll-auth-role .s { font-size: 12px; color: var(--muted); margin-top: 2px; }
.ll-auth-field { margin-bottom: 14px; }
.ll-auth-input { width: 100%; padding: 13px 14px; border-radius: 14px; border: 2px solid #ECE6DC; background: #FFFDF9; font: 600 15px 'Nunito', sans-serif; color: var(--ink); outline: none; transition: border-color .15s; }
.ll-auth-input::placeholder { color: #B4B2C6; font-weight: 500; }
.ll-auth-input:focus { border-color: var(--sky); background: #fff; }
.ll-auth-btn { width: 100%; margin-top: 6px; font: 500 17px 'Fredoka', sans-serif; background: var(--coral); color: #fff; padding: 14px 20px; border-radius: 100px; border: none; cursor: pointer; box-shadow: 0 5px 0 var(--coral-dark); transition: transform .15s, box-shadow .15s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.ll-auth-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 0 var(--coral-dark); }
.ll-auth-btn:disabled { opacity: .7; cursor: default; }
.ll-auth-link { background: none; border: none; cursor: pointer; font: 700 13px 'Nunito', sans-serif; color: var(--sky); padding: 0; }
.ll-auth-link:hover { text-decoration: underline; }
.ll-auth-note { border-radius: 14px; padding: 11px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
.ll-auth-note.i { background: #EAF6FE; color: #1F5F8A; }
.ll-auth-note.s { background: #E6F8F1; color: #18705A; }
.ll-auth-note.e { background: #FFEDEA; color: #B23A28; }
.ll-auth-note.w { background: #FFF6DD; color: #8A6410; }
.ll-auth-avatar { width: 84px; height: 84px; border-radius: 50%; overflow: hidden; margin: 0 auto 12px; background: #FFF1DC; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(43,45,107,.12); display: flex; align-items: center; justify-content: center; font-size: 36px; }
.ll-auth-feats { text-align: left; margin: 4px 0 20px; display: grid; gap: 10px; }
.ll-auth-feat { display: flex; gap: 12px; align-items: center; background: #FFFAF2; border-radius: 14px; padding: 10px 12px; }
.ll-auth-feat .i { font-size: 22px; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ll-auth-feat .t { font: 600 15px 'Fredoka', sans-serif; color: var(--indigo); }
.ll-auth-feat .s { font-size: 12px; color: var(--muted); }
.ll-auth-center { text-align: center; }
.ll-auth-foot { text-align: center; margin-top: 16px; font-size: 13px; color: var(--muted); }
`;

// Shared page frame for sign-in, sign-up, invite and password reset.
export default function AuthShell({ onBack, children }) {
  return (
    <div className="ll-auth">
      <style>{AUTH_STYLES}</style>
      <div className="ll-auth-wrap">
        {onBack && <button className="ll-auth-back" onClick={onBack}>← Back to littleloop</button>}
        <div className="ll-auth-brand">
          <div className="ll-auth-logo"><LoopMark size={24} color="#E8553F"/> littleloop</div>
          <div className="ll-auth-tag">Independent childcare, thoughtfully connected.</div>
        </div>
        <div className="ll-auth-card">{children}</div>
      </div>
    </div>
  );
}
