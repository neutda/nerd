import type {
  DbConnectionConfig,
  IntrospectedColumn,
  IntrospectedForeignKey,
  IntrospectedSchema,
  IntrospectedTable
} from '../../shared/db/types'

interface OracleConnection {
  execute(sql: string, binds?: object): Promise<{ rows?: unknown }>
  close(): Promise<void>
}

interface OracleDriver {
  OUT_FORMAT_OBJECT: number
  outFormat: number
  getConnection(options: {
    user: string
    password: string
    connectString: string
  }): Promise<OracleConnection>
}

async function loadOracle(): Promise<OracleDriver> {
  try {
    const loaded = (await import('oracledb')) as unknown as OracleDriver & { default?: OracleDriver }
    const oracle = loaded.default ?? loaded
    oracle.outFormat = oracle.OUT_FORMAT_OBJECT
    return oracle
  } catch {
    throw new Error('Oracle 드라이버를 불러오지 못했습니다. oracledb 패키지를 확인하세요.')
  }
}

function connectString(config: DbConnectionConfig): string {
  const service = config.serviceName?.trim() || config.database?.trim()
  if (!service) throw new Error('서비스 이름(Service Name) 또는 SID를 입력하세요.')
  if (service.includes('=') || service.includes('/')) return service
  return `${config.host}:${config.port}/${service}`
}

async function connect(config: DbConnectionConfig): Promise<OracleConnection> {
  const oracledb = await loadOracle()
  return oracledb.getConnection({
    user: config.user,
    password: config.password ?? '',
    connectString: connectString(config)
  })
}

function owner(config: DbConnectionConfig): string {
  return (config.schema?.trim() || config.user).toUpperCase()
}

function asRows(result: { rows?: unknown }): Array<Record<string, unknown>> {
  return Array.isArray(result.rows) ? (result.rows as Array<Record<string, unknown>>) : []
}

export async function testOracle(config: DbConnectionConfig): Promise<void> {
  const conn = await connect(config)
  try {
    await conn.execute('SELECT 1 AS ok FROM dual')
  } finally {
    await conn.close()
  }
}

