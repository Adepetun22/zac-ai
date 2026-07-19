import { createClient } from "@liveblocks/client";

// Initialize the Liveblocks client with the public API key from environment variables
// Following the project specification that requires VITE_LIVEBLOCKS_PUBLIC_KEY
const publicApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;

if (!publicApiKey) {
  console.warn("VITE_LIVEBLOCKS_PUBLIC_KEY is not defined. Liveblocks functionality will be disabled.");
}

// Create the Liveblocks client
export const liveblocksClient = publicApiKey 
  ? createClient({
      publicApiKey: publicApiKey,
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
        getStorage: () => ({ root: new Map() }),
        getSelf: () => ({ id: 'mock-user', info: { name: 'Mock User' } }),
      },
      leave: () => {},
    };
  }

  return liveblocksClient.enterRoom(roomId, {
    initialStorage: () => new Map(),
    initialPresence: () => ({ cursor: null, name: '', selection: [] }),
  });
};