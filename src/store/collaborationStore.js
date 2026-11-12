import { create } from 'zustand';

const useCollaborationStore = create((set, _get) => ({
  sessionId: null,
  isHost: false,
  disconnectUser: null,
  peerList: [],

  setSession: (sessionId, isHost = false) => set({ sessionId, isHost }),
  setDisconnectUser: (fn) => set({ disconnectUser: fn }),
  setPeerList: (peerList) => set({ peerList }),
  clearSession: () => set({ sessionId: null, isHost: false, disconnectUser: null, peerList: [] }),
}));

export default useCollaborationStore;