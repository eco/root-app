# Utility Functions

## keyManagerRpc Transport

The `keyManagerRpc` transport is a custom Viem transport that extends the HTTP transport to handle API keys for different RPC providers automatically.

### Features

- Automatically appends API keys to RPC URLs for supported providers
- Currently supports Alchemy API keys
- Falls back to standard HTTP transport for non-supported providers
- Seamlessly integrates with Viem and Wagmi

### Usage

```typescript
import { createPublicClient } from "viem";
import { mainnet } from "wagmi/chains";
import { keyManagerRpc } from "@/utils/keyManagerRpc";

// Define your API keys
const apiKeys = {
  alchemy: "YOUR_ALCHEMY_API_KEY", // In production, use environment variables
};

// Create a client with the keyManagerRpc transport
const client = createPublicClient({
  chain: mainnet,
  transport: keyManagerRpc(apiKeys),
});

// Use the client as normal
const balance = await client.getBalance({
  address: "0x...",
});
```

### Integration with Wagmi

```typescript
import { configureChains } from "wagmi";
import { mainnet, polygon } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";
import { keyManagerRpc } from "@/utils/keyManagerRpc";

const apiKeys = {
  alchemy: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
};

const { chains, publicClient } = configureChains(
  [mainnet, polygon],
  [
    {
      provider: (chain) => ({
        chain,
        transport: keyManagerRpc(apiKeys),
      }),
    },
    publicProvider(), // Fallback provider
  ],
);
```

### How It Works

1. The transport accepts an object of API keys for different providers
2. When a request is made, it checks if the chain's RPC URLs include any supported providers
3. If a supported provider is found and an API key is provided, it appends the API key to the URL
4. The transport then passes the modified URL to the standard HTTP transport

### Supported Providers

Currently, the transport supports:

- Alchemy

Additional providers can be added by extending the `ApiKeys` type and updating the URL detection logic.
