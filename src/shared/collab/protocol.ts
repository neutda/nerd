import type { ErdDocument } from '../erd/model'

export type CollabClientRole = 'host' | 'editor' | 'viewer'

export type CollabWsClientMessage =
  | { type: 'join'; roomId: string; clientId: string; role: CollabClientRole; name?: string }
  | { type: 'leave'; roomId: string; clientId: string }
  | { type: 'snapshot'; roomId: string; clientId: string; rev?: number; document: ErdDocument }

export type CollabWsServerMessage =
  | { type: 'joined'; roomId: string; snapshot: ErdDocument | null; rev: number; viewers: CollabViewer[] }
  | { type: 'error'; message: string }
  | { type: 'presence'; viewers: CollabViewer[] }
  | { type: 'snapshot'; document: ErdDocument; rev: number; fromClientId: string }

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
  rev: number
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
  joinUrl: string
}

export interface CollabHealthResponse {
  ok: true
  service: 'nerd-collab'
  version: 2
}

export interface CollabHostResult {
  running: true
  port: number
  roomId: string
  lanUrl: string
  localUrl: string
  viewUrl: string
  wsUrl: string
  joinUrl: string
}

export interface CollabJoinTarget {
  host: string
  port: number
  roomId: string
}
