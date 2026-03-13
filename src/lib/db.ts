import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import type { ApiKeyRecord, AuditEntry, Role } from './types.js'

const DB_PATH = process.env.DB_PATH || 'faucet.db'
const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key) WHERE active = 1;

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    amount REAL NOT NULL,
    dollar_value REAL NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_name ON audit_log(name);
  CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
`)

// Migration: add reason column to existing databases
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN reason TEXT NOT NULL DEFAULT ''`)
} catch {
  // Column already exists
}

// --- Initial Admin Key ---

export function seedInitialAdminKey(): void {
  const initialKey = process.env.INITIAL_ADMIN_KEY
  if (!initialKey) return

  const existing = lookupApiKey(initialKey)
  if (existing) return

  const record: ApiKeyRecord = {
    id: 'initial-admin',
    key: initialKey,
    name: 'admin',
    role: 'admin',
    createdAt: new Date().toISOString(),
    active: true,
  }

  db.prepare(
    'INSERT OR IGNORE INTO api_keys (id, key, name, role, created_at, active) VALUES (?, ?, ?, ?, ?, 1)',
  ).run(record.id, record.key, record.name, record.role, record.createdAt)

  console.log('Initial admin API key seeded')
}

// --- API Keys ---

export function createApiKey(name: string, role: Role): ApiKeyRecord {
  const id = nanoid()
  const key = `faucet_${nanoid(32)}`
  const createdAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO api_keys (id, key, name, role, created_at, active) VALUES (?, ?, ?, ?, ?, 1)',
  ).run(id, key, name, role, createdAt)

  return { id, key, name, role, createdAt, active: true }
}

export function lookupApiKey(
  key: string,
): { id: string; name: string; role: Role; createdAt: string } | null {
  const row = db
    .prepare(
      'SELECT id, name, role, created_at as createdAt FROM api_keys WHERE key = ? AND active = 1',
    )
    .get(key) as { id: string; name: string; role: Role; createdAt: string } | undefined

  return row ?? null
}

export function revokeApiKey(id: string): boolean {
  const result = db
    .prepare('UPDATE api_keys SET active = 0 WHERE id = ? AND active = 1')
    .run(id)
  return result.changes > 0
}

export function listApiKeys(): ApiKeyRecord[] {
  return db
    .prepare(
      'SELECT id, key, name, role, created_at as createdAt, active FROM api_keys WHERE active = 1 ORDER BY created_at DESC',
    )
    .all() as ApiKeyRecord[]
}

// --- Audit Log ---

export function addAuditEntry(entry: AuditEntry): void {
  db.prepare(
    `INSERT INTO audit_log (id, name, api_key_id, chain_id, token, amount, dollar_value, recipient, status, tx_hash, reason, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.name,
    entry.apiKeyId,
    entry.chainId,
    entry.token,
    entry.amount,
    entry.dollarValue,
    entry.recipient,
    entry.status,
    entry.txHash,
    entry.reason,
    entry.timestamp,
  )
}

export function getAuditLog(filters?: {
  name?: string
  limit?: number
}): AuditEntry[] {
  const limit = filters?.limit ?? 50

  if (filters?.name) {
    return db
      .prepare(
        `SELECT id, name, api_key_id as apiKeyId, chain_id as chainId, token, amount,
                dollar_value as dollarValue, recipient, status, tx_hash as txHash, reason, timestamp
         FROM audit_log WHERE name = ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(filters.name, limit) as AuditEntry[]
  }

  return db
    .prepare(
      `SELECT id, name, api_key_id as apiKeyId, chain_id as chainId, token, amount,
              dollar_value as dollarValue, recipient, status, tx_hash as txHash, reason, timestamp
       FROM audit_log ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(limit) as AuditEntry[]
}
