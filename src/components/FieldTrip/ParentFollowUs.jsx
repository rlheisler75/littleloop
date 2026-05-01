// src/components/FieldTrip/ParentFollowUs.jsx
// Parent-facing "Follow Us" live map view
// Uses Leaflet via CDN — NO npm install needed

import { useEffect, useRef } from 'react';
import { useFieldTripParent } from '../../hooks/useFieldTrip';

// ─── Load Leaflet CSS + JS from CDN once ───────────────────
function ensureLeafletLoaded() {
  return new Promise((resolve) => {
    if (window.L) { resolve(window.L); return; }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.L) { clearInterval(check); resolve(window.L); }
      }, 50);
    }
  });
}

// ─── Map component ─────────────────────────────────────────
function MapView({ locations, currentLocation }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const polylineRef = useRef(null);

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;
    let cancelled = false;

    ensureLeafletLoaded().then((L) => {
      if (cancelled || !mapRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [37.2153, -93.2982], // Springfield MO default
        zoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const pulsingIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:36px;height:36px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(99,102,241,0.25);animation:ll-ping 1.5s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:6px;border-radius:50%;background:#6366f1;border:3px solid #fff;box-shadow:0 2px 8px rgba(99,102,241,0.5);"></div>
        </div>`,
        iconSize:   [36, 36],
        iconAnchor: [18, 18],
      });

      if (!document.getElementById('ll-anim')) {
        const s = document.createElement('style');
        s.id = 'll-anim';
        s.textContent = `@keyframes ll-ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2);opacity:0}}.leaflet-container{border-radius:12px;}`;
        document.head.appendChild(s);
      }

      markerRef.current   = L.marker([37.2153, -93.2982], { icon: pulsingIcon }).addTo(map);
      polylineRef.current = L.polyline([], { color: '#6366f1', weight: 4, opacity: 0.7, dashArray: '8 4' }).addTo(map);
      mapInstance.current = map;
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !currentLocation) return;
    const latlng = [currentLocation.latitude, currentLocation.longitude];
    markerRef.current?.setLatLng(latlng);
    mapInstance.current.panTo(latlng, { animate: true, duration: 1 });
    const path = locations.map(l => [l.latitude, l.longitude]);
    polylineRef.current?.setLatLngs(path);
  }, [locations, currentLocation]);

  return <div ref={mapRef} style={styles.map} />;
}

// ─── Main component ────────────────────────────────────────
export default function ParentFollowUs({ familyId }) {
  const { session, locations, currentLocation, status } = useFieldTripParent(familyId);

  if (status === 'loading') return (
    <div style={styles.emptyCard}>
      <div style={styles.emptyIcon}>⏳</div>
      <div style={styles.emptyTitle}>Checking for active trips…</div>
    </div>
  );

  if (status === 'none') return (
    <div style={styles.emptyCard}>
      <div style={styles.emptyIcon}>🏡</div>
      <div style={styles.emptyTitle}>No Field Trip in Progress</div>
      <div style={styles.emptyText}>When your babysitter starts a field trip, you'll see their live location here.</div>
    </div>
  );

  const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>📍</span>
          <div>
            <div style={styles.title}>Follow Us</div>
            {session?.note && <div style={styles.note}>"{session.note}"</div>}
          </div>
        </div>
        {status === 'active'
          ? <div style={{ ...styles.badge, ...styles.badgeActive }}><span style={styles.badgeDot} />Live</div>
          : <div style={{ ...styles.badge, ...styles.badgeEnded }}>Trip Ended</div>
        }
      </div>

      {/* Map */}
      <MapView locations={locations} currentLocation={currentLocation} />

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerRow}>
          <span style={styles.footerLabel}>{status === 'ended' ? 'Trip ended' : 'Last updated'}</span>
          <span style={styles.footerValue}>{status === 'ended' ? fmt(session?.ended_at) : fmt(currentLocation?.created_at)}</span>
        </div>
        <div style={styles.footerRow}>
          <span style={styles.footerLabel}>Trip started</span>
          <span style={styles.footerValue}>{fmt(session?.started_at)}</span>
        </div>
        {currentLocation?.accuracy && status === 'active' && (
          <div style={styles.footerRow}>
            <span style={styles.footerLabel}>GPS accuracy</span>
            <span style={styles.footerValue}>±{Math.round(currentLocation.accuracy)}m</span>
          </div>
        )}
        {status === 'ended' && (
          <div style={styles.endedNotice}>
            The babysitter has ended the field trip. Your child is back at the usual location.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = {
  wrapper:     { background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 16, overflow: 'hidden', maxWidth: 520, fontFamily: 'inherit' },
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border, #f0f0f0)' },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon:  { fontSize: 26 },
  title:       { fontWeight: 700, fontSize: 17, color: 'var(--color-text, #111)' },
  note:        { fontSize: 13, color: 'var(--color-text-muted, #6b7280)', marginTop: 2, fontStyle: 'italic' },
  badge:       { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 12 },
  badgeActive: { background: '#dcfce7', color: '#16a34a' },
  badgeEnded:  { background: '#f3f4f6', color: '#6b7280' },
  badgeDot:    { width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', marginRight: 4 },
  map:         { width: '100%', height: 320 },
  footer:      { padding: '14px 20px', borderTop: '1px solid var(--color-border, #f0f0f0)', display: 'flex', flexDirection: 'column', gap: 6 },
  footerRow:   { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  footerLabel: { color: 'var(--color-text-muted, #6b7280)' },
  footerValue: { fontWeight: 600, color: 'var(--color-text, #111)' },
  endedNotice: { marginTop: 6, padding: '10px 14px', background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#6b7280', textAlign: 'center' },
  emptyCard:   { padding: '40px 24px', textAlign: 'center', background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 16, maxWidth: 400, margin: '0 auto', fontFamily: 'inherit' },
  emptyIcon:   { fontSize: 40, marginBottom: 12 },
  emptyTitle:  { fontWeight: 700, fontSize: 17, color: 'var(--color-text, #111)', marginBottom: 8 },
  emptyText:   { fontSize: 13, color: 'var(--color-text-muted, #6b7280)', lineHeight: 1.6 },
};
