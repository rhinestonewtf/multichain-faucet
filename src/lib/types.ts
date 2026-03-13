import type { Address } from 'viem'

export type Role = 'member' | 'admin'

export interface ApiKeyRecord {
  id: string
  key: string
  name: string
  role: Role
  createdAt: string
  active: boolean
}

export interface AuditEntry {
  id: string
  name: string
  apiKeyId: string
  chainId: number
  token: string
  amount: string
  dollarValue: number
  recipient: Address
  status: string
  txHash: string
  reason: string
  timestamp: string
}

export interface DripRequest {
  chainId: number
  token: string
  amount: string
  recipient: string
  reason: string
}

export interface DripResponse {
  status: string
  txHash: string
}
