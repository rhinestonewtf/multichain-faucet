import {
  RhinestoneSDK,
  getTokenAddress,
  getTokenDecimals,
  type TokenSymbol,
} from "@rhinestone/sdk";
import {
  type Address,
  type Chain,
  type Hex,
  encodeFunctionData,
  erc20Abi,
  isAddress,
  zeroAddress,
} from "viem";
import * as viemChains from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../env.js";

interface FillResult {
  fill: { hash: Hex | undefined; chainId: number };
  claims: { hash: Hex | undefined; chainId: number }[];
}

// Cached SDK + account (survives across requests within a single process)
let cachedAccount: Awaited<ReturnType<RhinestoneSDK["createAccount"]>> | null =
  null;

async function getAccount() {
  if (cachedAccount) return cachedAccount;

  const owner = privateKeyToAccount(env.OWNER_PRIVATE_KEY);
  const rhinestone = new RhinestoneSDK({
    apiKey: env.ORCHESTRATOR_API_KEY,
  });

  cachedAccount = await rhinestone.createAccount({
    owners: { type: "ecdsa" as const, accounts: [owner] },
  });

  return cachedAccount;
}

function getChainById(chainId: number): Chain {
  const chain = Object.values(viemChains).find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain;
}

/**
 * Resolve token to an address for call construction.
 * If already an address, returns as-is. If a symbol, resolves via SDK.
 */
function resolveToAddress(token: string, chainId: number): Address {
  if (isAddress(token)) return token;
  return getTokenAddress(token as TokenSymbol, chainId);
}

export async function getWalletAddress(): Promise<Address> {
  const account = await getAccount();
  return account.getAddress();
}

export interface DripParams {
  chainId: number;
  token: string;
  amount: number;
  recipient: Address;
}

export interface DripResult {
  status: string;
  dollarValue: number;
  txHash: string;
}

export class DripLimitExceededError extends Error {
  constructor(
    public requested: number,
    public limit: number,
  ) {
    super(`Dollar value $${requested.toFixed(2)} exceeds limit of $${limit}`);
  }
}

export async function executeDrip(params: DripParams): Promise<DripResult> {
  const account = await getAccount();
  const chain = getChainById(params.chainId);
  const tokenAmount = BigInt(params.amount);

  // Resolve address for call construction only
  const tokenAddress = resolveToAddress(params.token, chain.id);
  const isNative = tokenAddress === zeroAddress;

  // Build calls (native token transfer or ERC20 transfer)
  const calls = [
    {
      to: isNative ? params.recipient : tokenAddress,
      value: isNative ? tokenAmount : 0n,
      data: isNative
        ? ("0x" as Hex)
        : encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [params.recipient, tokenAmount],
          }),
    },
  ];

  // Token requests — pass token directly, SDK handles symbol or address
  const tokenRequests = [
    { address: params.token as Address | TokenSymbol, amount: tokenAmount },
  ];

  // 1. Prepare transaction (gets route + pricing)
  const prepared = await account.prepareTransaction({
    targetChain: chain,
    calls,
    tokenRequests,
  });

  // 2. Dollar limit check
  const tokenPrices = prepared.intentRoute.intentOp.signedMetadata
    .tokenPrices as Record<string, number>;
  const price = tokenPrices[params.token];
  if (!price) {
    throw new Error(
      `No price available for token "${params.token}". Cannot enforce dollar limit.`,
    );
  }

  const decimals = getDecimalsForPrice(params.token, chain.id);
  const dollarValue = (Number(tokenAmount) / 10 ** decimals) * price;
  if (dollarValue > env.DRIP_LIMIT_USD) {
    throw new DripLimitExceededError(dollarValue, env.DRIP_LIMIT_USD);
  }

  // 3. Sign
  const signed = await account.signTransaction(prepared);

  // 4. Submit
  const transactionResult = await account.submitTransaction(signed);

  // 5. Wait for execution
  const execution = (await account.waitForExecution(
    transactionResult,
    false, // we want the fill tx hash
  )) as FillResult;

  console.log("Execution result:", JSON.stringify(execution, null, 2));

  return {
    status: "COMPLETED",
    dollarValue,
    txHash: execution.fill.hash ?? "",
  };
}

/**
 * Get decimals for dollar value calculation.
 * For known token symbols, uses SDK. For raw addresses, defaults to 18.
 */
function getDecimalsForPrice(token: string, chainId: number): number {
  if (isAddress(token)) return 18;
  try {
    return getTokenDecimals(token as TokenSymbol, chainId);
  } catch {
    return 18;
  }
}
