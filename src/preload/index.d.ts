import type { NerdApi } from './index'

declare global {
  interface Window {
    nerd: NerdApi
  }
}

export {}
