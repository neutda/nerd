import { defineStore } from 'pinia'

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return fallback
    return value === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

interface UiState {
  leftOpen: boolean
  rightOpen: boolean
  snapToGrid: boolean
  helpOpen: boolean
  ddlOpen: boolean
  importOpen: boolean
  zoom: number
  fitNonce: number
  zoomResetNonce: number
  searchFocusNonce: number
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    leftOpen: readFlag('nerd.leftOpen', true),
    rightOpen: readFlag('nerd.rightOpen', true),
    snapToGrid: readFlag('nerd.snapToGrid', true),
    helpOpen: false,
    ddlOpen: false,
    importOpen: false,
    zoom: 1,
    fitNonce: 0,
    zoomResetNonce: 0,
    searchFocusNonce: 0
  }),
  actions: {
    persist(): void {
      writeFlag('nerd.leftOpen', this.leftOpen)
      writeFlag('nerd.rightOpen', this.rightOpen)
      writeFlag('nerd.snapToGrid', this.snapToGrid)
    },
    toggleLeft(): void {
      this.leftOpen = !this.leftOpen
      this.persist()
    },
    toggleRight(): void {
      this.rightOpen = !this.rightOpen
      this.persist()
    },
    toggleBoth(): void {
      const open = !(this.leftOpen && this.rightOpen)
      this.leftOpen = open
      this.rightOpen = open
      this.persist()
    },
    setLeftOpen(open: boolean): void {
      this.leftOpen = open
      this.persist()
    },
    toggleSnap(): void {
      this.snapToGrid = !this.snapToGrid
      this.persist()
    },
    setZoom(zoom: number): void {
      this.zoom = zoom
    },
    requestFitView(): void {
      this.fitNonce += 1
    },
    requestZoomReset(): void {
      this.zoomResetNonce += 1
    },
    requestSearchFocus(): void {
      this.setLeftOpen(true)
      this.searchFocusNonce += 1
    },
    toggleHelp(): void {
      this.helpOpen = !this.helpOpen
    },
    openDdl(): void {
      this.ddlOpen = true
    },
    closeDdl(): void {
      this.ddlOpen = false
    },
    openImport(): void {
      this.importOpen = true
    },
    closeImport(): void {
      this.importOpen = false
    }
  }
})
