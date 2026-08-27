import { defineStore } from 'pinia'

export interface MenuItem {
  id?: string
  label?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  action?: () => void
}

interface MenuState {
  open: boolean
  x: number
  y: number
  items: MenuItem[]
}

export const useMenuStore = defineStore('menu', {
  state: (): MenuState => ({
    open: false,
    x: 0,
    y: 0,
    items: []
  }),
  actions: {
    show(event: MouseEvent, items: MenuItem[]): void {
      event.preventDefault()
      event.stopPropagation()
      this.x = event.clientX
      this.y = event.clientY
      this.items = items
      this.open = true
    },
    hide(): void {
      this.open = false
      this.items = []
    }
  }
})
