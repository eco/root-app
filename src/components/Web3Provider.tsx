"use client";

import { ReactNode } from "react";
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import {
  connectorsForWallets,
  darkTheme,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { publicProvider } from "wagmi/providers/public";
import { customProvider } from "@/utils/customProvider";
import { chains } from "@/config/chains";

import "@rainbow-me/rainbowkit/styles.css";

type Web3ProviderProps = {
  children: ReactNode;
};

const projectId = "YOUR_WALLETCONNECT_PROJECT_ID"; // In production, this should be env var

// Configure chains & providers
const { chains: wagmiChains, publicClient } = configureChains(
  chains,
  [customProvider(), publicProvider()], // Uses default API keys from rpcUrlBuilder
);

// Configure supported wallets
const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      metaMaskWallet({ projectId, chains: wagmiChains }),
      coinbaseWallet({ appName: "Decentralized App", chains: wagmiChains }),
      walletConnectWallet({ projectId, chains: wagmiChains }),
    ],
  },
  {
    groupName: "Others",
    wallets: [
      rainbowWallet({ projectId, chains: wagmiChains }),
      trustWallet({ projectId, chains: wagmiChains }),
    ],
  },
]);

// Create wagmi config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider
        chains={wagmiChains}
        modalSize="compact"
        theme={{
          lightMode: lightTheme(),
          darkMode: darkTheme(),
        }}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
