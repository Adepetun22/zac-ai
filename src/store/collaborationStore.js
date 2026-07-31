import { create } from 'zustand';

const useCollaborationStore = create((set, get) => ({
  sessionId: null,
  isHost: false,
  disconnectUser: null,

  setSession: (sessionId, isHost = false) => set({ sessionId, isHost }),
  setDisconnectUser: (fn) => set({ disconnectUser: fn }),
  clearSession: () => set({ sessionId: null, isHost: false, disconnectUser: null }),
}));

export default useCollaborationStore;
