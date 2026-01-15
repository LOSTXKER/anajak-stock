/**
 * Serialize Prisma objects to plain objects for Client Components
 * Converts Decimal to number, BigInt to number
 */
export function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) => {
    // Handle Prisma Decimal - multiple detection methods for different versions
    if (value !== null && typeof value === 'object') {
      // Method 1: Check for toNumber method (older Prisma)
      if ('toNumber' in value && typeof value.toNumber === 'function') {
        return value.toNumber()
      }
      // Method 2: Check constructor name (Prisma Decimal)
      if (value.constructor?.name === 'Decimal' || value.constructor?.name === 'e') {
        return Number(value)
      }
      // Method 3: Check for 'd', 'e', 's' properties (Prisma Decimal internals)
      if ('d' in value && 'e' in value && 's' in value) {
        return Number(value)
      }
    }
    // Handle BigInt
    if (typeof value === 'bigint') {
      return Number(value)
    }
    return value
  }))
}

/**
 * Serialize an array of Prisma objects
 */
export function serializeMany<T>(arr: T[]): T[] {
  return arr.map((item) => serialize(item))
}
