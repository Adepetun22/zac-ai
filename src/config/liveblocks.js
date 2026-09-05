import { createClient } from "@liveblocks/client";
import { resolveUsers, resolveRooms } from "../liveblocks.config";
import { createLiveblocksAuthEndpoint } from "../services/liveblocksAuth";

// We authenticate Liveblocks via a backend `/api/liveblocks-auth` endpoint
// that mints short-lived per-user tokens. That means we use ONLY
// `authEndpoint` — passing `publicApiKey` as well is a hard error in v3
// ("You cannot simultaneously use publicApiKey and authEndpoint").
//
// Note: the Liveblocks dashboard calls this project's identifier the
// "public key", but we never need to ship it to the browser when using
// authEndpoint — the secret key on the backend is what matters.

const authEndpoint = createLiveblocksAuthEndpoint();

export const liveblocksClient = authEndpoint
  ? createClient({
      authEndpoint,
      resolveUsers,
      resolveRooms,
    })
  : null;

// Kept for legacy imports; intentionally undefined so callers fall through
// to the authEndpoint path. The browser never needs the public key.
export const publicApiKey = undefined;
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