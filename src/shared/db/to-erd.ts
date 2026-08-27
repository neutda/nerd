import { createId } from '../erd/ids'
import { uniqueName } from '../erd/connect'
import { createColumn } from '../erd/document'
import type { Column, Relation, Table } from '../erd/model'
import { logicalTypeFromNative } from './map-type'
import type { IntrospectedColumn, IntrospectedSchema } from './types'

export function filterSchema(schema: IntrospectedSchema, selectedNames: string[]): IntrospectedSchema {
  const names = new Set(selectedNames.map((name) => name.toLowerCase()))
  const tables = schema.tables.filter((table) => names.has(table.name.toLowerCase()))
  return {
    dialect: schema.dialect,
    tables,
    foreignKeys: schema.foreignKeys.filter(
      (fk) => names.has(fk.fromTable.toLowerCase()) && names.has(fk.toTable.toLowerCase())
    ),
    truncated: schema.truncated
  }
}

function toColumn(item: IntrospectedColumn): Column {
  const mapped = logicalTypeFromNative(item.nativeType)
  const column = createColumn(item.name)
  column.logicalType = mapped.logicalType
  column.length = item.length ?? mapped.length
  column.precision = item.precision ?? mapped.precision
  column.scale = item.scale ?? mapped.scale
  column.nullable = item.nullable && !item.primaryKey
  column.primaryKey = item.primaryKey
  column.unique = item.unique || item.primaryKey
  column.autoIncrement = item.autoIncrement
  column.comment = item.comment
  return column
}

export function schemaToErd(
  schema: IntrospectedSchema,
  existingTableNames: string[] = []
): { tables: Table[]; relations: Relation[] } {
  const used = [...existingTableNames]
  const tables: Table[] = []
  const byOriginal = new Map<string, Table>()

  schema.tables.forEach((table) => {
    const name = uniqueName(table.name, used)
    used.push(name)
    const next: Table = {
      id: createId(),
      name,
      comment: table.comment,
      x: 80,
      y: 80,
      columns: table.columns.length > 0 ? table.columns.map(toColumn) : [createColumn('id')]
    }
    if (next.columns[0] && table.columns.length === 0) {
      next.columns[0].primaryKey = true
      next.columns[0].nullable = false
    }
    tables.push(next)
    byOriginal.set(table.name.toLowerCase(), next)
  })

  const relations: Relation[] = []
  const seen = new Set<string>()
  for (const fk of schema.foreignKeys) {
    const child = byOriginal.get(fk.fromTable.toLowerCase())
    const parent = byOriginal.get(fk.toTable.toLowerCase())
    if (!child || !parent) continue
    const childCol = child.columns.find((column) => column.name.toLowerCase() === fk.fromColumn.toLowerCase())
    const parentCol = parent.columns.find((column) => column.name.toLowerCase() === fk.toColumn.toLowerCase())
    if (!childCol || !parentCol) continue
    const key = `${parent.id}:${parentCol.id}->${child.id}:${childCol.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const oneToOne = childCol.unique || childCol.primaryKey
    relations.push({
      id: createId(),
      name: fk.name,
      fromTableId: parent.id,
      fromColumnId: parentCol.id,
      toTableId: child.id,
      toColumnId: childCol.id,
      fromCardinality: '1',
      toCardinality: oneToOne ? '1' : 'N'
    })
  }

  return { tables, relations }
}
