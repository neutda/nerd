import { nextTick, onMounted, onUnmounted } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { useCollabStore } from '@renderer/stores/collab'
import { useDocumentSession } from './useDocumentSession'
import type { MenuCommand } from '@shared/menu'

export function useNativeMenu() {
  const erd = useErdStore()
  const ui = useUiStore()
  const collab = useCollabStore()
  const session = useDocumentSession()

  async function handle(command: MenuCommand): Promise<void> {
    switch (command) {
      case 'file:new':
        await session.createNew()
        await nextTick()
        ui.requestFitView()
        return
      case 'file:open':
        await session.open()
        await nextTick()
        ui.requestFitView()
        return
      case 'file:save':
        await session.save()
        return
      case 'file:saveAs':
        await session.saveAs()
        return
      case 'file:exportDdl':
        ui.openDdl()
        return
      case 'file:importDb':
        ui.openImport()
        return
      case 'edit:undo':
        erd.undo()
        return
      case 'edit:redo':
        erd.redo()
        return
      case 'edit:duplicate':
        erd.duplicateSelection()
        return
      case 'edit:delete':
        erd.deleteSelection()
        return
      case 'view:fit':
        ui.requestFitView()
        return
      case 'view:zoomReset':
        ui.requestZoomReset()
        return
      case 'view:toggleLeft':
        ui.toggleLeft()
        return
      case 'view:toggleRight':
        ui.toggleRight()
        return
      case 'view:toggleBoth':
        ui.toggleBoth()
        return
      case 'view:toggleSnap':
        ui.toggleSnap()
        return
      case 'view:arrange':
        erd.arrangeTables()
        await nextTick()
        ui.requestFitView()
        return
      case 'view:search':
        ui.requestSearchFocus()
        return
      case 'view:help':
        ui.toggleHelp()
        return
      case 'tools:host':
        collab.openDialog()
        return
      case 'tools:join':
        collab.openJoinDialog()
        return
    }
  }

  let stop: (() => void) | undefined

  onMounted(() => {
    stop = window.nerd?.onMenuCommand((command) => {
      void handle(command)
    })
  })

  onUnmounted(() => stop?.())
}
