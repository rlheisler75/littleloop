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
