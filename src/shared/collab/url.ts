import type { CollabJoinTarget } from './protocol'

export function formatJoinUrl(host: string, port: number, roomId: string): string {
  return `nerd-collab://${host}:${port}/${roomId}`
}

export function parseJoinInput(raw: string): CollabJoinTarget | null {
  const input = raw.trim()
  if (!input) return null

  const tryUrl = (value: string): CollabJoinTarget | null => {
    try {
      const url = new URL(value)
      const host = url.hostname
      const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
      const fromPath = url.pathname.split('/').filter(Boolean)
      const roomFromQuery = url.searchParams.get('room')
      let roomId = roomFromQuery || ''
      if (!roomId && fromPath[0] === 'rooms' && fromPath[1]) roomId = fromPath[1]
      else if (!roomId && fromPath.length >= 1) roomId = fromPath[fromPath.length - 1]
      if (!host || !port || !roomId) return null
      return { host, port, roomId }
    } catch {
      return null
    }
  }

  if (/^nerd-collab:\/\//i.test(input)) {
    return tryUrl(input.replace(/^nerd-collab:\/\//i, 'http://'))
  }
  if (/^https?:\/\//i.test(input) || /^wss?:\/\//i.test(input)) {
    const httpLike = input.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://')
    return tryUrl(httpLike)
  }

  const compact = input.match(/^([^:/]+)(?::(\d+))?\/([0-9a-f-]{8,})$/i)
  if (compact) {
    return {
      host: compact[1],
      port: compact[2] ? Number(compact[2]) : 4780,
      roomId: compact[3]
    }
  }
  return null
}

export function wsUrlFor(target: CollabJoinTarget): string {
  return `ws://${target.host}:${target.port}/ws`
}

export function viewUrlFor(target: CollabJoinTarget): string {
  return `http://${target.host}:${target.port}/rooms/${target.roomId}`
}
