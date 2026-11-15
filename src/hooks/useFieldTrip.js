// src/hooks/useFieldTrip.js
// Core hook for Field Trip GPS tracking feature

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Minimum milliseconds between Supabase writes — watchPosition can fire
// multiple times per second on mobile; we only need a ping every 15s.
const PING_INTERVAL_MS = 15_000;

// ─────────────────────────────────────────────
// BABYSITTER HOOK – start/stop trips, send GPS
// ─────────────────────────────────────────────
export function useFieldTripSitter(sitterId, checkedInChildren = []) {
  const [session,       setSession]       = useState(null);
  const [isTracking,    setIsTracking]    = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [lastPing,      setLastPing]      = useState(null);
  const [loading,       setLoading]       = useState(false);

  const watchIdRef   = useRef(null);   // watchPosition id
  const sessionRef   = useRef(null);   // always mirrors session state for callbacks
  const lastSentRef  = useRef(0);      // timestamp of last successful DB write

  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Send one location ping (throttled to PING_INTERVAL_MS) ──────────────
  const sendLocation = useCallback(async (sessionId, position) => {
    const now = Date.now();
    if (now - lastSentRef.current < PING_INTERVAL_MS) return; // throttle
    lastSentRef.current = now;

    const { latitude, longitude, accuracy } = position.coords;
    const { error } = await supabase.from('field_trip_locations').insert({
      session_id: sessionId,
      latitude,
      longitude,
      accuracy,
    });
    if (!error) setLastPing(new Date());
    else console.warn('Location insert error:', error.message);
  }, []);

  // ── Start watchPosition stream ───────────────────────────────────────────
  // FIX: was using setInterval + getCurrentPosition, which is a one-shot call
  // that silently dies when the tab loses focus or the timeout hits. watchPosition
  // is the correct API — it streams continuously and auto-recovers on signal loss.
  const startGpsWatch = useCallback((sessionId) => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    // Clear any stale watcher first
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(sessionId, pos),
      (err) => {
        console.warn('GPS watch error:', err.message);
        setLocationError(getGpsErrorMessage(err));
      },
      GPS_OPTIONS
    );
  }, [sendLocation]);

  // ── Stop watcher ─────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastSentRef.current = 0;
  }, []);

  // ── Resume active session on mount (e.g. sitter refreshed the page) ─────
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
  }, [sitterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start a new trip ─────────────────────────────────────────────────────
  const startTrip = useCallback(async (note = '') => {
    setLocationError(null);
    setLoading(true);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLoading(false);
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sess, error: sessErr } = await supabase
        .from('field_trip_sessions')
        .insert({ sitter_id: sitterId, created_by: user.id, note })
        .select()
        .single();

      if (sessErr) throw sessErr;

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

  // ── Stop a trip ──────────────────────────────────────────────────────────
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
  }, [cleanup]);

  // ── Auto-end session if sitter closes the browser ────────────────────────
  // FIX: was sending to /api/field-trip-stop which doesn't exist in a Vite app.
  // sendBeacon doesn't support custom headers, so we call the Supabase REST
  // endpoint directly using the PATCH method with keepalive via fetch instead.
  useEffect(() => {
    const handleUnload = () => {
      const sess = sessionRef.current;
      if (!sess || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
      const url = `${SUPABASE_URL}/rest/v1/field_trip_sessions?id=eq.${sess.id}`;
      // fetch with keepalive survives page unload; sendBeacon can't set headers
      fetch(url, {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
      }).catch(() => {}); // best-effort; ignore errors on unload
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return { session, isTracking, locationError, lastPing, loading, startTrip, stopTrip };
}

// ─────────────────────────────────────────────
// PARENT HOOK – subscribe to live location
// ─────────────────────────────────────────────
export function useFieldTripParent(familyId) {
  const [session,   setSession]   = useState(null);
  const [locations, setLocations] = useState([]);
  const [status,    setStatus]    = useState('loading');
  const channelRef  = useRef(null);
  const endTimerRef = useRef(null);

  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;

    (async () => {
      // FIX: added .order + .limit(1) so maybeSingle() never throws when
      // multiple sessions exist (RLS narrows to this family's sessions only).
      const { data: sess } = await supabase
        .from('field_trip_sessions')
        .select('*')
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (!sess) { setStatus('none'); return; }

      setSession(sess);
      setStatus('active');

      const { data: locs } = await supabase
        .from('field_trip_locations')
        .select('*')
        .eq('session_id', sess.id)
        .gte('created_at', sess.started_at)
        .order('created_at', { ascending: true });

      if (!cancelled) setLocations(locs || []);

      channelRef.current = supabase
        .channel(`field-trip-${sess.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'field_trip_locations', filter: `session_id=eq.${sess.id}` },
          (payload) => { setLocations((prev) => [...prev, payload.new]); }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'field_trip_sessions', filter: `id=eq.${sess.id}` },
          (payload) => {
            if (!payload.new.is_active) {
              setStatus('ended');
              setSession(payload.new);
              // Auto-hide the card 60 seconds after the trip ends so it
              // doesn't sit on screen indefinitely.
              endTimerRef.current = setTimeout(() => setStatus('none'), 60_000);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      clearTimeout(endTimerRef.current);
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
  timeout: 30_000,   // increased — high-accuracy GPS can take longer to acquire
  maximumAge: 10_000, // accept a cached fix up to 10s old between watchPosition callbacks
};

function getGpsErrorMessage(err) {
  switch (err.code) {
    case 1: return 'Location permission denied. Please allow location access in your browser settings.';
    case 2: return 'Location unavailable. Please check your device GPS settings.';
    case 3: return 'Location request timed out. Please try again.';
    default: return 'An unknown location error occurred.';
  }
}
