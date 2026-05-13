// src/hooks/useMemberLocation.js

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

// ─────────────────────────────────────────────
// PARENT HOOK — share live location
// ─────────────────────────────────────────────
export function useMemberLocationShare({ etaId, familyId, memberId, memberName, active }) {
  const [isSharing,     setIsSharing]     = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [lastPing,      setLastPing]      = useState(null);
  const intervalRef = useRef(null);

  const sendPing = useCallback(async (position) => {
    if (!etaId || !familyId || !memberId) return;
    const { latitude, longitude, accuracy } = position.coords;
    await supabase.from('member_locations').insert({
      eta_id:      etaId,
      family_id:   familyId,
      member_id:   memberId,
      member_name: memberName,
      latitude,
      longitude,
      accuracy,
      is_sharing:  true,
    });
    setLastPing(new Date());
  }, [etaId, familyId, memberId, memberName]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device.');
      return;
    }
    setLocationError(null);
    setIsSharing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPing(pos),
      (err) => setLocationError(getGpsError(err)),
      GPS_OPTIONS
    );
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendPing(pos),
        (err) => console.warn('GPS ping failed:', err.message),
        GPS_OPTIONS
      );
    }, 15_000);
  }, [sendPing]);

  const stopSharing = useCallback(async () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsSharing(false);
    if (etaId && memberId) {
      await supabase
        .from('member_locations')
        .update({ is_sharing: false })
        .eq('eta_id', etaId)
        .eq('member_id', memberId);
    }
  }, [etaId, memberId]);

  useEffect(() => {
    if (!active && isSharing) stopSharing();
  }, [active]);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return { isSharing, locationError, lastPing, startSharing, stopSharing };
}

// ─────────────────────────────────────────────
// SITTER HOOK — watch ALL families for incoming parent locations
// accepts array of familyIds
// ─────────────────────────────────────────────
export function useMemberLocationWatch(familyIds = []) {
  const [sharingMembers, setSharingMembers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!familyIds.length) return;
    let cancelled = false;

    (async () => {
      // Load current active sharing locations across all families
      const { data } = await supabase
        .from('member_locations')
        .select('*')
        .in('family_id', familyIds)
        .eq('is_sharing', true)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      // Keep only latest per member
      const seen = new Set();
      const latest = (data || []).filter(r => {
        if (seen.has(r.member_id)) return false;
        seen.add(r.member_id);
        return true;
      });
      setSharingMembers(latest);

      // Subscribe to realtime for each family
      const channel = supabase.channel(`member-loc-sitter-${familyIds.join('-')}`);

      familyIds.forEach(fid => {
        channel
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'member_locations',
            filter: `family_id=eq.${fid}`,
          }, (payload) => {
            setSharingMembers(prev => {
              const filtered = prev.filter(m => m.member_id !== payload.new.member_id);
              if (!payload.new.is_sharing) return filtered;
              return [...filtered, payload.new];
            });
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'member_locations',
            filter: `family_id=eq.${fid}`,
          }, (payload) => {
            setSharingMembers(prev => {
              const filtered = prev.filter(m => m.member_id !== payload.new.member_id);
              if (!payload.new.is_sharing) return filtered;
              return [...filtered, payload.new];
            });
          });
      });

      channel.subscribe();
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
    };
  }, [familyIds.join(',')]);

  return { sharingMembers };
}

function getGpsError(err) {
  switch (err.code) {
    case 1: return 'Location permission denied. Please allow location access in your browser settings.';
    case 2: return 'Location unavailable. Please check your device GPS.';
    case 3: return 'Location request timed out. Please try again.';
    default: return 'Unknown location error.';
  }
}
