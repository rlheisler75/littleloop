// src/hooks/useFieldTrip.js
// Core hook for Field Trip GPS tracking feature

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // adjust path as needed

// ─────────────────────────────────────────────
// BABYSITTER HOOK – start/stop trips, send GPS
// ─────────────────────────────────────────────
export function useFieldTripSitter(sitterId, checkedInChildren = []) {
  const [session, setSession] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [loading, setLoading] = useState(false);

  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionRef = useRef(null);

  // Keep sessionRef in sync for use inside closures
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Load any existing active session on mount ──
  useEffect(() => {
    if (!sitterId) return;
    (async () => {
      const { data } = await supabase
        .from('field_trip_sessions')
        .select('*')
        .eq('created_by', sitterId)
        .eq('is_active', true)
        .maybeSingle();
      if (data) {
        setSession(data);
        setIsTracking(true);
        startGpsWatch(data.id);
      }
    })();
    return () => cleanup();
  }, [sitterId]);

  const sendLocation = useCallback(async (sessionId, position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const { error } = await supabase.from('field_trip_locations').insert({
      session_id: sessionId,
      latitude,
      longitude,
      accuracy,
    });
    if (!error) setLastPing(new Date());
  }, []);

  const startGpsWatch = useCallback((sessionId) => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    // Immediate first ping
    navigator.geolocation.getCurrentPosition(
      (pos) => sendLocation(sessionId, pos),
      (err) => setLocationError(getGpsErrorMessage(err)),
      GPS_OPTIONS
    );

    // Interval pings every 15 seconds
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(sessionId, pos),
        (err) => console.warn('GPS ping failed:', err.message),
        GPS_OPTIONS
      );
    }, 15_000);
  }, [sendLocation]);

  const startTrip = useCallback(async (note = '') => {
    setLocationError(null);
    setLoading(true);

    // 1. Request GPS permission first
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLoading(false);
      return null;
    }

    try {
      // 2. Create session
      const { data: sess, error: sessErr } = await supabase
        .from('field_trip_sessions')
        .insert({ sitter_id: sitterId, created_by: (await supabase.auth.getUser()).data.user.id, note })
        .select()
        .single();

      if (sessErr) throw sessErr;

      // 3. Link checked-in children
      if (checkedInChildren.length > 0) {
        await supabase.from('field_trip_children').insert(
          checkedInChildren.map((childId) => ({ session_id: sess.id, child_id: childId }))
        );
      }

      setSession(sess);
      setIsTracking(true);
      startGpsWatch(sess.id);
      return sess;
    } catch (err) {
      setLocationError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sitterId, checkedInChildren, startGpsWatch]);

  const stopTrip = useCallback(async () => {
    if (!sessionRef.current) return;
    setLoading(true);
    cleanup();

    const { error } = await supabase
      .from('field_trip_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionRef.current.id);

    if (!error) {
      setSession(null);
      setIsTracking(false);
      setLastPing(null);
    }
    setLoading(false);
  }, []);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Stop tracking if tab/window closes
  useEffect(() => {
    const handleUnload = () => {
      if (sessionRef.current) {
        // Synchronous beacon so it fires even on close
        navigator.sendBeacon?.(
          `/api/field-trip-stop?id=${sessionRef.current.id}`
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return {
    session,
    isTracking,
    locationError,
    lastPing,
    loading,
    startTrip,
    stopTrip,
  };
}

// ─────────────────────────────────────────────
// PARENT HOOK – subscribe to live location
// ─────────────────────────────────────────────
export function useFieldTripParent(familyId) {
  const [session, setSession] = useState(null);
  const [locations, setLocations] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | active | ended | none
  const channelRef = useRef(null);

  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;

    (async () => {
      // Find active session visible to this parent
      const { data: sess } = await supabase
        .from('field_trip_sessions')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (cancelled) return;

      if (!sess) {
        setStatus('none');
        return;
      }

      setSession(sess);
      setStatus('active');

      // Load existing location trail
      const { data: locs } = await supabase
        .from('field_trip_locations')
        .select('*')
        .eq('session_id', sess.id)
        .order('created_at', { ascending: true });

      if (!cancelled) setLocations(locs || []);

      // Subscribe to realtime new pings
      channelRef.current = supabase
        .channel(`field-trip-${sess.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'field_trip_locations', filter: `session_id=eq.${sess.id}` },
          (payload) => {
            setLocations((prev) => [...prev, payload.new]);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'field_trip_sessions', filter: `id=eq.${sess.id}` },
          (payload) => {
            if (!payload.new.is_active) {
              setStatus('ended');
              setSession(payload.new);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
    };
  }, [familyId]);

  const currentLocation = locations.length > 0 ? locations[locations.length - 1] : null;

  return { session, locations, currentLocation, status };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

function getGpsErrorMessage(err) {
  switch (err.code) {
    case 1: return 'Location permission denied. Please allow location access in your browser settings.';
    case 2: return 'Location unavailable. Please check your device GPS settings.';
    case 3: return 'Location request timed out. Please try again.';
    default: return 'An unknown location error occurred.';
  }
}
