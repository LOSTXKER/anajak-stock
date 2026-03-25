/**
 * Supabase Region Migration - IMPORT Script
 *
 * Imports ALL data into a NEW Supabase project:
 * - Runs Prisma migrations to create schema
 * - Imports all public schema tables (correct FK order)
 * - Imports auth users with preserved password hashes
 * - Creates storage bucket and uploads files
 * - Updates attachment URLs to point to new project
 *
 * Prerequisites:
 *   1. Create a new Supabase project in the desired region
 *   2. Create .env.migration with the new project credentials
 *   3. Run the export script first: npx tsx scripts/migrate-export.ts
 *
 * Usage: npx tsx scripts/migrate-import.ts
 */

import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import 'dotenv/config'

// ------- Configuration -------

const EXPORT_DIR = path.join(process.cwd(), 'migration-data')
const DB_DIR = path.join(EXPORT_DIR, 'db')
const STORAGE_DIR = path.join(EXPORT_DIR, 'storage', 'files')

const migrationEnvPath = path.join(process.cwd(), '.env.migration')
const migrationEnv = parseDotenv(migrationEnvPath)

const NEW_DATABASE_URL = migrationEnv.NEW_DATABASE_URL!
const NEW_SUPABASE_URL = migrationEnv.NEW_SUPABASE_URL!
const NEW_SERVICE_ROLE_KEY = migrationEnv.NEW_SERVICE_ROLE_KEY!
const NEW_ANON_KEY = migrationEnv.NEW_ANON_KEY ?? ''

const OLD_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Import in FK-dependency order
const IMPORT_ORDER = [
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

// ------- Helpers -------

function parseDotenv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf-8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// ------- Step 1: Apply Schema via SQL -------

async function applySchema(pool: pg.Pool) {
  console.log('\n=== Step 1: Applying Schema (SQL DDL) ===\n')
  const schemaPath = path.join(EXPORT_DIR, 'full-schema.sql')

  if (!fs.existsSync(schemaPath)) {
    console.log('  Generating schema SQL from Prisma...')
    try {
      execSync(
        `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o "${schemaPath}"`,
        { stdio: 'pipe' }
      )
    } catch {
      console.error('  [FAIL] Could not generate schema SQL')
      process.exit(1)
    }
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8')
  // Remove comment-only lines that start with "Loaded Prisma config" (Prisma CLI output noise)
  const cleanSql = schemaSql
    .split('\n')
    .filter((line) => !line.startsWith('Loaded Prisma config'))
    .join('\n')

  // Split into individual statements and execute each, skipping "already exists" errors
  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  let applied = 0
  let skipped = 0
  for (const stmt of statements) {
    try {
      await pool.query(stmt)
      applied++
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        skipped++
      } else {
        console.error(`  [FAIL] ${err.message}\n    Statement: ${stmt.slice(0, 100)}...`)
        process.exit(1)
      }
    }
  }
  console.log(`  [OK] Schema applied (${applied} new, ${skipped} already existed)`)
}

// ------- Step 2: Import Public Schema Data -------

async function getJsonColumns(pool: pg.Pool, table: string): Promise<Set<string>> {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
       AND (data_type = 'json' OR data_type = 'jsonb')`,
    [table]
  )
  return new Set(rows.map((r: any) => r.column_name))
}

function coerceValue(val: any, isJsonCol: boolean): any {
  if (val === null || val === undefined) return val
  if (typeof val !== 'object' || val instanceof Date || Buffer.isBuffer(val)) return val
  // Only stringify for json/jsonb columns; keep native arrays for text[], etc.
  if (isJsonCol) return JSON.stringify(val)
  return val
}

async function importPublicData(pool: pg.Pool) {
  console.log('\n=== Step 2: Importing Public Schema Data ===\n')

  // Disable FK checks and triggers for bulk insert
  await pool.query('SET session_replication_role = replica')

  for (const table of IMPORT_ORDER) {
    const filePath = path.join(DB_DIR, `${table}.json`)
    if (!fs.existsSync(filePath)) {
      console.log(`  [SKIP] ${table}: no export file`)
      continue
    }

    const rows: Record<string, any>[] = readJson(filePath)
    if (rows.length === 0) {
      console.log(`  [SKIP] ${table}: 0 rows`)
      continue
    }

    // Clear existing data
    await pool.query(`TRUNCATE TABLE "${table}" CASCADE`)

    const jsonCols = await getJsonColumns(pool, table)
    const columns = Object.keys(rows[0])
    const colList = columns.map((c) => `"${c}"`).join(', ')

    // Insert in batches
    const BATCH_SIZE = 50
    let inserted = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const values: any[] = []
      const rowPlaceholders: string[] = []

      for (let r = 0; r < batch.length; r++) {
        const row = batch[r]
        const placeholders = columns.map((col, c) => {
          values.push(coerceValue(row[col], jsonCols.has(col)))
          return `$${r * columns.length + c + 1}`
        })
        rowPlaceholders.push(`(${placeholders.join(', ')})`)
      }

      await pool.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${rowPlaceholders.join(', ')}`,
        values
      )
      inserted += batch.length
    }

    console.log(`  [OK] ${table}: ${inserted} rows`)
  }

  await pool.query('SET session_replication_role = DEFAULT')
  console.log('\n  FK constraints re-enabled')
}

