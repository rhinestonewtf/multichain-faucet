import type { Address } from 'viem'

export type Amount = string | number

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
  amount: Amount
  dollarValue: number
  recipient: Address
  status: string
  txHash: string
  timestamp: string
}

export interface DripRequest {
  chainId: number
  token: string
  amount: Amount
  recipient: string
}

export interface DripResponse {
  status: string
  txHash: string
}
