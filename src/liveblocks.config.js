/** @type {import('@liveblocks/client').ResolveUsersArgs} */
import { supabase } from './config/supabase';

export const resolveUsers = async ({ userIds }) => {
  if (!supabase) {
    return userIds.map((userId) => ({
      id: userId,
      avatar: `https://liveblocks.io/avatars/avatar-${Math.abs(hashCode(userId)) % 30}.png`,
      name: `User ${userId.slice(0, 8)}`,
    }));
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', userIds);

    if (error || !data) {
      return userIds.map((userId) => ({
        id: userId,
        avatar: `https://liveblocks.io/avatars/avatar-${Math.abs(hashCode(userId)) % 30}.png`,
        name: `User ${userId.slice(0, 8)}`,
      }));
    }

    const profileMap = new Map(data.map((p) => [p.id, p]));
    return userIds.map((userId) => {
      const profile = profileMap.get(userId);
      return {
        id: userId,
        avatar: profile?.avatar_url || `https://liveblocks.io/avatars/avatar-${Math.abs(hashCode(userId)) % 30}.png`,
        name: profile?.name || profile?.email || `User ${userId.slice(0, 8)}`,
      };
    });
  } catch {
    return userIds.map((userId) => ({
      id: userId,
      avatar: `https://liveblocks.io/avatars/avatar-${Math.abs(hashCode(userId)) % 30}.png`,
      name: `User ${userId.slice(0, 8)}`,
    }));
  }
};

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** @type {import('@liveblocks/client').ResolveRoomsInfoArgs} */
export const resolveRooms = async ({ roomIds }) => {
  // Return a list of rooms that match the roomIds provided
  // In a real application, you would fetch this data from your own database
  return await Promise.all(
    roomIds.map(async (roomId) => ({
      id: roomId,
      name: `Room ${roomId}`,
    }))
  );
};
