"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient } from "viem";
import { tokens } from "@/config/tokens";
import { chains } from "@/config/chains";
import { keyManagerRpc } from "@/utils/keyManagerRpc";

// ERC20 ABI (minimal for balance checking)
const erc20Abi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface TokenBalance {
  chainId: number;
  tokenSymbol: string;
  tokenName: string;
  balance: bigint;
  decimals: number;
  address: string;
  groupId?: string;
}

export interface GroupedTokenBalance {
  groupId: string;
  displaySymbol: string;
  displayName: string;
  decimals: number;
  totalBalance: bigint;
  balanceByChain: Record<
    number,
    Array<{
      balance: bigint;
      address: string;
      tokenSymbol: string;
    }>
  >;
}

export function useTokenBalances() {
  const { address } = useAccount();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalances() {
      if (!address) {
        setBalances([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const allBalances: TokenBalance[] = [];

        // For each chain
        for (const chain of chains) {
          const publicClient = createPublicClient({
            chain,
            transport: keyManagerRpc(), // Uses default API keys from rpcUrlBuilder
          });

          // Filter tokens available on this chain
          const tokensOnChain = tokens.filter((token) => token.addresses[chain.id]);

          if (tokensOnChain.length === 0) continue;

          try {
            // Use multicall for all tokens on the chain
            const contracts = tokensOnChain.map((token) => ({
              address: token.addresses[chain.id],
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            }));

            const results = await publicClient.multicall({
              contracts,
              allowFailure: true,
            });

            // Process multicall results
            results.forEach((result, index) => {
              if (result.status === "success") {
                const token = tokensOnChain[index];
                allBalances.push({
                  chainId: chain.id,
                  tokenSymbol: token.symbol,
                  tokenName: token.name,
                  balance: result.result as bigint,
                  decimals: token.decimals,
                  address: token.addresses[chain.id],
                  groupId: token.groupId,
                });
              } else {
                console.error(
                  `Multicall failed for ${tokensOnChain[index].symbol} on ${chain.name}:`,
                  result.error,
                );
              }
            });
          } catch (err) {
            console.error(`Error with multicall on ${chain.name}:`, err);
            // Skip this chain if multicall fails
          }
        }

        setBalances(allBalances);
      } catch (err) {
        console.error("Error fetching token balances:", err);
        setError("Failed to fetch token balances");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalances();
  }, [address]);

  // Group tokens by their groupId or symbol if no groupId
  const balancesByToken = balances.reduce<
    Record<
      string,
      {
        tokenSymbol: string;
        tokenName: string;
        decimals: number;
        totalBalance: bigint;
        balanceByChain: Record<number, { balance: bigint; address: string }>;
      }
    >
  >((acc, balance) => {
    const { tokenSymbol, chainId, balance: amount, decimals, address } = balance;

    if (!acc[tokenSymbol]) {
      acc[tokenSymbol] = {
        tokenSymbol,
        tokenName: balance.tokenName,
        decimals,
        totalBalance: 0n,
        balanceByChain: {},
      };
    }

    acc[tokenSymbol].balanceByChain[chainId] = {
      balance: amount,
      address,
    };
    acc[tokenSymbol].totalBalance += amount;

    return acc;
  }, {});

  // Group and sum balances by token group
  const balancesByGroup = balances.reduce<Record<string, GroupedTokenBalance>>((acc, balance) => {
    const { chainId, balance: amount, decimals, address, tokenSymbol, tokenName } = balance;
    // Use uppercase for groupId lookups for consistency
    // This ensures that "USD" and "usd" are treated the same
    const normalizedGroupId = (balance.groupId || tokenSymbol).toUpperCase();
    // Use the normalized key for the acc object to ensure consistent grouping
    if (!acc[normalizedGroupId]) {
      // For the display name/symbol, prioritize the simplest version (e.g., USDC over USDC.e)
      const isUSDGroup = normalizedGroupId === "USD";
      acc[normalizedGroupId] = {
        groupId: normalizedGroupId,
        displaySymbol: isUSDGroup ? "USD" : tokenSymbol,
        displayName: isUSDGroup ? "USD Stablecoins" : tokenName,
        decimals,
        totalBalance: 0n,
        balanceByChain: {},
      };
    }

    // Initialize the array for this chain if it doesn't exist
    if (!acc[normalizedGroupId].balanceByChain[chainId]) {
      acc[normalizedGroupId].balanceByChain[chainId] = [];
    }

    // Add this token to the array of tokens for this chain in this group
    acc[normalizedGroupId].balanceByChain[chainId].push({
      balance: amount,
      address,
      tokenSymbol,
    });
    // Add to the group's total balance
    acc[normalizedGroupId].totalBalance += amount;

    return acc;
  }, {});

  return {
    balances,
    balancesByToken: Object.values(balancesByToken),
    balancesByGroup: Object.values(balancesByGroup),
    isLoading,
    error,
  };
}
