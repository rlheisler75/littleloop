import { Component } from 'react';
import { supabase } from '../lib/supabase';

// Catches a screen that crashes while drawing, so people see a message with Reload instead of
// a white page, and records what broke in client_errors (20261125_client_errors.sql) so it can
// be fixed. Wrap each tab with key={tab} so switching tabs gets a fresh try.
let sentThisLoad = 0;
export async function reportClientError(error, extra = {}) {
  if (sentThisLoad >= 10) return;          // one bad screen shouldn't flood the table
  sentThisLoad += 1;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('client_errors').insert({
      user_id: session?.user?.id || null,
      scope: String(extra.scope || 'app').slice(0, 80),
      message: String(error?.message || error || 'Unknown error').slice(0, 2000),
      stack: String(error?.stack || '').slice(0, 8000) || null,
      component_stack: String(extra.componentStack || '').slice(0, 8000) || null,
      url: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 400),
    });
  } catch { /* reporting must never cause another crash */ }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info?.componentStack);
    reportClientError(error, { scope: this.props.scope, componentStack: info?.componentStack });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const whole = this.props.scope === 'app';
    return (
      <div style={{ maxWidth: 440, margin: whole ? '80px auto' : '30px auto', padding: '24px 20px', textAlign: 'center',
        background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 16, color: 'var(--text, #22244D)', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>😕</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Something went wrong on this screen</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim, #666)', lineHeight: 1.6, marginBottom: 16 }}>
          We've been told about it automatically. Reloading usually fixes it{whole ? '' : ', or pick another tab'}.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="bp" onClick={() => window.location.reload()}>Reload</button>
          {whole && <button className="bg" onClick={() => { window.location.href = '/'; }}>Go home</button>}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-faint, #999)', marginTop: 14, wordBreak: 'break-word' }}>{String(this.state.error?.message || '').slice(0, 160)}</div>
      </div>
    );
  }
}
