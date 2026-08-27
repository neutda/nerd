import type { LogicalType } from '../erd/model'

export function logicalTypeFromNative(nativeType: string, columnType = ''): {
  logicalType: LogicalType
  length?: number
  precision?: number
  scale?: number
} {
  const type = nativeType.toLowerCase().replace(/\s+/g, ' ').trim()
  const full = `${type} ${columnType.toLowerCase()}`
  const lengthMatch = full.match(/\((\d+)\)/)
  const decimalMatch = full.match(/\((\d+)\s*,\s*(\d+)\)/)
  const length = lengthMatch ? Number(lengthMatch[1]) : undefined
  const precision = decimalMatch ? Number(decimalMatch[1]) : undefined
  const scale = decimalMatch ? Number(decimalMatch[2]) : undefined

  if (type.includes('uuid') || type === 'uniqueidentifier') {
    return { logicalType: 'uuid' }
  }
  if (type.includes('json')) {
    return { logicalType: 'json' }
  }
  if (
    type.includes('blob') ||
    type.includes('bytea') ||
    type.includes('binary') ||
    type.includes('raw') ||
    type.includes('image')
  ) {
    return { logicalType: 'blob' }
  }
  if (type.includes('clob') || type.includes('text') || type === 'long' || type.includes('xml')) {
    return { logicalType: 'text' }
  }
  if (type === 'tinyint' && (columnType.includes('(1)') || full.includes('tinyint(1)'))) {
    return { logicalType: 'boolean' }
  }
  if (type === 'boolean' || type === 'bool' || type === 'bit') {
    return { logicalType: 'boolean' }
  }
  if (type === 'date') {
    return { logicalType: 'date' }
  }
  if (type.includes('datetime')) {
    return { logicalType: 'datetime' }
  }
  if (type.includes('timestamp')) {
    return { logicalType: 'timestamp' }
  }
  if (type.includes('decimal') || type.includes('numeric') || type === 'number') {
    if (type === 'number' && precision && precision <= 10 && (scale ?? 0) === 0) {
      return { logicalType: 'int' }
    }
    if (type === 'number' && precision && precision <= 19 && (scale ?? 0) === 0) {
      return { logicalType: 'bigint' }
    }
    return {
      logicalType: 'decimal',
      precision: precision ?? 18,
      scale: scale ?? 0
    }
  }
  if (
    type.includes('bigint') ||
    type === 'int8' ||
    type === 'integer8' ||
    type.includes('number(19')
  ) {
    return { logicalType: 'bigint' }
  }
  if (
    type === 'int' ||
    type === 'integer' ||
    type === 'int4' ||
    type === 'smallint' ||
    type === 'mediumint' ||
    type === 'tinyint' ||
    type === 'serial' ||
    type === 'smallserial'
  ) {
    return { logicalType: 'int' }
  }
  if (type.includes('char') || type.includes('varchar') || type === 'nvarchar') {
    return { logicalType: 'varchar', length: length && length > 0 ? length : 255 }
  }
  return { logicalType: 'varchar', length: length && length > 0 ? length : 255 }
}
