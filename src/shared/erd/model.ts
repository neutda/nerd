export type Dialect = 'mariadb' | 'oracle' | 'postgresql'

export type LogicalType =
  | 'uuid'
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'varchar'
  | 'text'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'json'
  | 'blob'

export type Cardinality = '1' | 'N'

export interface Column {
  id: string
  name: string
  logicalType: LogicalType
  length?: number
  precision?: number
  scale?: number
  nullable: boolean
  unique: boolean
  primaryKey: boolean
  autoIncrement: boolean
  comment?: string
}

export interface Relation {
  id: string
  name?: string
  fromTableId: string
  fromColumnId: string
  toTableId: string
  toColumnId: string
  fromCardinality: Cardinality
  toCardinality: Cardinality
}

export interface Table {
  id: string
  name: string
  comment?: string
  x: number
  y: number
  columns: Column[]
}

export interface ErdDocument {
  version: 1
  name: string
  dialect: Dialect
  tables: Table[]
  relations: Relation[]
}

export const DOCUMENT_VERSION = 1 as const

export function isDialect(value: unknown): value is Dialect {
  return value === 'mariadb' || value === 'oracle' || value === 'postgresql'
}
