// src/components/FieldTrip/SitterParentMap.jsx
// Shows sitter a live map when any parent shares location via "On My Way"
// Props: familyIds — array of all family UUIDs the sitter is connected to

import { useEffect, useRef, useState } from 'react';
import { useMemberLocationWatch } from '../../hooks/useMemberLocation';

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

function MemberMap({ sharingMembers }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markersRef  = useRef({});
  const [mapReady, setMapReady] = useState(false);

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
        center: [36.5, -93.5],
        zoom: 10,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      if (!document.getElementById('ll-anim')) {
        const s = document.createElement('style');
        s.id = 'll-anim';
        s.textContent = `@keyframes ll-ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2);opacity:0}}.leaflet-container{border-radius:0 0 12px 12px;}`;
        document.head.appendChild(s);
      }

      mapInstance.current = map;
      setMapReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !sharingMembers.length) return;

    ensureLeafletLoaded().then((L) => {
      const bounds = [];

      sharingMembers.forEach(member => {
        const latlng = [member.latitude, member.longitude];
        bounds.push(latlng);

        const firstName = (member.member_name || 'Parent').split(' ')[0];
        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:40px;height:52px;">
            <div style="position:absolute;inset:0 0 12px;border-radius:50%;background:rgba(94,207,170,0.25);animation:ll-ping 1.5s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:8px 8px 20px;border-radius:50%;background:#5ECFAA;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(94,207,170,0.5);"></div>
            <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;background:var(--card-bg,#fff);color:var(--text,#111);padding:1px 5px;border-radius:4px;border:1px solid var(--border,#e5e7eb);">${firstName}</div>
          </div>`,
          iconSize:   [40, 52],
          iconAnchor: [20, 20],
        });

        if (markersRef.current[member.member_id]) {
          markersRef.current[member.member_id].setLatLng(latlng);
        } else {
          markersRef.current[member.member_id] = L.marker(latlng, { icon, opacity: 0 }).addTo(mapInstance.current);
        }
        markersRef.current[member.member_id].setOpacity(1);
      });

      // Remove stale markers
      Object.keys(markersRef.current).forEach(id => {
        if (!sharingMembers.find(m => m.member_id === id)) {
          mapInstance.current.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
      });

      if (bounds.length === 1) {
        mapInstance.current.setView(bounds[0], 15, { animate: true });
      } else if (bounds.length > 1) {
        mapInstance.current.fitBounds(bounds, { padding: [40, 40], animate: true });
      }
    });
  }, [sharingMembers, mapReady]);

  return <div ref={mapRef} style={{ width: '100%', height: 240 }} />;
}

export default function SitterParentMap({ familyIds = [] }) {
  const { sharingMembers } = useMemberLocationWatch(familyIds);

  if (!familyIds.length || !sharingMembers.length) return null;

  const fmt = (ts) => ts
    ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid rgba(94,207,170,.3)',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(58,158,122,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚗</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>On the Way</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {sharingMembers.map(m => m.member_name).join(', ')} {sharingMembers.length === 1 ? 'is' : 'are'} heading over
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(94,207,170,0.15)', color: '#5ECFAA', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ECFAA', display: 'inline-block' }}/>
          Live
        </div>
      </div>

      <MemberMap sharingMembers={sharingMembers} />

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sharingMembers.map(m => (
          <div key={m.member_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-faint)' }}>{m.member_name}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>Updated {fmt(m.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
