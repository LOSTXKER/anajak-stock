/**
 * PEAK Account Integration
 * @see https://developers.peakaccount.com/reference/peak-open-api
 */

export interface PEAKConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  accessToken?: string
}

export interface PEAKContact {
  code: string
  name: string
  type: 'SUPPLIER' | 'CUSTOMER'
  taxId?: string
  email?: string
  phone?: string
  address?: string
}

export interface PEAKProduct {
  code: string
  name: string
  type: 'PRODUCT' | 'SERVICE'
  unitName: string
  price?: number
  cost?: number
  description?: string
}

export interface PEAKPurchaseOrder {
  docNo?: string
  contactCode: string
  issueDate: string
  dueDate?: string
  lines: {
    productCode: string
    qty: number
    unitPrice: number
    description?: string
  }[]
  note?: string
  vatType?: 'INCLUDED' | 'EXCLUDED' | 'NO_VAT'
}

export interface PEAKExpense {
  docNo?: string
  contactCode: string
  issueDate: string
  paymentDate?: string
  lines: {
    productCode: string
    qty: number
    unitPrice: number
    description?: string
  }[]
  note?: string
  vatType?: 'INCLUDED' | 'EXCLUDED' | 'NO_VAT'
}

export interface PEAKResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export class PEAKClient {
  private config: PEAKConfig

  constructor(config: PEAKConfig) {
    this.config = config
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<PEAKResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (this.config.accessToken) {
        headers['Authorization'] = `Bearer ${this.config.accessToken}`
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error_code || 'UNKNOWN',
            message: data.message || 'Unknown error',
          },
        }
      }

      return { success: true, data }
    } catch (error) {
      console.error('PEAK API Error:', error)
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      }
    }
  }

  // ============================================
  // Authentication
  // ============================================

  async getClientToken(): Promise<PEAKResponse<{ accessToken: string; expiresIn: number }>> {
    return this.request('POST', '/v1/client-token', {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
    })
  }

  setAccessToken(token: string) {
    this.config.accessToken = token
  }

  // ============================================
  // Contacts (Suppliers)
  // ============================================

  async createContact(contact: PEAKContact): Promise<PEAKResponse<{ id: string }>> {
    return this.request('POST', '/v1/contacts', {
      code: contact.code,
      name: contact.name,
      type: contact.type === 'SUPPLIER' ? 2 : 1, // 1 = Customer, 2 = Supplier
      taxId: contact.taxId,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
    })
  }

  async getContact(code: string): Promise<PEAKResponse<PEAKContact>> {
    return this.request('GET', `/v1/contacts/${code}`)
  }

  async getContactList(params?: {
    type?: 'SUPPLIER' | 'CUSTOMER'
    page?: number
    limit?: number
  }): Promise<PEAKResponse<{ items: PEAKContact[]; total: number }>> {
    const queryParams = new URLSearchParams()
    if (params?.type) queryParams.set('type', params.type === 'SUPPLIER' ? '2' : '1')
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.limit) queryParams.set('limit', params.limit.toString())

    return this.request('GET', `/v1/contacts?${queryParams.toString()}`)
  }

  // ============================================
  // Products
  // ============================================

  async createProduct(product: PEAKProduct): Promise<PEAKResponse<{ id: string }>> {
    return this.request('POST', '/v1/products', {
      code: product.code,
      name: product.name,
      type: product.type === 'PRODUCT' ? 1 : 2, // 1 = Product, 2 = Service
      unitName: product.unitName,
      price: product.price,
      cost: product.cost,
      description: product.description,
    })
  }

  async getProduct(code: string): Promise<PEAKResponse<PEAKProduct>> {
    return this.request('GET', `/v1/products/${code}`)
  }

  async adjustProductStock(
    code: string,
    qty: number,
    note?: string
  ): Promise<PEAKResponse<void>> {
    return this.request('POST', `/v1/products/${code}/adjust`, {
      qty,
      note,
    })
  }

  // ============================================
  // Purchase Orders
  // ============================================

  async createPurchaseOrder(po: PEAKPurchaseOrder): Promise<PEAKResponse<{ id: string; docNo: string }>> {
    return this.request('POST', '/v1/purchase-orders', {
      documentNo: po.docNo,
      contactCode: po.contactCode,
      issueDate: po.issueDate,
      dueDate: po.dueDate,
      items: po.lines.map((line) => ({
        productCode: line.productCode,
        quantity: line.qty,
        unitPrice: line.unitPrice,
        description: line.description,
      })),
      remark: po.note,
      vatType: po.vatType === 'INCLUDED' ? 1 : po.vatType === 'EXCLUDED' ? 2 : 3,
    })
  }

  async getPurchaseOrder(id: string): Promise<PEAKResponse<PEAKPurchaseOrder>> {
    return this.request('GET', `/v1/purchase-orders/${id}`)
  }

  async approvePurchaseOrder(id: string): Promise<PEAKResponse<void>> {
    return this.request('POST', `/v1/purchase-orders/${id}/approve`)
  }

  async voidPurchaseOrder(id: string, reason?: string): Promise<PEAKResponse<void>> {
    return this.request('POST', `/v1/purchase-orders/${id}/void`, { reason })
  }

  // ============================================
  // Expenses (Record Purchase/GRN)
  // ============================================

  async createExpense(expense: PEAKExpense): Promise<PEAKResponse<{ id: string; docNo: string }>> {
    return this.request('POST', '/v1/expenses', {
      documentNo: expense.docNo,
      contactCode: expense.contactCode,
      issueDate: expense.issueDate,
      paymentDate: expense.paymentDate,
      items: expense.lines.map((line) => ({
        productCode: line.productCode,
        quantity: line.qty,
        unitPrice: line.unitPrice,
        description: line.description,
      })),
      remark: expense.note,
      vatType: expense.vatType === 'INCLUDED' ? 1 : expense.vatType === 'EXCLUDED' ? 2 : 3,
    })
  }

  async createExpenseFromPurchaseOrder(
    poId: string,
    data?: { paymentDate?: string; note?: string }
  ): Promise<PEAKResponse<{ id: string; docNo: string }>> {
    return this.request('POST', `/v1/expenses/from-purchase-order`, {
      purchaseOrderId: poId,
      ...data,
    })
  }

  async getExpense(id: string): Promise<PEAKResponse<PEAKExpense>> {
    return this.request('GET', `/v1/expenses/${id}`)
  }

  async voidExpense(id: string, reason?: string): Promise<PEAKResponse<void>> {
    return this.request('POST', `/v1/expenses/${id}/void`, { reason })
  }
}

// ============================================
// Helper Functions
// ============================================

export function mapVatTypeToPEAK(vatType: string): 'INCLUDED' | 'EXCLUDED' | 'NO_VAT' {
  switch (vatType) {
    case 'INCLUDED':
      return 'INCLUDED'
    case 'EXCLUDED':
      return 'EXCLUDED'
    default:
      return 'NO_VAT'
  }
}

export function formatDateForPEAK(date: Date): string {
  return date.toISOString().split('T')[0]
}
