// src/components/FieldTrip/ParentFollowUs.jsx
import { useEffect, useRef } from 'react';
import { useFieldTripParent } from '../../hooks/useFieldTrip';

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
    center: [36.5, -93.5], // neutral center, will move on first ping
    zoom: 10,
    zoomControl: true,
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
        s.textContent = `@keyframes ll-ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2);opacity:0}}.leaflet-container{border-radius:0 0 12px 12px;}`;
        document.head.appendChild(s);
      }

      markerRef.current = L.marker([36.5, -93.5], { icon: pulsingIcon, opacity: 0 }).addTo(map);
      polylineRef.current = L.polyline([], { color: '#6366f1', weight: 4, opacity: 0.7, dashArray: '8 4' }).addTo(map);
      mapInstance.current = map;
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
  if (!mapInstance.current || !currentLocation) return;
  const latlng = [currentLocation.latitude, currentLocation.longitude];
  markerRef.current?.setLatLng(latlng);
  markerRef.current?.setOpacity(1); // show marker once we have real coords
  mapInstance.current.setView(latlng, 15, { animate: true });
  const path = locations.map(l => [l.latitude, l.longitude]);
  polylineRef.current?.setLatLngs(path);
}, [locations, currentLocation]);

  return <div ref={mapRef} style={{ width: '100%', height: 280 }} />;
}

export default function ParentFollowUs({ familyId }) {
  const { session, locations, currentLocation, status } = useFieldTripParent(familyId);

  // No trip — show nothing at all so it doesn't take up space
  if (status === 'loading' || status === 'none') return null;

  const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Follow Us</div>
            {session?.note && (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>"{session.note}"</div>
            )}
          </div>
        </div>
        {status === 'active' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(22,163,74,0.15)', color: '#4ade80', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}/>
            Live
          </div>
        ) : (
          <div style={{ background: 'var(--input-bg)', color: 'var(--text-faint)', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
            Trip Ended
          </div>
        )}
      </div>

      {/* Map */}
      <MapView locations={locations} currentLocation={currentLocation} />

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text-faint)' }}>{status === 'ended' ? 'Trip ended' : 'Last updated'}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{status === 'ended' ? fmt(session?.ended_at) : fmt(currentLocation?.created_at)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text-faint)' }}>Trip started</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(session?.started_at)}</span>
        </div>
        {currentLocation?.accuracy && status === 'active' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-faint)' }}>GPS accuracy</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>±{Math.round(currentLocation.accuracy)}m</span>
          </div>
        )}
        {status === 'ended' && (
          <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
            The babysitter has ended the field trip.
          </div>
        )}
      </div>
    </div>
  );
}
