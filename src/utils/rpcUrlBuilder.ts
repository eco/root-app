import { type Chain } from "viem";

export const apiKeys = {
  alchemy: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
};

const customRpcUrls: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${apiKeys.alchemy}`,
  10: `https://opt-mainnet.g.alchemy.com/v2/${apiKeys.alchemy}`,
  137: `https://polygon-mainnet.g.alchemy.com/v2/${apiKeys.alchemy}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${apiKeys.alchemy}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${apiKeys.alchemy}`,
};

/**
 * Builds an RPC URL for a given chain using the appropriate API key
 *
 * @param chain - The chain configuration object
 * @returns The RPC URL with the API key, or undefined if no matching provider is found
 */
export function buildRpcUrl(chain?: Chain): string | undefined {
  if (!chain) return undefined;

  // If we have an Alchemy API key and the chain supports Alchemy, use it
  if (customRpcUrls[chain.id]) {
    return customRpcUrls[chain.id];
  }

  // If no matches, return undefined to allow fallback to default providers
  return undefined;
}
