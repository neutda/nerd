import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { useMenuStore } from '@renderer/stores/menu'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useHotkeys() {
  const erd = useErdStore()
  const ui = useUiStore()
  const menu = useMenuStore()

  function onKeydown(event: KeyboardEvent): void {
    const typing = isTypingTarget(event.target)

    if (event.key === 'Escape') {
      menu.hide()
      ui.helpOpen = false
      if (!typing) erd.clearSelection()
      return
    }

    if (!typing && event.key === '?') {
      event.preventDefault()
      ui.toggleHelp()
      return
    }

    if (event.key === 'Delete' && !typing) {
      menu.hide()
      erd.deleteSelection()
    }
  }

  return { onKeydown }
}
