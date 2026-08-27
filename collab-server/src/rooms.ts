import type { CollabRoom, CollabViewer } from '../../src/shared/collab/protocol'
import type { ErdDocument } from '../../src/shared/erd/model'
import { createEmptyDocument } from '../../src/shared/erd/document'
import { randomUUID } from 'node:crypto'

const rooms = new Map<string, CollabRoom>()

export function createRoom(name?: string, snapshot?: ErdDocument | null): CollabRoom {
  const room: CollabRoom = {
    id: randomUUID(),
    name: name?.trim() || 'untitled',
    createdAt: new Date().toISOString(),
    snapshot: snapshot ?? createEmptyDocument(),
    viewers: []
  }
  rooms.set(room.id, room)
  return room
}

export function getRoom(id: string): CollabRoom | undefined {
  return rooms.get(id)
}

export function listRooms(): CollabRoom[] {
  return [...rooms.values()]
}

export function setSnapshot(id: string, snapshot: ErdDocument | null): CollabRoom | undefined {
  const room = rooms.get(id)
  if (!room) return undefined
  room.snapshot = snapshot
  return room
}

export function addViewer(roomId: string, viewer: CollabViewer): CollabRoom | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined
  room.viewers = room.viewers.filter((v) => v.clientId !== viewer.clientId)
  room.viewers.push(viewer)
  return room
}

export function removeViewer(roomId: string, clientId: string): CollabRoom | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined
  room.viewers = room.viewers.filter((v) => v.clientId !== clientId)
  return room
}

export function deleteRoom(id: string): boolean {
  return rooms.delete(id)
}
