import { useEffect, useRef, useCallback } from 'react'

// Simulated WS server — replace URL with real ws:// endpoint in production
const SIMULATED_PEERS = [
  { id: 'peer-1', name: 'Alex', color: '#10b981' },
  { id: 'peer-2', name: 'Maya', color: '#f59e0b' },
]

export function useWebSocket({ onCursorMove, onWidgetSync, onPeerJoin, onPeerLeave, onInviteCreate, onPeerInvite }) {
  const intervals = useRef([])
  const connected = useRef(false)

  const send = useCallback((type, payload) => {
    if (type === 'widget:move' || type === 'widget:add') {
      onWidgetSync?.(payload)
    }
    if (type === 'invite:create') {
      onInviteCreate?.(payload)
    }
    if (type === 'peer:invite') {
      onPeerInvite?.(payload)
    }
  }, [onWidgetSync, onInviteCreate, onPeerInvite])

  useEffect(() => {
    connected.current = true

    // Simulate peers joining
    const joinTimers = SIMULATED_PEERS.map((peer, i) =>
      setTimeout(() => {
        if (!connected.current) return
        onPeerJoin?.(peer)

        // Simulate cursor movement for each peer
        const interval = setInterval(() => {
          if (!connected.current) return
          onCursorMove?.({
            peerId: peer.id,
            name: peer.name,
            color: peer.color,
            x: 100 + Math.random() * (window.innerWidth - 300),
            y: 100 + Math.random() * (window.innerHeight - 200),
          })
        }, 1200 + i * 400)

        intervals.current.push(interval)
      }, 800 + i * 600)
    )

    return () => {
      connected.current = false
      joinTimers.forEach(clearTimeout)
      intervals.current.forEach(clearInterval)
      SIMULATED_PEERS.forEach(peer => onPeerLeave?.(peer.id))
    }
  }, [])

  return { send }
}
