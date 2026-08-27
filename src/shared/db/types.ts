import type { Dialect } from '../erd/model'

export interface DbConnectionConfig {
  dialect: Dialect
  host: string
  port: number
  user: string
  password?: string
  database?: string
  schema?: string
  serviceName?: string
  ssl?: boolean
}

export interface IntrospectedColumn {
  name: string
  nativeType: string
  nullable: boolean
  primaryKey: boolean
  unique: boolean
  autoIncrement: boolean
  comment?: string
  length?: number
  precision?: number
  scale?: number
}

export interface IntrospectedForeignKey {
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface IntrospectedTable {
  name: string
  schema?: string
  comment?: string
  columns: IntrospectedColumn[]
}

export interface IntrospectedSchema {
  dialect: Dialect
  tables: IntrospectedTable[]
  foreignKeys: IntrospectedForeignKey[]
  truncated?: boolean
}

export const MAX_INTROSPECT_TABLES = 500

export type DbResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const DEFAULT_DB_PORTS: Record<Dialect, number> = {
  mariadb: 3306,
  postgresql: 5432,
  oracle: 1521
}
