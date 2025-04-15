"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { shortenAddress } from "@/utils/format";

export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        return (
          <div
            className="flex items-center"
            style={{
              opacity: mounted ? "1" : "0",
            }}
          >
            {(() => {
              if (!mounted || !account || !chain) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {chain.hasIcon && (
                      <div className="w-4 h-4 overflow-hidden">
                        {chain.iconUrl && (
                          // Using inline style instead of img to avoid ESLint warning
                          <div 
                            className="w-4 h-4 bg-contain bg-center bg-no-repeat"
                            style={{ backgroundImage: `url(${chain.iconUrl})` }}
                            role="img"
                            aria-label={chain.name ?? "Chain icon"}
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {account.displayBalance
                      ? `${account.displayBalance}`
                      : ""}{" "}
                    <span>{shortenAddress(account.address)}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}