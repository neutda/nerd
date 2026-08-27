import { onUnmounted, watch } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { serializeAutosave } from '@shared/erd/autosave'

const DEBOUNCE_MS = 200

export function useAutosave() {
  const erd = useErdStore()
  let timer: ReturnType<typeof setTimeout> | null = null
  let ready = false
  let lastSnapshot = ''
  let writing: Promise<void> | null = null

  function snapshot(): string {
    return JSON.stringify({
      filePath: erd.filePath,
      dirty: erd.dirty,
      document: erd.document
    })
  }

  async function flush(): Promise<void> {
    if (!ready || !window.nerd) return
    const current = snapshot()
    if (current === lastSnapshot) return
    const content = serializeAutosave({
      filePath: erd.filePath,
      dirty: erd.dirty,
      document: erd.document
    })
    writing = window.nerd
      .saveDraft(content)
      .then(() => {
        lastSnapshot = current
        if (erd.dirty) erd.draftSavedAt = Date.now()
      })
      .catch(() => undefined)
      .finally(() => {
        writing = null
      })
    await writing
  }

  function schedule(): void {
    if (!ready) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, DEBOUNCE_MS)
  }

  async function restore(): Promise<void> {
    if (window.nerd) {
      const result = await window.nerd.loadDraft()
      if (result.found && result.content) {
        erd.restoreAutosave(result.content)
      }
    }
    lastSnapshot = snapshot()
    erd.resetHistory()
    ready = true
  }

  const stop = watch(
    () => [erd.document, erd.filePath, erd.dirty] as const,
    schedule,
    { deep: true }
  )

  function onHide(): void {
    if (document.visibilityState === 'hidden') void flush()
  }

  window.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', () => void flush())

  onUnmounted(() => {
    stop()
    if (timer) clearTimeout(timer)
    window.removeEventListener('visibilitychange', onHide)
    void flush()
  })

  return { restore, flush }
}
