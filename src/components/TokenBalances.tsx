"use client";

import { useTokenBalances } from "@/hooks/useTokenBalances";
import { formatTokenAmount } from "@/utils/format";
import { chains } from "@/config/chains";

export function TokenBalances() {
  const { balancesByGroup, isLoading, error } = useTokenBalances();

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 dark:text-red-400">
        Error loading balances: {error}
      </div>
    );
  }

  const chainMap = Object.fromEntries(chains.map((chain) => [chain.id, chain]));

  return (
    <div className="w-full max-w-md mx-auto mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Unified Token Balances
        </h2>
      </div>

      {isLoading ? (
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Loading balances...</p>
        </div>
      ) : balancesByGroup.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No token balances found
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {balancesByGroup.map((groupBalance) => (
            <div key={groupBalance.groupId} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {groupBalance.displaySymbol}
                </h3>
                <span className="text-gray-600 dark:text-gray-300 font-medium">
                  {formatTokenAmount(groupBalance.totalBalance, groupBalance.decimals)}{" "}
                  {groupBalance.displaySymbol}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                {Object.entries(groupBalance.balanceByChain).map(([chainId, tokens]) => {
                  return tokens.map(({ balance, tokenSymbol }) => {
                    const chain = chainMap[Number(chainId)];

                    if (!chain || balance === 0n) return null;

                    return (
                      <div key={chainId} className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">
                          {chain.name}{" "}
                          {tokenSymbol !== groupBalance.displaySymbol && `(${tokenSymbol})`}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {formatTokenAmount(balance, groupBalance.decimals)}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
