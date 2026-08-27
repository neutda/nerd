import type { ErdDocument } from '../erd/model'

export type CollabClientRole = 'host' | 'viewer'

export type CollabWsClientMessage =
  | { type: 'join'; roomId: string; clientId: string; role: CollabClientRole; name?: string }
  | { type: 'leave'; roomId: string; clientId: string }
  | { type: 'presence'; roomId: string; clientId: string }
  | { type: 'op'; roomId: string; clientId: string; op: unknown }
  | { type: 'snapshot'; roomId: string; clientId: string; document: ErdDocument }

export type CollabWsServerMessage =
  | { type: 'joined'; roomId: string; snapshot: ErdDocument | null; viewers: CollabViewer[] }
  | { type: 'error'; message: string }
  | { type: 'presence'; viewers: CollabViewer[] }
  | { type: 'snapshot'; document: ErdDocument }

export interface CollabViewer {
  clientId: string
  name: string
  role: CollabClientRole
  joinedAt: string
}

export interface CollabRoom {
  id: string
  name: string
  createdAt: string
  snapshot: ErdDocument | null
  viewers: CollabViewer[]
}

export interface CreateRoomRequest {
  name?: string
  snapshot?: ErdDocument | null
}

export interface CreateRoomResponse {
  room: CollabRoom
  wsUrl: string
  viewUrl: string
}

export interface CollabHealthResponse {
  ok: true
  service: 'nerd-collab'
  version: 1
}

export interface CollabHostResult {
  running: true
  port: number
  roomId: string
  lanUrl: string
  localUrl: string
  viewUrl: string
  wsUrl: string
}
