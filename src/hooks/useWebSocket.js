import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';

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
  const seenUsersRef = useRef(new Map());

  useEffect(() => {
    callbacks.current = { onCursorMove, onWidgetSync, onPeerJoin, onPeerLeave };
  }, [onCursorMove, onWidgetSync, onPeerJoin, onPeerLeave]);

  const syncPeers = useCallback((state, currentUserId) => {
    const activeUserIds = new Set();
    const presenceByUserId = new Map();

    Object.values(state).forEach((presences) => {
      presences.forEach((p) => {
        const userId = p.userId || p.id;
        if (userId && userId !== currentUserId) {
          activeUserIds.add(userId);
          if (!presenceByUserId.has(userId)) {
            presenceByUserId.set(userId, {
              id: userId,
              name: p.name || 'Anonymous',
              color: p.color,
              connectionId: p.id,
            });
          }
        }
      });
    });

    const seen = seenUsersRef.current;

    presenceByUserId.forEach((presence, userId) => {
      if (!seen.has(userId)) {
        seen.set(userId, 0);
        callbacks.current.onPeerJoin?.(presence);
      }
      seen.set(userId, (seen.get(userId) || 0) + 1);
    });

    seen.forEach((count, userId) => {
      if (!activeUserIds.has(userId)) {
        const newCount = Math.max(0, count - 1);
        if (newCount === 0) {
          seen.delete(userId);
          callbacks.current.onPeerLeave?.(userId);
        } else {
          seen.set(userId, newCount);
        }
      }
    });
  }, []);

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
        syncPeers(state, user.id);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const seen = seenUsersRef.current;
        newPresences.forEach((p) => {
          const userId = p.userId || p.id;
          const normalizedPeer = {
            id: userId,
            name: p.name || 'Anonymous',
            color: p.color,
            connectionId: p.id,
          };
          if (userId && userId !== user.id && !seen.has(userId)) {
            seen.set(userId, 0);
            callbacks.current.onPeerJoin?.(normalizedPeer);
          }
          if (userId && userId !== user.id) {
            seen.set(userId, (seen.get(userId) || 0) + 1);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // We can't reliably map connectionId -> userId here without extra state,
        // so we defer leave handling to the next 'sync' event which has the full picture.
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        callbacks.current.onCursorMove?.(payload);
      })
      .on('broadcast', { event: 'widget' }, ({ payload }) => {
        callbacks.current.onWidgetSync?.(payload);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const trackUser = () => {
          channel.track({
            userId: user.id,
            name: user.name || 'Anonymous',
            color: user.color,
          }).catch(error => {
            console.warn('Failed to track user presence, retrying...', error);
            setTimeout(trackUser, 1000);
          });
        };

        trackUser();
      }
    });

    return () => {
      if (channelRef.current && channelRef.current.state === 'SUBSCRIBED') {
        channelRef.current.untrack().catch(() => {});
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
      seenUsersRef.current.clear();
    };
  }, [room, user?.id, user?.name, user?.color, syncPeers]);

  return { send };
}