export async function introspectOracle(config: DbConnectionConfig): Promise<IntrospectedSchema> {
  const conn = await connect(config)
  const schema = owner(config)
  const binds = { owner: schema }
  try {
    const tablesRes = await conn.execute(
      `SELECT table_name AS name, comments AS table_comment
       FROM all_tab_comments
       WHERE owner = :owner AND table_type = 'TABLE'
       ORDER BY table_name`,
      binds
    )
    const columnsRes = await conn.execute(
      `SELECT
          c.table_name AS table_name,
          c.column_name AS name,
          c.data_type AS data_type,
          c.data_length AS data_length,
          c.data_precision AS data_precision,
          c.data_scale AS data_scale,
          c.nullable AS nullable,
          comm.comments AS comment_text
       FROM all_tab_columns c
       LEFT JOIN all_col_comments comm
         ON comm.owner = c.owner AND comm.table_name = c.table_name AND comm.column_name = c.column_name
       WHERE c.owner = :owner
       ORDER BY c.table_name, c.column_id`,
      binds
    )
    const pkRes = await conn.execute(
      `SELECT cols.table_name AS table_name, cols.column_name AS column_name
       FROM all_constraints cons
       JOIN all_cons_columns cols
         ON cons.owner = cols.owner AND cons.constraint_name = cols.constraint_name
       WHERE cons.owner = :owner AND cons.constraint_type = 'P'`,
      binds
    )
    const uniqueRes = await conn.execute(
      `SELECT cols.table_name AS table_name, cols.column_name AS column_name, cons.constraint_name AS constraint_name
       FROM all_constraints cons
       JOIN all_cons_columns cols
         ON cons.owner = cols.owner AND cons.constraint_name = cols.constraint_name
       WHERE cons.owner = :owner AND cons.constraint_type = 'U'`,
      binds
    )
    const fkRes = await conn.execute(
      `SELECT
          cons.constraint_name AS constraint_name,
          cols.table_name AS from_table,
          cols.column_name AS from_column,
          rcols.table_name AS to_table,
          rcols.column_name AS to_column
       FROM all_constraints cons
       JOIN all_cons_columns cols
         ON cons.owner = cols.owner AND cons.constraint_name = cols.constraint_name
       JOIN all_cons_columns rcols
         ON cons.r_owner = rcols.owner AND cons.r_constraint_name = rcols.constraint_name
        AND cols.position = rcols.position
       WHERE cons.owner = :owner AND cons.constraint_type = 'R'`,
      binds
    )

    const identityKeys = new Set<string>()
    try {
      const identityRes = await conn.execute(
        `SELECT table_name, column_name FROM all_tab_identity_cols WHERE owner = :owner`,
        binds
      )
      for (const row of asRows(identityRes)) {
        identityKeys.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`)
      }
    } catch {
      /* Oracle 12c 미만은 identity 컬럼이 없습니다. */
    }

    const pks = new Set(asRows(pkRes).map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`))
    const uniqueCount = new Map<string, number>()
    for (const row of asRows(uniqueRes)) {
      const name = String(row.CONSTRAINT_NAME)
      uniqueCount.set(name, (uniqueCount.get(name) ?? 0) + 1)
    }
    const uniques = new Set(
      asRows(uniqueRes)
        .filter((row) => uniqueCount.get(String(row.CONSTRAINT_NAME)) === 1)
        .map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`)
    )

    const columnsByTable = new Map<string, IntrospectedColumn[]>()
    for (const row of asRows(columnsRes)) {
      const tableName = String(row.TABLE_NAME)
      const name = String(row.NAME)
      const dataType = String(row.DATA_TYPE)
      const key = `${tableName}.${name}`
      const list = columnsByTable.get(tableName) ?? []
      const precision = row.DATA_PRECISION != null ? Number(row.DATA_PRECISION) : undefined
      const scale = row.DATA_SCALE != null ? Number(row.DATA_SCALE) : undefined
      const length = row.DATA_LENGTH != null ? Number(row.DATA_LENGTH) : undefined
      list.push({
        name,
        nativeType:
          dataType === 'NUMBER' && precision != null
            ? `NUMBER(${precision},${scale ?? 0})`
            : dataType === 'VARCHAR2' || dataType === 'CHAR'
              ? `${dataType}(${length ?? 255})`
              : dataType,
        nullable: String(row.NULLABLE) === 'Y',
        primaryKey: pks.has(key),
        unique: uniques.has(key) || pks.has(key),
        autoIncrement: identityKeys.has(key),
        comment: row.COMMENT_TEXT ? String(row.COMMENT_TEXT) : undefined,
        length: dataType.includes('CHAR') ? length : undefined,
        precision,
        scale
      })
      columnsByTable.set(tableName, list)
    }

    const tables: IntrospectedTable[] = asRows(tablesRes).map((row) => ({
      name: String(row.NAME),
      schema,
      comment: row.TABLE_COMMENT ? String(row.TABLE_COMMENT) : undefined,
      columns: columnsByTable.get(String(row.NAME)) ?? []
    }))

    const fkGroups = new Map<string, IntrospectedForeignKey[]>()
    for (const row of asRows(fkRes)) {
      const name = String(row.CONSTRAINT_NAME)
      const list = fkGroups.get(name) ?? []
      list.push({
        name,
        fromTable: String(row.FROM_TABLE),
        fromColumn: String(row.FROM_COLUMN),
        toTable: String(row.TO_TABLE),
        toColumn: String(row.TO_COLUMN)
      })
      fkGroups.set(name, list)
    }
    const foreignKeys = [...fkGroups.values()].filter((group) => group.length === 1).map((group) => group[0])

    return { dialect: 'oracle', tables, foreignKeys }
  } finally {
    await conn.close()
  }
}
