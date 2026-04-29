import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless =
  !!process.env.VERCEL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  !!process.env.LAMBDA_TASK_ROOT

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Heads-up if production is still pointing at a direct (non-pooled)
  // Supabase URL. On serverless, this is the #1 cause of
  // "Max client connections reached".
  if (
    isServerless &&
    /db\.[a-z0-9-]+\.supabase\.(co|net)/i.test(connectionString) &&
    !/pooler\.supabase\.com/i.test(connectionString)
  ) {
    console.warn(
      '[prisma] DATABASE_URL points at a direct Supabase connection. ' +
      'Use the Transaction Pooler (port 6543, host pooler.supabase.com) ' +
      'on Vercel/serverless to avoid exhausting Postgres connections.'
    )
  }

  // Pool sizing: keep it tiny in serverless because every concurrent
  // function instance gets its own pool. Many instances * even a small
  // pool can quickly exhaust Postgres `max_connections` (Supabase
  // tier defaults are ~60). Use a real pool only for long-running
  // processes (local dev, traditional Node servers).
  const pool = new Pool({
    connectionString,
    max: isServerless ? 1 : 10,
    min: 0,
    // Release connections back to the pgbouncer-style pooler quickly so
    // a warm Vercel instance doesn't hold an idle Postgres connection
    // between bursts of traffic.
    idleTimeoutMillis: isServerless ? 1_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    allowExitOnIdle: true,
    // Disable TCP keepalive on serverless so a frozen Vercel instance
    // doesn't keep a half-open connection alive on the pgbouncer side
    // (Supabase free tier max_client_conn = 200).
    keepAlive: !isServerless,
  })

  // Store pool reference for cleanup if needed
  globalForPrisma.pool = pool

  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Cache PrismaClient on globalThis in every environment, including
// production. Vercel keeps Node globals alive across warm invocations,
// so reusing the client/pool prevents new connections from being
// opened on every request (root cause of "Max client connections
// reached").
globalForPrisma.prisma = prisma

// Export pool for direct access if needed (e.g., for cleanup)
export const pool = globalForPrisma.pool
