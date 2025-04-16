"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { tokens } from "@/config/tokens";
import { chains } from "@/config/chains";

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
    {
      balance: bigint;
      address: string;
      tokenSymbol: string;
    }
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
        const balancePromises: Promise<TokenBalance[]>[] = [];

        // For each chain
        for (const chain of chains) {
          const publicClient = createPublicClient({
            chain,
            transport: http(),
          });

          const chainPromises = tokens.map(async (token) => {
            const tokenAddress = token.addresses[chain.id];

            if (!tokenAddress) return [];

            try {
              const balance = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
              });

              return [
                {
                  chainId: chain.id,
                  tokenSymbol: token.symbol,
                  tokenName: token.name,
                  balance,
                  decimals: token.decimals,
                  address: tokenAddress,
                  groupId: token.groupId,
                },
              ];
            } catch (err) {
              console.error(`Error fetching balance for ${token.symbol} on ${chain.name}:`, err);
              return [];
            }
          });

          balancePromises.push(Promise.all(chainPromises).then((results) => results.flat()));
        }

        const allBalances = await Promise.all(balancePromises);
        setBalances(allBalances.flat());
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
    const groupId = balance.groupId || tokenSymbol.toLowerCase();

    if (!acc[groupId]) {
      // For the display name/symbol, prioritize the simplest version (e.g., USDC over USDC.e)
      acc[groupId] = {
        groupId,
        displaySymbol: groupId === "USD" ? "USD" : tokenSymbol,
        displayName: groupId === "USD" ? "USD Stablecoins" : tokenName,
        decimals,
        totalBalance: 0n,
        balanceByChain: {},
      };
    }

    acc[groupId].balanceByChain[chainId] = {
      balance: amount,
      address,
      tokenSymbol,
    };
    acc[groupId].totalBalance += amount;

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
