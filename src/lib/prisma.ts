import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Optimized Pool configuration for better performance
  const pool = new Pool({ 
    connectionString,
    // Pool size settings
    max: 10,                    // Maximum number of connections in the pool
    min: 2,                     // Minimum number of connections to keep open
    // Timeouts
    idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000, // Fail if can't connect within 5 seconds
    // Statement timeout for long-running queries (30 seconds)
    statement_timeout: 30000,
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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Export pool for direct access if needed (e.g., for cleanup)
export const pool = globalForPrisma.pool
