import { Hono } from 'hono'
import { apiKeyAuth, requireAdmin, type AuthEnv } from '../middleware/auth.js'
import {
  createApiKey,
  revokeApiKey,
  listApiKeys,
  getAuditLog,
} from '../lib/db.js'
import { getWalletAddress, getBalance } from '../services/rhinestone.js'
import type { Role } from '../lib/types.js'

const admin = new Hono<AuthEnv>()

admin.use('*', apiKeyAuth)

// --- Endpoints available to any authenticated user ---

// Balance (multichain portfolio)
admin.get('/balance', async (c) => {
  const onTestnets = c.req.query('testnets') !== 'false'
  const address = await getWalletAddress()
  const portfolio = await getBalance(onTestnets)

  return c.json({
    address,
    tokens: portfolio.map((t) => ({
      symbol: t.symbol,
      decimals: t.decimals,
      balance: t.balances.unlocked.toString(),
      chains: t.chains.map((chain) => ({
        chainId: chain.chain,
        tokenAddress: chain.address,
        balance: chain.unlocked.toString(),
      })),
    })),
  })
})

// Wallet address
admin.get('/wallet', async (c) => {
  const address = await getWalletAddress()
  return c.json({ address })
})

// --- Admin-only endpoints ---

// Create API key
admin.post('/keys', requireAdmin, async (c) => {
  const { name, role } = await c.req.json<{ name: string; role?: Role }>()
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'name is required' }, 400)
  }
  const keyRole = role === 'admin' ? 'admin' : 'member'
  const record = createApiKey(name.trim(), keyRole)
  return c.json(record, 201)
})

// List API keys (redact full key values)
admin.get('/keys', requireAdmin, async (c) => {
  const keys = listApiKeys()
  return c.json(
    keys.map((k) => ({ ...k, key: k.key.substring(0, 12) + '...' })),
  )
})

// Revoke API key
admin.delete('/keys/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  const success = revokeApiKey(id)
  if (!success) return c.json({ error: 'Key not found' }, 404)
  return c.json({ success: true })
})

// Audit log
admin.get('/audit', requireAdmin, async (c) => {
  const name = c.req.query('name')
  const limitStr = c.req.query('limit')
  const limit = limitStr ? parseInt(limitStr) : 50
  const entries = getAuditLog({ name: name || undefined, limit })
  return c.json(entries)
})

export default admin
