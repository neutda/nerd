import type { Column, Dialect, LogicalType } from './model'

export const LOGICAL_TYPES: LogicalType[] = [
  'uuid',
  'int',
  'bigint',
  'decimal',
  'varchar',
  'text',
  'boolean',
  'date',
  'datetime',
  'timestamp',
  'json',
  'blob'
]

export const LOGICAL_TYPE_LABELS: Record<LogicalType, string> = {
  uuid: 'UUID',
  int: 'INT',
  bigint: 'BIGINT',
  decimal: 'DECIMAL',
  varchar: 'VARCHAR',
  text: 'TEXT',
  boolean: 'BOOLEAN',
  date: 'DATE',
  datetime: 'DATETIME',
  timestamp: 'TIMESTAMP',
  json: 'JSON',
  blob: 'BLOB'
}

export const DIALECT_LABELS: Record<Dialect, string> = {
  mariadb: 'MariaDB',
  oracle: 'Oracle',
  postgresql: 'PostgreSQL'
}

export const DEFAULT_VARCHAR_LENGTH = 255
export const DEFAULT_DECIMAL_PRECISION = 18
export const DEFAULT_DECIMAL_SCALE = 2

export function usesLength(type: LogicalType): boolean {
  return type === 'varchar'
}

export function usesPrecision(type: LogicalType): boolean {
  return type === 'decimal'
}

export function nativeType(column: Column, dialect: Dialect): string {
  const length = column.length ?? DEFAULT_VARCHAR_LENGTH
  const precision = column.precision ?? DEFAULT_DECIMAL_PRECISION
  const scale = column.scale ?? DEFAULT_DECIMAL_SCALE

  switch (column.logicalType) {
    case 'uuid':
      if (dialect === 'postgresql') return 'UUID'
      if (dialect === 'mariadb') return 'CHAR(36)'
      return 'VARCHAR2(36)'
    case 'int':
      return dialect === 'oracle' ? 'NUMBER(10)' : 'INT'
    case 'bigint':
      return dialect === 'oracle' ? 'NUMBER(19)' : 'BIGINT'
    case 'decimal':
      return dialect === 'oracle'
        ? `NUMBER(${precision},${scale})`
        : `DECIMAL(${precision},${scale})`
    case 'varchar':
      return dialect === 'oracle' ? `VARCHAR2(${length})` : `VARCHAR(${length})`
    case 'text':
      if (dialect === 'oracle') return 'CLOB'
      return 'TEXT'
    case 'boolean':
      if (dialect === 'postgresql') return 'BOOLEAN'
      if (dialect === 'mariadb') return 'TINYINT(1)'
      return 'NUMBER(1)'
    case 'date':
      return 'DATE'
    case 'datetime':
      if (dialect === 'mariadb') return 'DATETIME'
      return 'TIMESTAMP'
    case 'timestamp':
      return 'TIMESTAMP'
    case 'json':
      if (dialect === 'postgresql') return 'JSONB'
      if (dialect === 'mariadb') return 'JSON'
      return 'CLOB'
    case 'blob':
      if (dialect === 'postgresql') return 'BYTEA'
      if (dialect === 'mariadb') return 'LONGBLOB'
      return 'BLOB'
    default:
      return 'VARCHAR(255)'
  }
}

export function typePreview(column: Column, dialect: Dialect): string {
  return nativeType(column, dialect)
}
