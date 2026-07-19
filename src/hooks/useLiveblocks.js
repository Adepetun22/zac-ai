import { useState, useEffect, useCallback, useRef } from 'react';
import { enterLiveblocksRoom } from '../config/liveblocks';

/**
 * Custom hook for managing Liveblocks collaboration functionality
 * @param {string} roomId - The ID of the Liveblocks room to join
 */
export const useLiveblocks = (roomId, currentUser = null) => {
  const [roomData, setRoomData] = useState({ room: null, users: [], others: [], cursor: null, error: null });
  const mountedRef = useRef(true);

  // Normalize the "others" payload into a plain array regardless of shape
  const toOthersArray = (others) => {
    if (!others) return [];
    if (typeof others.toArray === 'function') return others.toArray();
    if (Array.isArray(others)) return others;
    return Array.from(others);
  };

  // Join the room when component mounts
  useEffect(() => {
    mountedRef.current = true;
    
    try {
      const { room: liveblocksRoom, leave } = enterLiveblocksRoom(roomId);
      
      if (mountedRef.current) {
        setRoomData(prev => ({ ...prev, room: liveblocksRoom }));
        
        // Publish our identity so other users see a real name instead of "User <id>"
        if (currentUser?.name) {
          liveblocksRoom.updateMyPresence({ name: currentUser.name });
        }
        
        // Subscribe to other users in the room
        const unsubscribeOthers = liveblocksRoom.subscribe('others', (others) => {
          if (mountedRef.current) {
            const othersArray = toOthersArray(others);
            setRoomData(prev => ({
              ...prev,
              others: othersArray,
              users: othersArray.map(user => ({
                id: user.connectionId,
                name: user.presence.name || `User ${user.connectionId}`,
                cursor: user.presence.cursor,
                selection: user.presence.selection,
              }))
            }));
          }
        });

        // Cleanup function
        return () => {
          unsubscribeOthers();
          leave();
          mountedRef.current = false;
        };
      }
    } catch (err) {
      console.error('Error entering Liveblocks room:', err);
      if (mountedRef.current) {
        setRoomData(prev => ({
          ...prev,
          error: err.message
        }));
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, [roomId, currentUser?.name]);

  const updateCursor = useCallback((newCursor) => {
    if (roomData.room) {
      roomData.room.updateMyPresence({ cursor: newCursor });
      setRoomData(prev => ({ ...prev, cursor: newCursor }));
    }
  }, [roomData.room]);

  const updateName = useCallback((name) => {
    if (roomData.room) {
      roomData.room.updateMyPresence({ name });
    }
  }, [roomData.room]);

  const updateSelection = useCallback((selection) => {
    if (roomData.room) {
      roomData.room.updateMyPresence({ selection });
    }
  }, [roomData.room]);

  return {
    room: roomData.room,
    users: roomData.users,
    others: roomData.others,
    cursor: roomData.cursor,
    error: roomData.error,
    updateCursor,
    updateName,
    updateSelection,
    isLiveblocksEnabled: !!roomData.room,
  };
};