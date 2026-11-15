// Referral: ?ref=<code> is remembered so it survives browsing before signup.
export function rememberRef() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[a-z0-9]{4,16}$/i.test(ref)) localStorage.setItem("ll_ref", ref.toLowerCase());
  } catch {}
}
export function getStoredRef() {
  try { return localStorage.getItem("ll_ref") || null; } catch { return null; }
}

export function getPortal() {
  return new URLSearchParams(window.location.search).get('portal') || 'sitter';
}

export function getInviteToken() {
  return new URLSearchParams(window.location.search).get('invite') || null;
}

export function getSitterParam() {
  return new URLSearchParams(window.location.search).get('sitter') || null;
}

export function getBrowseParam() {
  return new URLSearchParams(window.location.search).get('browse') !== null;
}
