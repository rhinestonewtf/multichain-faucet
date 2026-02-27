import type { Hex } from 'viem'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  get OWNER_PRIVATE_KEY() {
    return requireEnv('OWNER_PRIVATE_KEY') as Hex
  },
  get ORCHESTRATOR_API_KEY() {
    return requireEnv('ORCHESTRATOR_API_KEY')
  },
  get DRIP_LIMIT_USD() {
    return parseFloat(process.env.DRIP_LIMIT_USD || '50')
  },
}
