import type { ErdDocument } from '../../src/shared/erd/model'
import { cloneDocument } from '../../src/shared/erd/serialize'

export function applySnapshot(_document: ErdDocument | null, next: ErdDocument): ErdDocument {
  return cloneDocument(next)
}
