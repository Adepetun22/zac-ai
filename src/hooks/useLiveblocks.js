import { useState, useEffect, useCallback, useRef } from 'react';
import { enterLiveblocksRoom } from '../config/liveblocks';

/**
 * Custom hook for managing Liveblocks collaboration functionality.
 *
 * Now tracks the connection status (`initializing` | `connecting` | `connected`
 * | `disconnected` | `auth-error` | `error`) so the UI can show a banner when
 * Liveblocks is failing to authenticate, instead of silently showing "0 users".
 *
 * @param {string} roomId - The ID of the Liveblocks room to join
 */
export const useLiveblocks = (roomId, currentUser = null) => {
  const [roomData, setRoomData] = useState({
    room: null,
    users: [],
    others: [],
    cursor: null,
    error: null,
    status: 'initializing',
  });
  const mountedRef = useRef(true);
  const lastOthersUpdateRef = useRef(0); // Track last update time to prevent excessive updates

  useEffect(() => {
    mountedRef.current = true;

    let unsubscribeOthers = () => {};
    let unsubscribeStatus = () => {};
    let leave = () => {};

    try {
      const entered = enterLiveblocksRoom(roomId);
      const liveblocksRoom = entered.room;
      leave = entered.leave || (() => {});

      if (mountedRef.current) {
        setRoomData(prev => ({ ...prev, room: liveblocksRoom, status: 'connecting' }));

        if (currentUser?.name) {
          liveblocksRoom.updatePresence({ name: currentUser.name, userId: currentUser.id });
        }

        // Track connection status so the UI can show "Liveblocks: not connected"
        // when auth fails (token mint endpoint missing, secret key missing, etc).
        unsubscribeStatus = liveblocksRoom.subscribe('status', (status) => {
          if (!mountedRef.current) return;
          // status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
          const mapped = status === 'connected' ? 'connected'
            : status === 'disconnected' ? 'disconnected'
            : 'connecting'
          setRoomData(prev => ({ ...prev, status: mapped, error: status === 'disconnected' ? prev.error : null }))
        })

        unsubscribeOthers = liveblocksRoom.subscribe('others', (others) => {
          const now = Date.now();
          if (now - lastOthersUpdateRef.current < 100) return;
          lastOthersUpdateRef.current = now;

          if (mountedRef.current) {
            const othersArray = toothersArrayInner(others);
            setRoomData(prev => ({
              ...prev,
              others: othersArray,
              users: othersArray.map(user => ({
                id: user.connectionId,
                userId: user.presence.userId,
                name: user.presence.name || `User ${user.connectionId}`,
                cursor: user.presence.cursor,
                selection: user.presence.selection,
              })),
              otherUserCount: othersArray.length,
              status: prev.status === 'initializing' || prev.status === 'connecting' ? 'connected' : prev.status,
            }));
          }
        });

        // Surface auth errors thrown by authEndpoint so the UI can tell the user
        // to fix their backend config (missing LIVEBLOCKS_SECRET_KEY, etc.) instead
        // of a silent "0 collaborators" forever.
        if (typeof liveblocksRoom.subscribe === 'function') {
          const unsubscribeError = liveblocksRoom.subscribe('error', (err) => {
            if (!mountedRef.current) return;
            const message = err?.message || String(err)
            console.error('[Liveblocks] room error:', message)
            const isAuthError = /forbidden|unauthor/i.test(message)
            setRoomData(prev => ({
              ...prev,
              status: isAuthError ? 'auth-error' : 'error',
              error: message,
            }))
          })
          const previousStatus = unsubscribeStatus
          unsubscribeStatus = () => { previousStatus(); unsubscribeError() }
        }
      }
    } catch (err) {
      console.error('Error entering Liveblocks room:', err);
      if (mountedRef.current) {
        setRoomData(prev => ({
          ...prev,
          status: 'error',
          error: err?.message || String(err),
        }));
      }
    }

    return () => {
      mountedRef.current = false;
      unsubscribeOthers();
      unsubscribeStatus();
      try { leave() } catch { /* ignore */ }
    };
  }, [roomId, currentUser?.name]);

  const updateCursor = useCallback((newCursor) => {
    if (roomData.room) {
      roomData.room.updatePresence({ cursor: newCursor });
      setRoomData(prev => ({ ...prev, cursor: newCursor }));
    }
  }, [roomData.room]);

  const updateName = useCallback((name) => {
    if (roomData.room) {
      roomData.room.updatePresence({ name });
    }
  }, [roomData.room]);

  const updateSelection = useCallback((selection) => {
    if (roomData.room) {
      roomData.room.updatePresence({ selection });
    }
  }, [roomData.room]);

  const sendNotification = useCallback((message) => {
    if (roomData.room) {
      roomData.room.updatePresence({ notification: message });
    }
  }, [roomData.room]);

  const clearNotification = useCallback(() => {
    if (roomData.room) {
      roomData.room.updatePresence({ notification: null });
    }
  }, [roomData.room]);

  return {
    room: roomData.room,
    users: roomData.users,
    others: roomData.others,
    otherUserCount: roomData.others.length,
    cursor: roomData.cursor,
    error: roomData.error,
    status: roomData.status,
    updateCursor,
    updateName,
    updateSelection,
    sendNotification,
    clearNotification,
    isLiveblocksEnabled: !!roomData.room,
  };
};

// Internal helper, defined outside the component so it can be hoisted.
function toothersArrayInner(others) {
  if (!others) return [];
  if (typeof others.toArray === 'function') return others.toArray();
  if (Array.isArray(others)) return others;
  return Array.from(others);
}