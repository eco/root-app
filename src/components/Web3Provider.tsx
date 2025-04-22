"use client";

import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  darkTheme,
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";

import "@rainbow-me/rainbowkit/styles.css";
import { chains } from "@/config/chains";
import { keyManagerRpc } from "@/utils/keyManagerRpc";

type Web3ProviderProps = {
  children: ReactNode;
};

const projectId = "YOUR_WALLETCONNECT_PROJECT_ID"; // In production, this should be env var

// Create config using the new getDefaultConfig method from RainbowKit v2
const config = getDefaultConfig({
  appName: "Decentralized App",
  projectId,
  chains: chains,
  transports: Object.fromEntries(chains.map((chain) => [chain.id, keyManagerRpc()])),
});

// Create a query client for TanStack Query (required in RainbowKit v2)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme(),
            darkMode: darkTheme(),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