// ------- Step 3: Import Auth Users -------

async function getInsertableColumns(pool: pg.Pool, schema: string, table: string): Promise<Set<string>> {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
       AND is_generated = 'NEVER'
       AND generation_expression IS NULL`,
    [schema, table]
  )
  return new Set(rows.map((r: any) => r.column_name))
}

function prepareAuthRow(row: Record<string, any>, insertable: Set<string>) {
  const cols = Object.keys(row).filter((c) => insertable.has(c))
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const values = cols.map((c) => {
    let val = row[c]
    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      val = JSON.stringify(val)
    }
    return val
  })
  return { colList, placeholders, values }
}

async function importAuthUsers(pool: pg.Pool) {
  console.log('\n=== Step 3: Importing Auth Users ===\n')

  const usersFile = path.join(DB_DIR, 'auth_users.json')
  const identitiesFile = path.join(DB_DIR, 'auth_identities.json')

  if (!fs.existsSync(usersFile)) {
    console.log('  [SKIP] No auth_users.json found')
    return
  }

  const users: Record<string, any>[] = readJson(usersFile)
  if (users.length === 0) {
    console.log('  [SKIP] No auth users to import')
    return
  }

  // Delete default users that might exist in the new project
  await pool.query('DELETE FROM auth.identities')
  await pool.query('DELETE FROM auth.users')

  // Get the set of columns we can actually insert into (excluding generated columns)
  const insertableUserCols = await getInsertableColumns(pool, 'auth', 'users')
  const insertableIdentityCols = await getInsertableColumns(pool, 'auth', 'identities')

  for (const user of users) {
    const { colList, placeholders, values } = prepareAuthRow(user, insertableUserCols)
    try {
      await pool.query(`INSERT INTO auth.users (${colList}) VALUES (${placeholders})`, values)
    } catch (err: any) {
      console.warn(`  [WARN] Could not import user ${user.email}: ${err.message}`)
    }
  }
  console.log(`  [OK] auth.users: ${users.length} rows`)

  // Import identities
  if (fs.existsSync(identitiesFile)) {
    const identities: Record<string, any>[] = readJson(identitiesFile)
    for (const identity of identities) {
      const { colList, placeholders, values } = prepareAuthRow(identity, insertableIdentityCols)
      try {
        await pool.query(`INSERT INTO auth.identities (${colList}) VALUES (${placeholders})`, values)
      } catch (err: any) {
        console.warn(`  [WARN] Could not import identity ${identity.id}: ${err.message}`)
      }
    }
    console.log(`  [OK] auth.identities: ${identities.length} rows`)
  }
}

// ------- Step 4: Upload Storage Files -------

async function importStorage() {
  console.log('\n=== Step 4: Importing Storage Files ===\n')

  const fileListPath = path.join(EXPORT_DIR, 'storage', 'file-list.json')
  if (!fs.existsSync(fileListPath)) {
    console.log('  [SKIP] No storage file list found')
    return
  }

  const fileList: string[] = readJson(fileListPath)
  if (fileList.length === 0) {
    console.log('  [SKIP] No storage files to upload')
    return
  }

  const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY)

  // Ensure bucket exists
  const { error: bucketError } = await supabase.storage.createBucket('attachments', {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
  })
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error('  [FAIL] Could not create bucket:', bucketError.message)
    return
  }
  console.log('  [OK] Bucket "attachments" ready')

  let uploaded = 0
  let failed = 0

  for (const filePath of fileList) {
    const localPath = path.join(STORAGE_DIR, filePath)
    if (!fs.existsSync(localPath)) {
      console.error(`  [FAIL] Local file missing: ${filePath}`)
      failed++
      continue
    }

    const fileBuffer = fs.readFileSync(localPath)
    const { error } = await supabase.storage
      .from('attachments')
      .upload(filePath, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      console.error(`  [FAIL] ${filePath}: ${error.message}`)
      failed++
      continue
    }

    uploaded++
    process.stdout.write(`\r  Uploaded ${uploaded}/${fileList.length} files...`)
  }

  console.log(`\n  [OK] Uploaded: ${uploaded}, Failed: ${failed}`)
}

// ------- Step 5: Update Attachment URLs -------

async function updateAttachmentUrls(pool: pg.Pool) {
  console.log('\n=== Step 5: Updating Attachment URLs ===\n')

  if (!OLD_SUPABASE_URL || !NEW_SUPABASE_URL) {
    console.log('  [SKIP] Cannot update URLs (missing old/new Supabase URL)')
    return
  }

  const { rowCount } = await pool.query(
    `UPDATE "attachments" SET "fileUrl" = REPLACE("fileUrl", $1, $2) WHERE "fileUrl" LIKE $3`,
    [OLD_SUPABASE_URL, NEW_SUPABASE_URL, `${OLD_SUPABASE_URL}%`]
  )
  console.log(`  [OK] Updated ${rowCount ?? 0} attachment URLs`)

  // Also update imageUrl in products and product_variants
  const { rowCount: prodCount } = await pool.query(
    `UPDATE "products" SET "imageUrl" = REPLACE("imageUrl", $1, $2) WHERE "imageUrl" LIKE $3`,
    [OLD_SUPABASE_URL, NEW_SUPABASE_URL, `${OLD_SUPABASE_URL}%`]
  )
  console.log(`  [OK] Updated ${prodCount ?? 0} product image URLs`)

  const { rowCount: variantCount } = await pool.query(
    `UPDATE "product_variants" SET "imageUrl" = REPLACE("imageUrl", $1, $2) WHERE "imageUrl" LIKE $3`,
    [OLD_SUPABASE_URL, NEW_SUPABASE_URL, `${OLD_SUPABASE_URL}%`]
  )
  console.log(`  [OK] Updated ${variantCount ?? 0} variant image URLs`)
}

// ------- Step 6: Verify -------

async function verify(pool: pg.Pool) {
  console.log('\n=== Step 6: Verification ===\n')
  const manifest = readJson(path.join(EXPORT_DIR, 'manifest.json'))
  const dbSummary: Record<string, number> = manifest.database
  let allOk = true

  for (const [table, expectedCount] of Object.entries(dbSummary)) {
    if (expectedCount < 0) continue // skipped during export
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int as count FROM "${table}"`)
      const actualCount = rows[0].count
      const match = actualCount === expectedCount
      if (!match) allOk = false
      console.log(
        `  ${match ? '[OK]' : '[!!]'} ${table}: expected=${expectedCount}, actual=${actualCount}`
      )
    } catch {
      console.log(`  [SKIP] ${table}: could not verify`)
    }
  }

  // Verify auth
  const { rows: authRows } = await pool.query('SELECT COUNT(*)::int as count FROM auth.users')
  const expectedAuth = manifest.auth?.['auth.users'] ?? 0
  const authMatch = authRows[0].count === expectedAuth
  if (!authMatch) allOk = false
  console.log(
    `  ${authMatch ? '[OK]' : '[!!]'} auth.users: expected=${expectedAuth}, actual=${authRows[0].count}`
  )

  return allOk
}

