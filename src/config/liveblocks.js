import { createClient } from "@liveblocks/client";
import { resolveUsers, resolveRooms } from "../liveblocks.config";

// Initialize the Liveblocks client with the public API key from environment variables
// Following the project specification that requires VITE_LIVEBLOCKS_PUBLIC_KEY
export const publicApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;

if (!publicApiKey) {
  console.warn("VITE_LIVEBLOCKS_PUBLIC_KEY is not defined. Liveblocks functionality will be disabled.");
}

// Create the Liveblocks client
export const liveblocksClient = publicApiKey
  ? createClient({
      publicApiKey: publicApiKey,
      resolveUsers,
      resolveRooms,
    })
  : null;

// Export a function to enter a room
export const enterLiveblocksRoom = (roomId) => {
  if (!liveblocksClient) {
    console.warn("Liveblocks client not initialized. Returning mock room functions.");

    // Mock implementation for when Liveblocks is not configured
    return {
      room: {
        subscribe: () => () => {},
        batch: (callback) => callback(),
        getStorage: () => Promise.resolve({ root: { toImmutable: () => ({}) } }),
        getSelf: () => ({ id: "mock-user", info: { name: "Mock User" } }),
        updateMyPresence: () => {},
        history: {
          undo: () => {},
          redo: () => {},
        },
      },
      leave: () => {},
    };
  }

  return liveblocksClient.enterRoom(roomId, {
    initialPresence: () => ({ cursor: null, name: "", selection: [] }),
  });
};
