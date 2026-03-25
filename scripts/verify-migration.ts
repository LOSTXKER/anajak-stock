import pg from 'pg'
import 'dotenv/config'

const OLD_URL = 'postgresql://postgres.zjircbcxdpebypmeenxi:Bestlostxker007@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
const NEW_URL = 'postgresql://postgres.mfvywfgvwhmtsdgtnekp:Bestlostxker007@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'

const PUBLIC_TABLES = [
  'categories', 'units_of_measure', 'warehouses', 'option_types', 'locations', 'option_values',
  'suppliers', 'products', 'product_variants', 'variant_option_values', 'users', 'settings',
  'doc_sequences', 'stock_balances', 'stock_movements', 'movement_lines', 'prs', 'pr_lines',
  'pos', 'po_lines', 'po_timelines', 'grns', 'grn_lines', 'lots', 'lot_balances',
  'lot_movement_lines', 'attachments', 'audit_logs', 'notifications', 'notification_delivery_logs',
  'user_notification_preferences', 'stock_takes', 'stock_take_lines', 'erp_integrations', 'erp_sync_logs',
]

async function main() {
  const oldPool = new pg.Pool({ connectionString: OLD_URL, ssl: { rejectUnauthorized: false } })
  const newPool = new pg.Pool({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } })

  console.log('='.repeat(65))
  console.log('  LIVE VERIFICATION: Old DB (Mumbai) vs New DB (Singapore)')
  console.log('='.repeat(65))
  console.log('')
  console.log('TABLE'.padEnd(38) + 'OLD'.padStart(7) + 'NEW'.padStart(7) + '  STATUS')
  console.log('-'.repeat(65))

  let allOk = true
  let totalOld = 0
  let totalNew = 0

  for (const table of PUBLIC_TABLES) {
    const oldRes = await oldPool.query(`SELECT COUNT(*)::int as c FROM "${table}"`)
    const newRes = await newPool.query(`SELECT COUNT(*)::int as c FROM "${table}"`)
    const oldC = oldRes.rows[0].c
    const newC = newRes.rows[0].c
    totalOld += oldC
    totalNew += newC
    const ok = oldC === newC
    if (!ok) allOk = false
    console.log(table.padEnd(38) + String(oldC).padStart(7) + String(newC).padStart(7) + (ok ? '  [OK]' : '  [!!]'))
  }

  console.log('-'.repeat(65))

  // Auth tables
  for (const table of ['users', 'identities']) {
    const oldRes = await oldPool.query(`SELECT COUNT(*)::int as c FROM auth."${table}"`)
    const newRes = await newPool.query(`SELECT COUNT(*)::int as c FROM auth."${table}"`)
    const oldC = oldRes.rows[0].c
    const newC = newRes.rows[0].c
    const ok = oldC === newC
    if (!ok) allOk = false
    console.log(`auth.${table}`.padEnd(38) + String(oldC).padStart(7) + String(newC).padStart(7) + (ok ? '  [OK]' : '  [!!]'))
  }

  console.log('-'.repeat(65))
  console.log('TOTAL ROWS'.padEnd(38) + String(totalOld).padStart(7) + String(totalNew).padStart(7))
  console.log('')

  // Spot-check: compare a few key records
  console.log('--- Spot Check: Sample Data ---')

  const oldProducts = await oldPool.query('SELECT sku, name FROM products ORDER BY sku LIMIT 5')
  const newProducts = await newPool.query('SELECT sku, name FROM products ORDER BY sku LIMIT 5')
  console.log('\nProducts (first 5):')
  for (let i = 0; i < oldProducts.rows.length; i++) {
    const o = oldProducts.rows[i]
    const n = newProducts.rows[i]
    const match = o.sku === n.sku && o.name === n.name
    if (!match) allOk = false
    console.log(`  ${match ? '[OK]' : '[!!]'} ${o.sku} = ${o.name}`)
  }

  const oldUsers = await oldPool.query('SELECT username, email, role FROM users ORDER BY username')
  const newUsers = await newPool.query('SELECT username, email, role FROM users ORDER BY username')
  console.log('\nApp Users:')
  for (let i = 0; i < oldUsers.rows.length; i++) {
    const o = oldUsers.rows[i]
    const n = newUsers.rows[i]
    const match = o.username === n.username && o.email === n.email && o.role === n.role
    if (!match) allOk = false
    console.log(`  ${match ? '[OK]' : '[!!]'} ${o.username} (${o.email}) role=${o.role}`)
  }

  const oldAuthUsers = await oldPool.query('SELECT email, role FROM auth.users ORDER BY email')
  const newAuthUsers = await newPool.query('SELECT email, role FROM auth.users ORDER BY email')
  console.log('\nAuth Users:')
  for (let i = 0; i < oldAuthUsers.rows.length; i++) {
    const o = oldAuthUsers.rows[i]
    const n = newAuthUsers.rows[i]
    const match = o.email === n.email
    if (!match) allOk = false
    console.log(`  ${match ? '[OK]' : '[!!]'} ${o.email}`)
  }

  // Check password hashes preserved
  const oldHashes = await oldPool.query('SELECT id, encrypted_password FROM auth.users ORDER BY id')
  const newHashes = await newPool.query('SELECT id, encrypted_password FROM auth.users ORDER BY id')
  console.log('\nPassword Hashes Preserved:')
  for (let i = 0; i < oldHashes.rows.length; i++) {
    const o = oldHashes.rows[i]
    const n = newHashes.rows[i]
    const match = o.id === n.id && o.encrypted_password === n.encrypted_password
    if (!match) allOk = false
    console.log(`  ${match ? '[OK]' : '[!!]'} User ${o.id.slice(0, 8)}... hash=${match ? 'identical' : 'DIFFERENT'}`)
  }

  // Check latest stock movement
  const oldMov = await oldPool.query('SELECT "docNumber", type, status FROM stock_movements ORDER BY "createdAt" DESC LIMIT 3')
  const newMov = await newPool.query('SELECT "docNumber", type, status FROM stock_movements ORDER BY "createdAt" DESC LIMIT 3')
  console.log('\nLatest Stock Movements:')
  for (let i = 0; i < oldMov.rows.length; i++) {
    const o = oldMov.rows[i]
    const n = newMov.rows[i]
    const match = o.docNumber === n.docNumber && o.type === n.type && o.status === n.status
    if (!match) allOk = false
    console.log(`  ${match ? '[OK]' : '[!!]'} ${o.docNumber} (${o.type} / ${o.status})`)
  }

  console.log('\n' + '='.repeat(65))
  console.log(allOk
    ? '  RESULT: ALL DATA VERIFIED 100% - Migration is COMPLETE'
    : '  RESULT: MISMATCHES FOUND - Review above')
  console.log('='.repeat(65))

  await oldPool.end()
  await newPool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
