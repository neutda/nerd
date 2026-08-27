import type { ErdDocument } from './model'
import { parseErdDocument } from './serialize'

export const AUTOSAVE_KIND = 'nerd-autosave'

export interface AutosaveEnvelope {
  kind: typeof AUTOSAVE_KIND
  filePath: string | null
  dirty: boolean
  savedAt: string
  document: ErdDocument
}

export function serializeAutosave(input: {
  filePath: string | null
  dirty: boolean
  document: ErdDocument
}): string {
  const envelope: AutosaveEnvelope = {
    kind: AUTOSAVE_KIND,
    filePath: input.filePath,
    dirty: input.dirty,
    savedAt: new Date().toISOString(),
    document: input.document
  }
  return `${JSON.stringify(envelope)}\n`
}

export function parseAutosave(raw: string): AutosaveEnvelope | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const envelope = data as Partial<AutosaveEnvelope>
  if (envelope.kind !== AUTOSAVE_KIND || !envelope.document) return null
  try {
    return {
      kind: AUTOSAVE_KIND,
      filePath: typeof envelope.filePath === 'string' ? envelope.filePath : null,
      dirty: Boolean(envelope.dirty),
      savedAt: typeof envelope.savedAt === 'string' ? envelope.savedAt : new Date().toISOString(),
      document: parseErdDocument(JSON.stringify(envelope.document))
    }
  } catch {
    return null
  }
}
