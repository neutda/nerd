import type { Column, Table } from './model'
import { defaultRelationKind, fkSide, type RelationKind } from './relation'

export const TABLE_HANDLE_SRC = 'table__src'
export const TABLE_HANDLE_TGT = 'table__tgt'

export function parseColumnHandle(handle: string | null | undefined): string | null {
  if (!handle) return null
  if (handle === TABLE_HANDLE_SRC || handle === TABLE_HANDLE_TGT) return null
  if (handle.endsWith('__src')) return handle.slice(0, -5)
  if (handle.endsWith('__tgt')) return handle.slice(0, -5)
  return handle
}

export function isKeyColumn(column: Column): boolean {
  return column.primaryKey || column.unique
}

export function preferredKey(table: Table): Column | undefined {
  return table.columns.find((column) => column.primaryKey) ?? table.columns.find((column) => column.unique)
}

export function isGenericColumnName(name: string): boolean {
  return name === 'column' || /^column_\d+$/i.test(name)
}

export function uniqueName(base: string, existing: string[]): string {
  const used = new Set(existing.map((name) => name.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  let i = 2
  while (used.has(`${base}_${i}`.toLowerCase())) i += 1
  return `${base}_${i}`
}

export function suggestedFkName(parentTable: Table, parentColumn: Column, existing: string[]): string {
  const base =
    parentColumn.name.toLowerCase() === 'id'
      ? `${parentTable.name}_id`
      : `${parentTable.name}_${parentColumn.name}`
  return uniqueName(base, existing)
}

export function applyFkToColumn(fk: Column, parent: Column): void {
  fk.logicalType = parent.logicalType
  fk.length = parent.length
  fk.precision = parent.precision
  fk.scale = parent.scale
  fk.autoIncrement = false
  if (!fk.primaryKey) {
    fk.unique = false
  }
}

export type ConnectPlan =
  | { type: 'noop' }
  | {
      type: 'relate'
      fromTableId: string
      fromColumnId: string
      toTableId: string
      toColumnId: string
      kind: RelationKind
      applyFkTo: 'from' | 'to' | null
    }
  | {
      type: 'createFkColumn'
      fkTableId: string
      pkTableId: string
      pkColumnId: string
      kind: RelationKind
      fkIsFrom: boolean
    }

export function planConnection(input: {
  sourceTable: Table
  targetTable: Table
  sourceColumn?: Column | null
  targetColumn?: Column | null
}): ConnectPlan {
  const { sourceTable, targetTable, sourceColumn, targetColumn } = input
  if (sourceColumn && targetColumn && sourceColumn.id === targetColumn.id && sourceTable.id === targetTable.id) {
    return { type: 'noop' }
  }

  const sourceKey = !!sourceColumn && isKeyColumn(sourceColumn)
  const targetKey = !!targetColumn && isKeyColumn(targetColumn)
  const sourcePk = preferredKey(sourceTable)
  const targetPk = preferredKey(targetTable)

  if (sourceColumn && targetColumn) {
    const kind = defaultRelationKind(sourceKey, targetKey)
    return {
      type: 'relate',
      fromTableId: sourceTable.id,
      fromColumnId: sourceColumn.id,
      toTableId: targetTable.id,
      toColumnId: targetColumn.id,
      kind,
      applyFkTo: fkSide(kind)
    }
  }

  if (!sourceColumn && targetColumn) {
    if (targetKey) {
      return {
        type: 'createFkColumn',
        fkTableId: sourceTable.id,
        pkTableId: targetTable.id,
        pkColumnId: targetColumn.id,
        kind: 'many-to-one',
        fkIsFrom: true
      }
    }
    if (sourcePk) {
      const kind = defaultRelationKind(true, targetKey)
      return {
        type: 'relate',
        fromTableId: sourceTable.id,
        fromColumnId: sourcePk.id,
        toTableId: targetTable.id,
        toColumnId: targetColumn.id,
        kind,
        applyFkTo: fkSide(kind)
      }
    }
    return { type: 'noop' }
  }

  if (sourceColumn && !targetColumn) {
    if (sourceKey) {
      return {
        type: 'createFkColumn',
        fkTableId: targetTable.id,
        pkTableId: sourceTable.id,
        pkColumnId: sourceColumn.id,
        kind: 'one-to-many',
        fkIsFrom: false
      }
    }
    if (targetPk) {
      return {
        type: 'relate',
        fromTableId: sourceTable.id,
        fromColumnId: sourceColumn.id,
        toTableId: targetTable.id,
        toColumnId: targetPk.id,
        kind: 'many-to-one',
        applyFkTo: 'from'
      }
    }
    return { type: 'noop' }
  }

  if (sourcePk && targetPk) {
    return {
      type: 'createFkColumn',
      fkTableId: targetTable.id,
      pkTableId: sourceTable.id,
      pkColumnId: sourcePk.id,
      kind: 'one-to-many',
      fkIsFrom: false
    }
  }
  if (targetPk) {
    return {
      type: 'createFkColumn',
      fkTableId: sourceTable.id,
      pkTableId: targetTable.id,
      pkColumnId: targetPk.id,
      kind: 'many-to-one',
      fkIsFrom: true
    }
  }
  if (sourcePk) {
    return {
      type: 'createFkColumn',
      fkTableId: targetTable.id,
      pkTableId: sourceTable.id,
      pkColumnId: sourcePk.id,
      kind: 'one-to-many',
      fkIsFrom: false
    }
  }
  return { type: 'noop' }
}
