import { createClient } from "@liveblocks/client";
import { resolveUsers, resolveRooms } from "../liveblocks.config";
import { createLiveblocksAuthEndpoint } from "../services/liveblocksAuth";

// Initialize the Liveblocks client. We require BOTH a publicApiKey (used as
// the project's public identifier) AND an authEndpoint (which mints per-user
// tokens via our backend). Without authEndpoint, the WebSocket connection
// fails with "Timed out during websocket connection" because the client
// cannot authenticate.
export const publicApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;

if (!publicApiKey) {
  console.warn("VITE_LIVEBLOCKS_PUBLIC_KEY is not defined. Liveblocks functionality will be disabled.");
}

const authEndpoint = publicApiKey ? createLiveblocksAuthEndpoint() : null;

export const liveblocksClient = publicApiKey && authEndpoint
  ? createClient({
      publicApiKey,
      authEndpoint,
      resolveUsers,
      resolveRooms,
    })
  : null;

export const liveblocksAuthEndpoint = authEndpoint;

// Export a function to enter a room
export const enterLiveblocksRoom = (roomId) => {
  if (!liveblocksClient) {
    console.warn("Liveblocks client not initialized. Returning mock room functions.");

    return {
      room: {
        subscribe: () => () => {},
        batch: (callback) => callback(),
        getStorage: () => Promise.resolve({ root: { toImmutable: () => ({}) } }),
        getSelf: () => ({ id: "mock-user", info: { name: "Mock User" } }),
        updatePresence: () => {},
        history: {
          undo: () => {},
          redo: () => {},
        },
      },
      leave: () => {},
    };
  }

  return liveblocksClient.enterRoom(roomId, {
    initialPresence: () => ({ cursor: null, name: "", userId: null, selection: [] }),
  });
};