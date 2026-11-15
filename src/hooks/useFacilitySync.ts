import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookingInput, FacilityState, GateEvent, ValidationResult } from '../shared/parkingLogic.ts';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface ApiActionResponse {
  ok: boolean;
  error?: string;
  fieldErrors?: ValidationResult['fieldErrors'];
}

export function useFacilitySync() {
  const [facilityState, setFacilityState] = useState<FacilityState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [clientCount, setClientCount] = useState<number>(1);
  const [latestEvent, setLatestEvent] = useState<GateEvent | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const unmountedRef = useRef(false);

  const applyFacilityState = useCallback((next: FacilityState) => {
    setFacilityState((prev) =>
      prev && prev.lastUpdated === next.lastUpdated ? prev : next,
    );
  }, []);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { state: FacilityState; clientCount?: number };
      if (!unmountedRef.current) {
        applyFacilityState(data.state);
        if (typeof data.clientCount === 'number') setClientCount(data.clientCount);
        setFetchError(null);
      }
    } catch (err) {
      if (!unmountedRef.current) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load facility state');
      }
    }
  }, [applyFacilityState]);

  useEffect(() => {
    unmountedRef.current = false;
    void loadSnapshot();

    const connectWs = () => {
      if (unmountedRef.current) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');
        ws.send(JSON.stringify({ type: 'state:request' }));
      };

      ws.onmessage = (evt) => {
        if (unmountedRef.current) return;
        try {
          const msg = JSON.parse(String(evt.data)) as {
            type?: string;
            state?: FacilityState;
            event?: GateEvent | null;
            clientCount?: number;
          };
          if ((msg.type === 'state:init' || msg.type === 'state:sync') && msg.state) {
            applyFacilityState(msg.state);
            setFetchError(null);
            if (msg.event) setLatestEvent(msg.event);
          }
          if (typeof msg.clientCount === 'number') {
            setClientCount(msg.clientCount);
          }
        } catch {
          // Ignore invalid JSON frames
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnectionStatus('reconnecting');
        const delay = Math.min(4000, 600 * Math.pow(1.6, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [applyFacilityState, loadSnapshot]);

  const postAction = useCallback(async (url: string, body?: unknown): Promise<ApiActionResponse> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const payload = (await res.json()) as {
        state?: FacilityState;
        event?: GateEvent;
        error?: string;
        fieldErrors?: ValidationResult['fieldErrors'];
      };
      if (!res.ok) {
        return {
          ok: false,
          error: payload.error ?? 'Request failed',
          fieldErrors: payload.fieldErrors,
        };
      }
      if (payload.state) applyFacilityState(payload.state);
      if (payload.event) setLatestEvent(payload.event);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }, [applyFacilityState]);

  const createBooking = useCallback(
    (input: BookingInput) => postAction('/api/bookings', input),
    [postAction],
  );

  const walkInBay = useCallback(
    (bayId: string, input: Omit<BookingInput, 'bayId'>) =>
      postAction(`/api/bays/${encodeURIComponent(bayId)}/walkin`, input),
    [postAction],
  );

  const checkInBooking = useCallback(
    (bookingId: string) => postAction(`/api/bookings/${encodeURIComponent(bookingId)}/checkin`),
    [postAction],
  );

  const releaseBay = useCallback(
    (bayId: string) => postAction(`/api/bays/${encodeURIComponent(bayId)}/release`),
    [postAction],
  );

  const simulateTraffic = useCallback(() => postAction('/api/simulate'), [postAction]);

  return {
    facilityState,
    connectionStatus,
    clientCount,
    latestEvent,
    fetchError,
    reloadSnapshot: loadSnapshot,
    createBooking,
    walkInBay,
    checkInBooking,
    releaseBay,
    simulateTraffic,
  };
}
