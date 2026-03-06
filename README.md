# Multichain Faucet

Distributes test tokens across EVM chains via the Rhinestone SDK.

## Setup

```bash
npm install
cp .env.example .env  # fill in required values
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OWNER_PRIVATE_KEY` | yes | | Faucet wallet private key |
| `ORCHESTRATOR_API_KEY` | yes | | Rhinestone SDK API key |
| `DRIP_LIMIT_USD` | no | `50` | Max dollar value per drip |
| `INITIAL_ADMIN_KEY` | no | | Seed an admin API key on startup |
| `DB_PATH` | no | `faucet.db` | SQLite database path |
| `PORT` | no | `3000` | Server port |

## Running

```bash
npm run dev   # development (watch mode)
npm start     # production
```

## Authentication

All endpoints require an `x-api-key` header. Admin endpoints require a key with `admin` role.

## API

### `GET /api/health`

Returns `{ "ok": true }`.

### `POST /api/drip`

Send tokens to a recipient.

```json
// Request
{
  "chainId": 8453,
  "token": "USDC",        // symbol or contract address
  "amount": "1000000",    // raw amount as string (with decimals)
  "recipient": "0x..."
}

// Response
{
  "status": "COMPLETED",
  "txHash": "0x..."
}
```

Rejects if dollar value exceeds `DRIP_LIMIT_USD`.

### `POST /api/admin/keys`

Create an API key.

```json
// Request
{ "name": "my-key", "role": "member" }

// Response
{ "id": "...", "key": "faucet_...", "name": "my-key", "role": "member", "createdAt": "...", "active": true }
```

### `GET /api/admin/keys`

List all active API keys (keys are redacted).

### `DELETE /api/admin/keys/:id`

Revoke an API key.

### `GET /api/admin/audit`

Query params: `name` (filter by key name), `limit` (default 50).

Returns audit log entries with chain, token, amount, dollar value, recipient, tx hash, and timestamp.

### `GET /api/admin/wallet`

Returns the faucet wallet address.
