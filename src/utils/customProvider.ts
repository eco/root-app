import { type Chain } from "viem";
import { buildRpcUrl } from "./rpcUrlBuilder";

/**
 * Creates a custom provider for wagmi that uses the unified RPC URL builder
 * Note: This provider is no longer used with RainbowKit v2 / Wagmi v2
 */
export function customProvider() {
  return function (chain: Chain) {
    // Build the appropriate RPC URL for this chain
    const url = buildRpcUrl(chain);

    // If no URL could be built, return null to skip this provider
    if (!url) return null;

    return {
      chain,
      rpcUrls: { http: [url] },
    };
  };
}
