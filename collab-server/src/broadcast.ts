import type { WebSocket } from 'ws'
import type { CollabWsServerMessage } from '../../src/shared/collab/protocol'

export function send(socket: WebSocket, payload: CollabWsServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

export function broadcast(
  sockets: Iterable<WebSocket>,
  payload: CollabWsServerMessage,
  except?: WebSocket
): void {
  for (const socket of sockets) {
    if (except && socket === except) continue
    send(socket, payload)
  }
}
