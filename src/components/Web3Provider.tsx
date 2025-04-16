"use client";

import { ReactNode } from "react";
import { WagmiConfig, createConfig, configureChains } from "wagmi";
import { mainnet, polygon, arbitrum, base } from "wagmi/chains";
import {
  connectorsForWallets,
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  trustWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { publicProvider } from "wagmi/providers/public";
import { customProvider } from "@/utils/customProvider";

import "@rainbow-me/rainbowkit/styles.css";

type Web3ProviderProps = {
  children: ReactNode;
};

const projectId = "YOUR_WALLETCONNECT_PROJECT_ID"; // In production, this should be env var

// Configure chains & providers
const { chains, publicClient } = configureChains(
  [mainnet, polygon, arbitrum, base],
  [customProvider(), publicProvider()], // Uses default API keys from rpcUrlBuilder
);

// Configure supported wallets
const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      metaMaskWallet({ projectId, chains }),
      coinbaseWallet({ appName: "Decentralized App", chains }),
      walletConnectWallet({ projectId, chains }),
    ],
  },
  {
    groupName: "Others",
    wallets: [rainbowWallet({ projectId, chains }), trustWallet({ projectId, chains })],
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
        chains={chains}
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
