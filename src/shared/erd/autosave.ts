import type { ErdDocument } from './model'
import { parseErdDocument } from './serialize'

export const AUTOSAVE_KIND = 'nerd-autosave'
export const AUTOSAVE_KIND_WORKSPACE = 'nerd-autosave-workspace'

export interface AutosaveEnvelope {
  kind: typeof AUTOSAVE_KIND
  filePath: string | null
  dirty: boolean
  savedAt: string
  document: ErdDocument
}

export interface AutosaveTab {
  id: string
  filePath: string | null
  dirty: boolean
  document: ErdDocument
}

export interface AutosaveWorkspace {
  kind: typeof AUTOSAVE_KIND_WORKSPACE
  savedAt: string
  activeTabId: string
  tabs: AutosaveTab[]
}

export function serializeAutosave(input: {
  activeTabId: string
  tabs: AutosaveTab[]
}): string {
  const envelope: AutosaveWorkspace = {
    kind: AUTOSAVE_KIND_WORKSPACE,
    savedAt: new Date().toISOString(),
    activeTabId: input.activeTabId,
    tabs: input.tabs
  }
  return `${JSON.stringify(envelope)}\n`
}

function asTab(item: Partial<AutosaveTab>, fallbackId: string): AutosaveTab | null {
  if (!item.document) return null
  try {
    return {
      id: typeof item.id === 'string' && item.id ? item.id : fallbackId,
      filePath: typeof item.filePath === 'string' ? item.filePath : null,
      dirty: Boolean(item.dirty),
      document: parseErdDocument(JSON.stringify(item.document))
    }
  } catch {
    return null
  }
}

export function parseAutosave(raw: string): AutosaveWorkspace | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const envelope = data as {
    kind?: string
    savedAt?: string
    filePath?: string | null
    dirty?: boolean
    document?: ErdDocument
    activeTabId?: string
    tabs?: Partial<AutosaveTab>[]
  }
  const savedAt = typeof envelope.savedAt === 'string' ? envelope.savedAt : new Date().toISOString()

  if (envelope.kind === AUTOSAVE_KIND_WORKSPACE && Array.isArray(envelope.tabs)) {
    const tabs = envelope.tabs
      .map((tab, index) => asTab(tab, `tab-${index}`))
      .filter((tab): tab is AutosaveTab => Boolean(tab))
    if (tabs.length === 0) return null
    const activeTabId =
      typeof envelope.activeTabId === 'string' && tabs.some((tab) => tab.id === envelope.activeTabId)
        ? envelope.activeTabId
        : tabs[0].id
    return { kind: AUTOSAVE_KIND_WORKSPACE, savedAt, activeTabId, tabs }
  }

  if (envelope.kind === AUTOSAVE_KIND && envelope.document) {
    const tab = asTab(
      {
        id: 'tab-1',
        filePath: typeof envelope.filePath === 'string' ? envelope.filePath : null,
        dirty: Boolean(envelope.dirty),
        document: envelope.document
      },
      'tab-1'
    )
    if (!tab) return null
    return { kind: AUTOSAVE_KIND_WORKSPACE, savedAt, activeTabId: tab.id, tabs: [tab] }
  }

  return null
}
