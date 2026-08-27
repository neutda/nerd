import { createServer as createNetServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import type { CollabHostResult } from '../shared/collab/protocol'
import type { ErdDocument } from '../shared/erd/model'
import { formatJoinUrl } from '../shared/collab/url'
import { startCollabServer, type CollabServerHandle } from '../../collab-server/src/server'
import { createRoom } from '../../collab-server/src/rooms'

let handle: CollabServerHandle | null = null
let started: CollabHostResult | null = null

function lanIPv4(): string {
  const nets = networkInterfaces()
  for (const adapters of Object.values(nets)) {
    for (const info of adapters ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return '127.0.0.1'
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const net = createNetServer()
    net.listen(0, '0.0.0.0', () => {
      const address = net.address()
      const port = typeof address === 'object' && address ? address.port : 0
      net.close((err) => (err ? reject(err) : resolve(port)))
    })
    net.on('error', reject)
  })
}

export function getCollabStatus(): CollabHostResult | { running: false } {
  return started ?? { running: false }
}

export async function startCollabHost(payload: {
  snapshot: ErdDocument
  roomName: string
}): Promise<CollabHostResult> {
  if (started) return started

  const port = await findFreePort()
  handle = await startCollabServer({ host: '0.0.0.0', port })
  const room = createRoom(payload.roomName, payload.snapshot)
  const ip = lanIPv4()
  started = {
    running: true,
    port,
    roomId: room.id,
    lanUrl: `http://${ip}:${port}`,
    localUrl: `http://127.0.0.1:${port}`,
    viewUrl: `http://${ip}:${port}/rooms/${room.id}`,
    wsUrl: `ws://${ip}:${port}/ws`,
    joinUrl: formatJoinUrl(ip, port, room.id)
  }
  return started
}

export async function stopCollabHost(): Promise<void> {
  const current = handle
  handle = null
  started = null
  if (!current) return
  await current.close()
}
