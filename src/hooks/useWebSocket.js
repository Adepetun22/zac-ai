import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';

/**
 * Real-time multiplayer presence + cursor sync backed by Supabase Realtime.
 *
 * - Real users join the same `room` (session) channel and appear as peers via
 *   Supabase Presence (no simulated bots).
 * - Cursor moves are broadcast peer-to-peer over the channel (low latency).
 * - Widget changes are broadcast so every participant stays in sync.
 *
 * When Supabase is not configured the hook is a no-op so the page still renders.
 */
export function useWebSocket({
  room,
  user,
  onCursorMove,
  onWidgetSync,
  onPeerJoin,
  onPeerLeave,
}) {
  const channelRef = useRef(null);
  const callbacks = useRef({});

  // Keep latest callbacks available to the channel handlers without re-subscribing.
  useEffect(() => {
    callbacks.current = { onCursorMove, onWidgetSync, onPeerJoin, onPeerLeave };
  }, [onCursorMove, onWidgetSync, onPeerJoin, onPeerLeave]);

  const send = useCallback(async (type, payload) => {
    const channel = channelRef.current;
    if (!channel || channel.state !== 'SUBSCRIBED') return;

    if (type === 'cursor:move') {
      await channel.send({ type: 'broadcast', event: 'cursor', payload });
    } else if (type === 'widget:move' || type === 'widget:add') {
      await channel.send({ type: 'broadcast', event: 'widget', payload: { ...payload, op: type } });
      callbacks.current.onWidgetSync?.(payload);
    } else if (type === 'peer:invite') {
      await channel.send({ type: 'broadcast', event: 'peer-invite', payload });
    } else if (type === 'invite:create') {
      callbacks.current.onPeerInvite?.(payload);
    }
  }, []);

  useEffect(() => {
    if (!supabase || !room || !user?.id) return;

    const channel = supabase.channel(`collab:${room}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            if (p.id !== user.id) callbacks.current.onPeerJoin?.(p);
          });
        });
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p) => {
          if (p.id !== user.id) {
            // Add a delay to ensure proper initialization before triggering join
            setTimeout(() => callbacks.current.onPeerJoin?.(p), 100);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key, oldPresences }) => {
        // Ensure we only process the leave event once
        if (key !== user.id) {
          callbacks.current.onPeerLeave?.(key);
        }
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        callbacks.current.onCursorMove?.(payload);
      })
      .on('broadcast', { event: 'widget' }, ({ payload }) => {
        callbacks.current.onWidgetSync?.(payload);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Track user presence with retry logic in case of failure
        const trackUser = () => {
          channel.track({
            id: user.id,
            name: user.name || 'Anonymous',
            color: user.color,
          }).catch(error => {
            console.warn('Failed to track user presence, retrying...', error);
            // Retry tracking after a short delay
            setTimeout(trackUser, 1000);
          });
        };
        
        trackUser();
      }
    });

    return () => {
      // Only untrack if channel exists and is subscribed
      if (channelRef.current && channelRef.current.state === 'SUBSCRIBED') {
        channel.untrack().catch(() => {}); // Ignore untrack errors
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [room, user?.id, user?.name, user?.color]);

  return { send };
}