import { type Chain } from "viem";

export type ApiKeys = {
  alchemy?: string;
  // Future providers can be added here
};

export const defaultApiKeys = {
  alchemy: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
};

/**
 * Builds an RPC URL for a given chain using the appropriate API key
 *
 * @param chain - The chain configuration object
 * @param customApiKeys - API keys for different providers
 * @returns The RPC URL with the API key, or undefined if no matching provider is found
 */
export function buildRpcUrl(chain?: Chain, customApiKeys: ApiKeys = {}): string | undefined {
  if (!chain) return undefined;

  // Merge default and custom API keys
  const apiKeys = { ...defaultApiKeys, ...customApiKeys };

  // If we have an Alchemy API key and the chain supports Alchemy, use it
  if (chain.rpcUrls.alchemy && apiKeys.alchemy) {
    return `${chain.rpcUrls.alchemy.http[0]}/${apiKeys.alchemy}`;
  }

  // If no matches, return undefined to allow fallback to default providers
  return undefined;
}
