import { createId } from './ids'
import type { Column, ErdDocument, Table } from './model'

export const UNTITLED_NAME = '제목 없는 문서'

export function createDefaultPkColumn(): Column {
  return {
    id: createId(),
    name: 'id',
    logicalType: 'bigint',
    nullable: false,
    unique: true,
    primaryKey: true,
    autoIncrement: true
  }
}

export function createColumn(name = 'column'): Column {
  return {
    id: createId(),
    name,
    logicalType: 'varchar',
    length: 255,
    nullable: true,
    unique: false,
    primaryKey: false,
    autoIncrement: false
  }
}

export function createTable(name: string, x: number, y: number): Table {
  return {
    id: createId(),
    name,
    x,
    y,
    columns: [createDefaultPkColumn()]
  }
}

export function createEmptyDocument(name = UNTITLED_NAME): ErdDocument {
  return {
    version: 1,
    name,
    dialect: 'postgresql',
    tables: [],
    relations: []
  }
}

export function nextTableName(existing: string[]): string {
  const used = new Set(existing.map((n) => n.toLowerCase()))
  let i = 1
  while (used.has(`table_${i}`)) i += 1
  return `table_${i}`
}

export function nextColumnName(existing: string[]): string {
  const used = new Set(existing.map((n) => n.toLowerCase()))
  let i = 1
  while (used.has(`column_${i}`)) i += 1
  return `column_${i}`
}
