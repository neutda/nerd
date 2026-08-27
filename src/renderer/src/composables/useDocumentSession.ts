import { useErdStore } from '@renderer/stores/erd'

function fileStem(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled'
}

export function useDocumentSession() {
  const erd = useErdStore()

  function confirmDiscard(): boolean {
    if (!erd.dirty) return true
    return window.confirm('저장하지 않은 변경이 있습니다. 계속할까요?')
  }

  async function createNew(): Promise<void> {
    if (!confirmDiscard()) return
    erd.newDocument()
  }

  async function open(): Promise<void> {
    if (!window.nerd) return
    if (!confirmDiscard()) return
    const result = await window.nerd.openDocument()
    if (result.canceled || !result.content || !result.path) return
    erd.loadFromJson(result.content, result.path)
  }

  async function saveAs(): Promise<boolean> {
    if (!window.nerd) return false
    const result = await window.nerd.saveDocument(
      erd.toJson(),
      `${fileStem(erd.document.name)}.nerd.json`
    )
    if (result.canceled || !result.path) return false
    erd.filePath = result.path
    erd.dirty = false
    return true
  }

  async function save(): Promise<boolean> {
    if (!window.nerd) return false
    if (erd.filePath) {
      await window.nerd.saveToPath(erd.filePath, erd.toJson())
      erd.dirty = false
      return true
    }
    return saveAs()
  }

  async function exportDdl(sql: string, dialect = erd.document.dialect): Promise<void> {
    if (!window.nerd) return
    await window.nerd.exportDdl(sql, `${fileStem(erd.document.name)}.${dialect}.sql`)
  }

  return { createNew, open, save, saveAs, exportDdl, confirmDiscard }
}
