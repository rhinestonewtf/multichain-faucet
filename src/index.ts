import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import drip from './routes/drip.js'
import admin from './routes/admin.js'
import { seedInitialAdminKey } from './lib/db.js'
import { getWalletAddress, getSupportedChains } from './services/rhinestone.js'
import { apiKeyAuth, type AuthEnv } from './middleware/auth.js'

// Seed initial admin key if configured
seedInitialAdminKey()

const app = new Hono().basePath('/api')

app.use('*', logger())
app.use('*', cors())

app.route('/drip', drip)
app.route('/admin', admin)

app.get('/health', (c) => c.json({ ok: true }))

app.get('/wallet', async (c) => {
  const address = await getWalletAddress()
  return c.json({ address })
})

app.get('/chains', apiKeyAuth, async (c) => {
  const chains = await getSupportedChains()
  return c.json(chains)
})

const port = parseInt(process.env.PORT || '3000')

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Faucet API running on http://localhost:${info.port}`)
})
