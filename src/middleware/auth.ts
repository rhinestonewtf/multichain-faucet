import { createMiddleware } from 'hono/factory'
import { lookupApiKey } from '../lib/db.js'
import type { Role } from '../lib/types.js'

export type AuthEnv = { Variables: AuthVariables }

type AuthVariables = {
  apiKeyId: string
  apiKeyName: string
  apiKeyRole: Role
}

export const apiKeyAuth = createMiddleware<{
  Variables: AuthVariables
}>(async (c, next) => {
  const key = c.req.header('x-api-key')
  if (!key) {
    return c.json({ error: 'Missing x-api-key header' }, 401)
  }

  const record = lookupApiKey(key)
  if (!record) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  c.set('apiKeyId', record.id)
  c.set('apiKeyName', record.name)
  c.set('apiKeyRole', record.role)
  await next()
})

export const requireAdmin = createMiddleware<{
  Variables: AuthVariables
}>(async (c, next) => {
  if (c.get('apiKeyRole') !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
})
