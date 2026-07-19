/** @type {import('@liveblocks/client').ResolveUsersArgs} */
export const resolveUsers = async ({ userIds }) => {
  // Return a list of users that match the userIds provided
  // In a real application, you would fetch this data from your own database
  return await Promise.all(
    userIds.map(async (userId) => ({
      id: userId,
      avatar: `https://liveblocks.io/avatars/avatar-${Math.round(Math.random() * 30)}.png`,
      name: `User ${userId}`,
    }))
  );
};

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
