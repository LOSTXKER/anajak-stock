import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, ERP_RATE_LIMIT } from '@/lib/rate-limit'

export interface ApiKeyValidationResult {
  valid: boolean
  integrationId?: string
  rateLimited?: boolean
}

/**
 * Validates the API key from the X-API-Key header against active ERP integrations.
 * Also enforces rate limiting per API key.
 * Returns the integration ID if valid.
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyValidationResult> {
  const apiKey = request.headers.get('X-API-Key')

  if (!apiKey) {
    return { valid: false }
  }

  // Rate limit by API key before doing DB lookup
  const rateLimitResult = rateLimit(`erp:${apiKey}`, ERP_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return { valid: true, rateLimited: true }
  }

  try {
    const integration = await prisma.eRPIntegration.findFirst({
      where: {
        apiKey,
        active: true,
        provider: 'custom_erp',
      },
    })

    if (!integration) {
      return { valid: false }
    }

    return { valid: true, integrationId: integration.id }
  } catch (error) {
    console.error('API key validation error:', error)
    return { valid: false }
  }
}

/**
 * Returns a 401 response if the API key is invalid.
 * Use as a guard at the top of API route handlers.
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'Invalid or missing API key' },
    { status: 401 }
  )
}

/**
 * Returns a 429 response when rate limit is exceeded.
 */
export function rateLimitedResponse() {
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    { status: 429 }
  )
}

/**
 * Returns a standardized error response.
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  )
}
