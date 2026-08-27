import { watch } from 'vue'
import { serializeErdDocument } from '@shared/erd/serialize'
import { useCollabStore } from '@renderer/stores/collab'
import { useErdStore } from '@renderer/stores/erd'

export function useCollabSync(): void {
  const collab = useCollabStore()
  const erd = useErdStore()

  watch(
    () => {
      const tabId = collab.session?.tabId
      if (!tabId) return ''
      const tab = erd.tabs.find((item) => item.id === tabId)
      return tab ? serializeErdDocument(tab.document) : ''
    },
    () => {
      collab.queueSend()
    }
  )
}
