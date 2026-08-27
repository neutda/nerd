import type { ErdDocument } from '../../src/shared/erd/model'

/** TODO: OT/CRDT 연산 적용. 지금은 스냅샷 교체만 허용할 예정. */
export function applyRemoteOp(_document: ErdDocument, _op: unknown): ErdDocument {
  throw new Error('applyRemoteOp is not implemented')
}
