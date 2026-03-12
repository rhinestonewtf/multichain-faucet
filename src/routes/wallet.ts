import { Hono } from 'hono'
import { apiKeyAuth, type AuthEnv } from '../middleware/auth.js'
import { getWalletAddress, getBalance } from '../services/rhinestone.js'

const wallet = new Hono<AuthEnv>()

wallet.use('*', apiKeyAuth)

// Wallet address
wallet.get('/', async (c) => {
  const address = await getWalletAddress()
  return c.json({ address })
})

// Balance (multichain portfolio)
wallet.get('/balance', async (c) => {
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

export default wallet
