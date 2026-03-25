/**
 * Supabase Region Migration - EXPORT Script
 *
 * Exports ALL data from the current Supabase project:
 * - Public schema tables (via direct PostgreSQL connection)
 * - Auth users + identities (auth schema)
 * - Storage files (attachments bucket)
 *
 * Usage: npx tsx scripts/migrate-export.ts
 * (reads DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env)
 */

import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'

const EXPORT_DIR = path.join(process.cwd(), 'migration-data')
const DB_DIR = path.join(EXPORT_DIR, 'db')
const STORAGE_DIR = path.join(EXPORT_DIR, 'storage', 'files')

const DATABASE_URL = process.env.DATABASE_URL!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const PUBLIC_TABLES = [
  'categories',
  'units_of_measure',
  'warehouses',
  'option_types',
  'locations',
  'option_values',
  'suppliers',
  'products',
  'product_variants',
  'variant_option_values',
  'users',
  'settings',
  'doc_sequences',
  'stock_balances',
  'stock_movements',
  'movement_lines',
  'prs',
  'pr_lines',
  'pos',
  'po_lines',
  'po_timelines',
  'grns',
  'grn_lines',
  'lots',
  'lot_balances',
  'lot_movement_lines',
  'attachments',
  'audit_logs',
  'notifications',
  'notification_delivery_logs',
  'user_notification_preferences',
  'stock_takes',
  'stock_take_lines',
  'erp_integrations',
  'erp_sync_logs',
]

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function exportDatabase(pool: pg.Pool) {
  console.log('\n=== Exporting Database ===\n')
  const summary: Record<string, number> = {}

  for (const table of PUBLIC_TABLES) {
    try {
      const { rows, rowCount } = await pool.query(`SELECT * FROM "${table}"`)
      writeJson(path.join(DB_DIR, `${table}.json`), rows)
      const count = rowCount ?? 0
      summary[table] = count
      console.log(`  [OK] ${table}: ${count} rows`)
    } catch (err: any) {
      if (err.code === '42P01') {
        console.log(`  [SKIP] ${table}: table does not exist`)
        summary[table] = -1
      } else {
        throw err
      }
    }
  }

  return summary
}

async function exportAuth(pool: pg.Pool) {
  console.log('\n=== Exporting Auth ===\n')
  const summary: Record<string, number> = {}

  const authTables = ['users', 'identities']
  for (const table of authTables) {
    const { rows, rowCount } = await pool.query(`SELECT * FROM auth."${table}"`)
    writeJson(path.join(DB_DIR, `auth_${table}.json`), rows)
    const count = rowCount ?? 0
    summary[`auth.${table}`] = count
    console.log(`  [OK] auth.${table}: ${count} rows`)
  }

  return summary
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listAllStorageFiles(
  supabase: ReturnType<typeof createClient<any>>,
  bucket: string,
  prefix: string = ''
): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error) {
    console.error(`  Error listing ${prefix || '/'}:`, error.message)
    return paths
  }
  if (!data || data.length === 0) return paths

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id) {
      paths.push(fullPath)
    } else {
      const subPaths = await listAllStorageFiles(supabase, bucket, fullPath)
      paths.push(...subPaths)
    }
  }

  return paths
}

async function exportStorage() {
  console.log('\n=== Exporting Storage ===\n')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const allFiles = await listAllStorageFiles(supabase, 'attachments')
  console.log(`  Found ${allFiles.length} files in 'attachments' bucket`)

  writeJson(path.join(EXPORT_DIR, 'storage', 'file-list.json'), allFiles)

  let downloaded = 0
  let failed = 0

  for (const filePath of allFiles) {
    const localDir = path.join(STORAGE_DIR, path.dirname(filePath))
    fs.mkdirSync(localDir, { recursive: true })

    const { data, error } = await supabase.storage
      .from('attachments')
      .download(filePath)

    if (error || !data) {
      console.error(`  [FAIL] ${filePath}: ${error?.message}`)
      failed++
      continue
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    fs.writeFileSync(path.join(STORAGE_DIR, filePath), buffer)
    downloaded++
    process.stdout.write(`\r  Downloaded ${downloaded}/${allFiles.length} files...`)
  }

  console.log(`\n  [OK] Downloaded: ${downloaded}, Failed: ${failed}`)
  return { total: allFiles.length, downloaded, failed }
}

async function main() {
  console.log('='.repeat(60))
  console.log('  Supabase Region Migration - EXPORT')
  console.log('='.repeat(60))
  console.log(`  Source URL: ${SUPABASE_URL}`)
  console.log(`  Export Dir: ${EXPORT_DIR}`)

  if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\nMissing environment variables. Ensure .env has:')
    console.error('  DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  fs.mkdirSync(DB_DIR, { recursive: true })
  fs.mkdirSync(STORAGE_DIR, { recursive: true })

  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

  try {
    await pool.query('SELECT 1')
    console.log('\n  Database connection OK')
  } catch (err) {
    console.error('\nFailed to connect to database:', err)
    process.exit(1)
  }

  const dbSummary = await exportDatabase(pool)
  const authSummary = await exportAuth(pool)
  await pool.end()

  const storageSummary = await exportStorage()

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceUrl: SUPABASE_URL,
    database: dbSummary,
    auth: authSummary,
    storage: storageSummary,
  }
  writeJson(path.join(EXPORT_DIR, 'manifest.json'), manifest)

  console.log('\n' + '='.repeat(60))
  console.log('  EXPORT COMPLETE')
  console.log('='.repeat(60))
  console.log(`  Data saved to: ${EXPORT_DIR}`)
  console.log(`  Tables exported: ${Object.keys(dbSummary).length}`)
  console.log(`  Auth users: ${authSummary['auth.users'] ?? 0}`)
  console.log(`  Storage files: ${storageSummary.downloaded}`)
  console.log('\n  Next step: Create new Supabase project, then run:')
  console.log('  npx tsx scripts/migrate-import.ts')
}

main().catch((err) => {
  console.error('\nExport failed:', err)
  process.exit(1)
})
