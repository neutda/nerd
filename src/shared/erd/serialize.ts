import type { ErdDocument, Table } from '../erd/model'
import { createEmptyDocument } from '../erd/document'

export function parseErdDocument(raw: string): ErdDocument {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('유효한 JSON 파일이 아닙니다.')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('ERD 문서 형식이 올바르지 않습니다.')
  }

  const doc = data as Partial<ErdDocument>
  if (doc.version !== 1 || !Array.isArray(doc.tables) || !Array.isArray(doc.relations)) {
    throw new Error('지원하지 않는 ERD 문서 버전입니다.')
  }

  const fallback = createEmptyDocument()
  return {
    version: 1,
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : fallback.name,
    dialect: doc.dialect === 'mariadb' || doc.dialect === 'oracle' || doc.dialect === 'postgresql'
      ? doc.dialect
      : fallback.dialect,
    tables: doc.tables as Table[],
    relations: doc.relations as ErdDocument['relations']
  }
}

export function serializeErdDocument(document: ErdDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

export function cloneDocument(document: ErdDocument): ErdDocument {
  return parseErdDocument(JSON.stringify(document))
}
