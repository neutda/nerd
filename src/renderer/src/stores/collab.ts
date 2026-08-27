import { defineStore } from 'pinia'
import type { CollabHostResult } from '@shared/collab/protocol'
import { useErdStore } from './erd'

interface CollabState {
  dialogOpen: boolean
  loading: boolean
  error: string
  status: CollabHostResult | { running: false }
}

export const useCollabStore = defineStore('collab', {
  state: (): CollabState => ({
    dialogOpen: false,
    loading: false,
    error: '',
    status: { running: false }
  }),
  getters: {
    running: (state) => state.status.running
  },
  actions: {
    openDialog(): void {
      this.dialogOpen = true
      this.error = ''
      void this.refresh()
    },
    closeDialog(): void {
      this.dialogOpen = false
    },
    async refresh(): Promise<void> {
      if (!window.nerd) return
      this.status = await window.nerd.getCollabStatus()
    },
    async start(): Promise<void> {
      if (!window.nerd) {
        this.error = 'Electron 환경에서만 서버를 시작할 수 있습니다.'
        return
      }
      this.loading = true
      this.error = ''
      try {
        const erd = useErdStore()
        this.status = await window.nerd.startCollabHost({
          snapshot: erd.snapshot(),
          roomName: erd.document.name
        })
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    },
    async stop(): Promise<void> {
      if (!window.nerd) return
      this.loading = true
      this.error = ''
      try {
        await window.nerd.stopCollabHost()
        this.status = { running: false }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    }
  }
})
