// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root component. Replaces the current two-panel demo layout
// with real auth routing:
//
//   Not logged in  →  AuthScreen
//   Sitter         →  SitterApp  (uses useSitterData)
//   Parent         →  ParentApp  (uses useParentData)
//
// The existing SitterApp and ParentApp components stay almost
// identical — only their data source changes.
// See MIGRATION.md for the exact prop changes needed.
// ─────────────────────────────────────────────────────────────

import { useAuth }       from "./hooks/useAuth";
import { AuthScreen }    from "./components/AuthScreen";
import { SitterApp }     from "./SitterApp";     // your existing component
import { ParentApp }     from "./ParentApp";     // your existing component

// Global styles + font import (same as your existing GS constant)
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=swap');`;
const globalCSS = `
  ${FONTS}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif}
  input,textarea,select{font-family:'Outfit',sans-serif}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:#88886655;border-radius:4px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
  .fade-in{animation:fadeIn 0.3s ease both}
  .pop-in{animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both}
`;

export default function App() {
  const { user, role, loading } = useAuth();

  // Inject global CSS once
  if (typeof document !== "undefined" && !document.getElementById("ll-global")) {
    const tag = document.createElement("style");
    tag.id = "ll-global";
    tag.textContent = globalCSS;
    document.head.appendChild(tag);
  }

  // ── Loading splash ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#EFF4FB",
        fontFamily: "'Outfit', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24, color: "#3A6FD4", marginBottom: 12,
          }}>🌿 littleloop</div>
          <div style={{ fontSize: 13, color: "#7A90AA" }}>Loading…</div>
        </div>
      </div>
    );
  }

  // ── Not logged in ───────────────────────────────────────────
  if (!user) return <AuthScreen />;

  // ── Sitter ──────────────────────────────────────────────────
  if (role === "sitter") {
    return <SitterApp sitterId={user.id} />;
  }

  // ── Parent / family member ──────────────────────────────────
  if (role === "parent") {
    return <ParentApp userId={user.id} />;
  }

  // Role not yet resolved (brief flash) — show nothing
  return null;
}