// ------- Main -------

async function main() {
  console.log('='.repeat(60))
  console.log('  Supabase Region Migration - IMPORT')
  console.log('='.repeat(60))

  // Validate config
  if (!NEW_DATABASE_URL || !NEW_SUPABASE_URL || !NEW_SERVICE_ROLE_KEY) {
    console.error('\nMissing .env.migration file. Create it with:\n')
    console.error('  NEW_DATABASE_URL="postgresql://postgres:PASSWORD@db.NEW_PROJECT.supabase.co:5432/postgres"')
    console.error('  NEW_SUPABASE_URL="https://NEW_PROJECT.supabase.co"')
    console.error('  NEW_SERVICE_ROLE_KEY="eyJ..."')
    console.error('  NEW_ANON_KEY="eyJ..."')
    process.exit(1)
  }

  if (!fs.existsSync(path.join(EXPORT_DIR, 'manifest.json'))) {
    console.error('\nNo export data found. Run export first:')
    console.error('  npx tsx scripts/migrate-export.ts')
    process.exit(1)
  }

  console.log(`  Target URL : ${NEW_SUPABASE_URL}`)
  console.log(`  Old URL    : ${OLD_SUPABASE_URL}`)
  console.log(`  Import Dir : ${EXPORT_DIR}`)

  // Connect to new database
  const pool = new pg.Pool({ connectionString: NEW_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  try {
    await pool.query('SELECT 1')
    console.log('\n  Database connection OK')
  } catch (err) {
    console.error('\nFailed to connect to new database:', err)
    process.exit(1)
  }

  try {
    // Step 1
    await applySchema(pool)

    // Step 2
    await importPublicData(pool)

    // Step 3
    await importAuthUsers(pool)

    // Step 4
    await importStorage()

    // Step 5
    await updateAttachmentUrls(pool)

    // Step 6
    const allOk = await verify(pool)

    console.log('\n' + '='.repeat(60))
    console.log(allOk ? '  IMPORT COMPLETE - ALL VERIFIED' : '  IMPORT COMPLETE - SOME MISMATCHES (review above)')
    console.log('='.repeat(60))
    console.log('\n  Next steps:')
    console.log('  1. Update .env with the new project credentials:')
    console.log(`     DATABASE_URL="${NEW_DATABASE_URL}"`)
    console.log(`     NEXT_PUBLIC_SUPABASE_URL="${NEW_SUPABASE_URL}"`)
    console.log(`     NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEW_ANON_KEY}"`)
    console.log(`     SUPABASE_SERVICE_ROLE_KEY="${NEW_SERVICE_ROLE_KEY}"`)
    console.log('  2. Update deployment environment variables (Vercel, etc.)')
    console.log('  3. Test the application thoroughly')
    console.log('  4. Delete the old Supabase project when ready')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('\nImport failed:', err)
  process.exit(1)
})
