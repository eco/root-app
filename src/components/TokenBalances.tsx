"use client";

import { useState } from "react";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { formatTokenAmount } from "@/utils/format";
import { chains } from "@/config/chains";
import { useTokenAllowances, TokenAllowance } from "@/hooks/useTokenAllowances";
import { AllowanceDialog } from "./AllowanceDialog";
import { GroupedTokenBalance } from "@/types/tokens";

export function TokenBalances() {
  const { balancesByGroup, balances, isLoading, error } = useTokenBalances();
  const {
    allowances,
    getAvailableBalance,
    refetch: refetchAllowances,
    isLoading: allowancesLoading,
  } = useTokenAllowances();
  const [selectedAllowance, setSelectedAllowance] = useState<TokenAllowance | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 dark:text-red-400">
        Error loading balances: {error}
      </div>
    );
  }

  const chainMap = Object.fromEntries(chains.map((chain) => [chain.id, chain]));

  const openAllowanceDialog = (chainId: number, tokenAddress: string) => {
    const allowance = allowances.find(
      (a) => a.chainId === chainId && a.address.toLowerCase() === tokenAddress.toLowerCase(),
    );

    if (allowance) {
      setSelectedAllowance(allowance);
      setIsDialogOpen(true);
    }
  };

  const handleAllowanceSuccess = () => {
    refetchAllowances();
  };

  const isLoaded = !isLoading && !allowancesLoading;

  // Calculate the unified available balances for each group
  const getGroupWithAvailableBalances = (groupBalance: GroupedTokenBalance) => {
    let availableTotalBalance = 0n;
    let actualTotalBalance = 0n;

    // Calculate available and actual balances for the group
    Object.entries(groupBalance.balanceByChain).forEach(([chainId, tokens]) => {
      tokens.forEach(({ balance, address }) => {
        const numericChainId = Number(chainId);
        // Find the token balance in the flat array
        const tokenBalance = balances.find(
          (b) => b.chainId === numericChainId && b.address.toLowerCase() === address.toLowerCase(),
        );

        if (tokenBalance) {
          const availableBalance = getAvailableBalance(tokenBalance, allowances);
          availableTotalBalance += availableBalance;
          actualTotalBalance += balance;
        }
      });
    });

    return {
      availableTotalBalance,
      actualTotalBalance,
    };
  };

  return (
    <>
      <div className="w-full max-w-md mx-auto mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Unified Token Balances
          </h2>
        </div>

        {!isLoaded ? (
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
            {balancesByGroup.map((groupBalance) => {
              const { availableTotalBalance, actualTotalBalance } =
                getGroupWithAvailableBalances(groupBalance);

              return (
                <div key={groupBalance.groupId} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {groupBalance.displaySymbol}
                    </h3>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-700 dark:text-gray-200 font-medium">
                        {formatTokenAmount(availableTotalBalance, groupBalance.decimals)}{" "}
                        {groupBalance.displaySymbol}
                      </span>
                      {availableTotalBalance !== actualTotalBalance && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTokenAmount(actualTotalBalance, groupBalance.decimals)}{" "}
                          {groupBalance.displaySymbol} total
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {Object.entries(groupBalance.balanceByChain).map(([chainId, tokens]) => {
                      return tokens.map(({ balance, tokenSymbol, address }) => {
                        const chain = chainMap[Number(chainId)];
                        const numericChainId = Number(chainId);

                        if (!chain || balance === 0n) return null;

                        // Find the balance in the flat balances array for calculating available balance
                        const tokenBalance = balances.find(
                          (b) =>
                            b.chainId === numericChainId &&
                            b.address.toLowerCase() === address.toLowerCase(),
                        );

                        const availableBalance = tokenBalance
                          ? getAvailableBalance(tokenBalance, allowances)
                          : 0n;

                        return (
                          <div
                            key={`${chainId}-${address}`}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-500 dark:text-gray-400 flex items-center">
                              {chain.name}{" "}
                              {tokenSymbol !== groupBalance.displaySymbol && `(${tokenSymbol})`}
                            </span>
                            <div className="flex items-center space-x-2">
                              <div className="flex flex-col items-end">
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {formatTokenAmount(availableBalance, groupBalance.decimals)}
                                </span>
                                {availableBalance !== balance && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatTokenAmount(balance, groupBalance.decimals)}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => openAllowanceDialog(numericChainId, address)}
                                className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none"
                                title="Manage allowance"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AllowanceDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        tokenAllowance={selectedAllowance}
        onSuccess={handleAllowanceSuccess}
      />
    </>
  );
}
