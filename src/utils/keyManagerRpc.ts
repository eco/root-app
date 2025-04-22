import { http, HttpTransport, HttpTransportConfig } from "viem";
import { buildRpcUrl } from "./rpcUrlBuilder";

/**
 * Creates a transport that manages API keys for different RPC providers.
 * If the chain has an RPC URL for a supported provider, it appends the API key to the URL.
 *
 * @param config - Transport configuration
 * @returns A transport function that can be used with createClient
 */
export function keyManagerRpc(config?: HttpTransportConfig): HttpTransport {
  return (params) => {
    const { chain } = params;

    // Get the appropriate RPC URL for this chain using our unified URL builder
    const rpcUrl = buildRpcUrl(chain);

    // Create a new transport with the modified URL
    return http(rpcUrl, config)(params);
  };
}
