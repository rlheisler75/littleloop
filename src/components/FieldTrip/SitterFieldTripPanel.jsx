// src/components/FieldTrip/SitterFieldTripPanel.jsx
// Drop this into your babysitter dashboard/home screen

import { useState } from 'react';
import { useFieldTripSitter } from '../../hooks/useFieldTrip';

/**
 * Props:
 *   sitterId        – string  (the sitter's row ID in the sitters table)
 *   checkedInChildren – array of child UUIDs currently checked in
 *   checkedInNames    – array of child name strings (for display)
 */
export default function SitterFieldTripPanel({ sitterId, checkedInChildren = [], checkedInNames = [] }) {
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const {
    session,
    isTracking,
    locationError,
    lastPing,
    loading,
    startTrip,
    stopTrip,
  } = useFieldTripSitter(sitterId, checkedInChildren);

  const handleStart = async () => {
    await startTrip(note);
    setNote('');
    setShowNoteInput(false);
  };

  const formatTime = (date) =>
    date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>🗺️</span>
        <div>
          <div style={styles.headerTitle}>Field Trip</div>
          <div style={styles.headerSub}>Share live location with families</div>
        </div>
        {isTracking && (
          <div style={styles.liveBadge}>
            <span style={styles.liveDot} />
            LIVE
          </div>
        )}
      </div>

      {/* Error */}
      {locationError && (
        <div style={styles.errorBanner}>
          <span>⚠️</span> {locationError}
        </div>
      )}

      {/* Active session state */}
      {isTracking && session ? (
        <div>
          <div style={styles.activeInfo}>
            <div style={styles.activeRow}>
              <span style={styles.label}>Started</span>
              <span style={styles.value}>{formatTime(session.started_at)}</span>
            </div>
            {session.note && (
              <div style={styles.activeRow}>
                <span style={styles.label}>Note</span>
                <span style={styles.value}>"{session.note}"</span>
              </div>
            )}
            <div style={styles.activeRow}>
              <span style={styles.label}>Last ping</span>
              <span style={styles.value}>{lastPing ? formatTime(lastPing) : 'Sending…'}</span>
            </div>
            {checkedInNames.length > 0 && (
              <div style={styles.activeRow}>
                <span style={styles.label}>Sharing with</span>
                <span style={styles.value}>{checkedInNames.join(', ')}'s families</span>
              </div>
            )}
          </div>

          <div style={styles.trackingIndicator}>
            <PulsingDot />
            <span>GPS tracking active — parents can see your location</span>
          </div>

          <button
            onClick={stopTrip}
            disabled={loading}
            style={{ ...styles.btn, ...styles.btnStop }}
          >
            {loading ? 'Stopping…' : '⏹ End Field Trip'}
          </button>
        </div>
      ) : (
        /* Idle state */
        <div>
          {checkedInChildren.length === 0 ? (
            <div style={styles.emptyState}>
              No children are currently checked in. Check in children before starting a field trip.
            </div>
          ) : (
            <div style={styles.childrenPreview}>
              <div style={styles.label}>Currently checked in:</div>
              <div style={styles.childPills}>
                {checkedInNames.map((name, i) => (
                  <span key={i} style={styles.pill}>{name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Optional note */}
          {showNoteInput ? (
            <div style={styles.noteArea}>
              <input
                type="text"
                placeholder='e.g. "We\'re heading to Riverside Park"'
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={styles.noteInput}
                maxLength={120}
              />
              <button onClick={() => setShowNoteInput(false)} style={styles.noteCancel}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNoteInput(true)}
              style={styles.noteToggle}
            >
              + Add a note for parents
            </button>
          )}

          <button
            onClick={handleStart}
            disabled={loading || checkedInChildren.length === 0}
            style={{
              ...styles.btn,
              ...styles.btnStart,
              opacity: checkedInChildren.length === 0 ? 0.5 : 1,
            }}
          >
            {loading ? 'Starting…' : '📍 Start Field Trip'}
          </button>
        </div>
      )}
    </div>
  );
}

function PulsingDot() {
  return (
    <span style={styles.pulseWrap}>
      <span style={styles.pulseOuter} />
      <span style={styles.pulseInner} />
    </span>
  );
}

// ─────────────────────────────────────────────
// Styles (uses inline so it works without Tailwind config)
// Replace with your Tailwind classes if preferred
// ─────────────────────────────────────────────
const styles = {
  card: {
    background: 'var(--color-surface, #fff)',
    border: '1px solid var(--color-border, #e5e7eb)',
    borderRadius: 16,
    padding: '20px 24px',
    maxWidth: 480,
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontWeight: 700, fontSize: 17, color: 'var(--color-text, #111)' },
  headerSub: { fontSize: 13, color: 'var(--color-text-muted, #6b7280)', marginTop: 2 },
  liveBadge: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#dcfce7',
    color: '#16a34a',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#16a34a',
    display: 'inline-block',
    animation: 'pulse 1.5s infinite',
  },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  activeInfo: {
    background: 'var(--color-surface-alt, #f9fafb)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  activeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
  },
  label: { color: 'var(--color-text-muted, #6b7280)', fontWeight: 500 },
  value: { color: 'var(--color-text, #111)', fontWeight: 600 },
  trackingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#16a34a',
    fontWeight: 600,
    marginBottom: 16,
  },
  pulseWrap: { position: 'relative', width: 16, height: 16, flexShrink: 0 },
  pulseOuter: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: '#bbf7d0',
    animation: 'ping 1.5s cubic-bezier(0,0,.2,1) infinite',
  },
  pulseInner: {
    position: 'absolute',
    inset: 3,
    borderRadius: '50%',
    background: '#16a34a',
  },
  btn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
    transition: 'opacity 0.15s, transform 0.1s',
  },
  btnStart: {
    background: 'var(--color-primary, #6366f1)',
    color: '#fff',
  },
  btnStop: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1.5px solid #fecaca',
  },
  childrenPreview: { marginBottom: 12 },
  childPills: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  pill: {
    background: 'var(--color-primary-light, #eef2ff)',
    color: 'var(--color-primary, #6366f1)',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 13,
    fontWeight: 600,
  },
  emptyState: {
    color: 'var(--color-text-muted, #6b7280)',
    fontSize: 13,
    textAlign: 'center',
    padding: '12px 0',
    marginBottom: 16,
  },
  noteArea: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  noteInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--color-border, #e5e7eb)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  noteCancel: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#9ca3af',
    padding: '0 4px',
  },
  noteToggle: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-primary, #6366f1)',
    fontSize: 13,
    fontWeight: 600,
    padding: '0 0 12px 0',
    display: 'block',
  },
};
