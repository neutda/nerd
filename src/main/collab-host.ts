import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import type { CollabHostResult } from '../shared/collab/protocol'
import type { ErdDocument } from '../shared/erd/model'

let child: ChildProcess | null = null
let started: CollabHostResult | null = null

function projectRoot(): string {
  return join(__dirname, '../..')
}

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
    const server = createServer()
    server.listen(0, '0.0.0.0', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
    server.on('error', reject)
  })
}

async function waitForHealth(port: number, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('협업 서버가 시간 안에 시작되지 않았습니다.')
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
  const script = join(projectRoot(), 'collab-server/src/index.ts')
  const command = `npx tsx "${script}"`

  child = spawn(command, {
    cwd: projectRoot(),
    env: { ...process.env, PORT: String(port), HOST: '0.0.0.0' },
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout?.on('data', (buf) => console.log('[collab]', String(buf).trim()))
  child.stderr?.on('data', (buf) => console.error('[collab]', String(buf).trim()))
  child.on('exit', () => {
    child = null
    started = null
  })

  try {
    await waitForHealth(port)
    const created = await fetch(`http://127.0.0.1:${port}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: payload.roomName, snapshot: payload.snapshot })
    })
    if (!created.ok) {
      throw new Error(`방 생성 실패 (${created.status})`)
    }
    const body = (await created.json()) as { room: { id: string }; viewUrl: string; wsUrl: string }
    const ip = lanIPv4()
    started = {
      running: true,
      port,
      roomId: body.room.id,
      lanUrl: `http://${ip}:${port}`,
      localUrl: `http://127.0.0.1:${port}`,
      viewUrl: `http://${ip}:${port}/rooms/${body.room.id}`,
      wsUrl: `ws://${ip}:${port}/ws`
    }
    return started
  } catch (error) {
    await stopCollabHost()
    throw error
  }
}

export async function stopCollabHost(): Promise<void> {
  const current = child
  child = null
  started = null
  if (!current) return
  await new Promise<void>((resolve) => {
    const done = (): void => resolve()
    current.once('exit', done)
    current.kill()
    setTimeout(() => {
      if (!current.killed) current.kill('SIGKILL')
      done()
    }, 1500)
  })
}
