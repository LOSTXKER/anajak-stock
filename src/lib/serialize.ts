/**
 * Serialize Prisma objects to plain objects for Client Components
 * Converts Decimal to number, BigInt to number
 */
export function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) => {
    // Handle Decimal (Prisma Decimal is an object with toNumber method)
    if (value !== null && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber()
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
