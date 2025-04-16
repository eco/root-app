import { Chain } from "wagmi";
import { buildRpcUrl, type ApiKeys } from "./rpcUrlBuilder";

interface CustomProviderConfig {
  apiKeys?: ApiKeys;
}

/**
 * Creates a custom provider for wagmi that uses the unified RPC URL builder
 */
export function customProvider(config?: CustomProviderConfig) {
  return function (chain: Chain) {
    // Build the appropriate RPC URL for this chain
    const url = buildRpcUrl(chain, config?.apiKeys);

    // If no URL could be built, return null to skip this provider
    if (!url) return null;

    return {
      chain,
      rpcUrls: { http: [url] },
    };
  };
}
