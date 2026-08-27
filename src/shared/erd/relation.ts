import type { Cardinality, Relation } from './model'

export type RelationKind = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'

export const RELATION_KINDS: RelationKind[] = [
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many'
]

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  'one-to-one': '1 : 1',
  'one-to-many': '1 : N',
  'many-to-one': 'N : 1',
  'many-to-many': 'N : N'
}

export function relationKind(relation: Pick<Relation, 'fromCardinality' | 'toCardinality'>): RelationKind {
  if (relation.fromCardinality === '1' && relation.toCardinality === '1') return 'one-to-one'
  if (relation.fromCardinality === '1' && relation.toCardinality === 'N') return 'one-to-many'
  if (relation.fromCardinality === 'N' && relation.toCardinality === '1') return 'many-to-one'
  return 'many-to-many'
}

export function kindToCardinality(kind: RelationKind): {
  fromCardinality: Cardinality
  toCardinality: Cardinality
} {
  switch (kind) {
    case 'one-to-one':
      return { fromCardinality: '1', toCardinality: '1' }
    case 'one-to-many':
      return { fromCardinality: '1', toCardinality: 'N' }
    case 'many-to-one':
      return { fromCardinality: 'N', toCardinality: '1' }
    case 'many-to-many':
      return { fromCardinality: 'N', toCardinality: 'N' }
  }
}

export function defaultRelationKind(sourceIsKey: boolean, targetIsKey: boolean): RelationKind {
  if (sourceIsKey && targetIsKey) return 'one-to-one'
  if (sourceIsKey && !targetIsKey) return 'one-to-many'
  return 'many-to-one'
}

export function fkSide(kind: RelationKind): 'from' | 'to' | null {
  if (kind === 'many-to-one') return 'from'
  if (kind === 'one-to-many') return 'to'
  if (kind === 'one-to-one') return 'from'
  return null
}

export function fkEndpoints(relation: Relation): Array<{ tableId: string; columnId: string }> {
  const side = fkSide(relationKind(relation))
  if (side === 'to') return [{ tableId: relation.toTableId, columnId: relation.toColumnId }]
  if (side === 'from') return [{ tableId: relation.fromTableId, columnId: relation.fromColumnId }]
  return []
}
