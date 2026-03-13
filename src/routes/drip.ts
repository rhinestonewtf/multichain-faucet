import { Hono } from 'hono'
import { isAddress, type Address } from 'viem'
import { nanoid } from 'nanoid'
import { apiKeyAuth, type AuthEnv } from '../middleware/auth.js'
import {
  executeDrip,
  DripLimitExceededError,
} from '../services/rhinestone.js'
import { addAuditEntry } from '../lib/db.js'
import type { DripRequest, AuditEntry } from '../lib/types.js'

const drip = new Hono<AuthEnv>()

drip.use('*', apiKeyAuth)

drip.post('/', async (c) => {
  const body = await c.req.json<DripRequest>()

  // Validate chain ID
  if (!body.chainId || typeof body.chainId !== 'number') {
    return c.json({ error: 'chainId is required (number)' }, 400)
  }

  // Validate token (symbol or address)
  if (!body.token || typeof body.token !== 'string') {
    return c.json(
      { error: 'token is required (symbol like "USDC" or address)' },
      400,
    )
  }

  // Validate amount (string, already formatted with decimals)
  if (!body.amount || typeof body.amount !== 'string') {
    return c.json(
      { error: 'amount is required (string with decimals, e.g. "1000000" for 1 USDC)' },
      400,
    )
  }
  try {
    if (BigInt(body.amount) <= 0n) {
      return c.json({ error: 'amount must be greater than 0' }, 400)
    }
  } catch {
    return c.json({ error: 'amount must be a valid integer' }, 400)
  }

  // Validate recipient
  if (!body.recipient || !isAddress(body.recipient)) {
    return c.json({ error: 'Invalid recipient address' }, 400)
  }

  // Validate reason
  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return c.json({ error: 'reason is required (string describing why this drip is needed)' }, 400)
  }
  if (body.reason.length > 280) {
    return c.json({ error: 'reason must be 280 characters or fewer' }, 400)
  }

  try {
    const result = await executeDrip({
      chainId: body.chainId,
      token: body.token,
      amount: body.amount,
      recipient: body.recipient as Address,
    })

    // Write audit log
    const auditEntry: AuditEntry = {
      id: nanoid(),
      name: c.get('apiKeyName'),
      apiKeyId: c.get('apiKeyId'),
      chainId: body.chainId,
      token: body.token,
      amount: body.amount,
      dollarValue: result.dollarValue,
      recipient: body.recipient as Address,
      status: result.status,
      txHash: result.txHash,
      reason: body.reason.trim(),
      timestamp: new Date().toISOString(),
    }
    addAuditEntry(auditEntry)

    return c.json({
      status: result.status,
      txHash: result.txHash,
    })
  } catch (err) {
    if (err instanceof DripLimitExceededError) {
      return c.json({ error: err.message }, 400)
    }

    console.error('Drip failed:', err)

    // Pass through orchestrator error details (traceId, errorType)
    if (err instanceof Error && 'traceId' in err) {
      const orchErr = err as Error & { traceId?: string; errorType?: string; statusCode?: number }
      return c.json({
        error: orchErr.message,
        errorType: orchErr.errorType,
        traceId: orchErr.traceId,
      }, orchErr.statusCode && orchErr.statusCode >= 400 && orchErr.statusCode < 600
        ? orchErr.statusCode as any
        : 500)
    }

    return c.json({ error: 'Failed to process drip request' }, 500)
  }
})

export default drip
