"use client";

import { useQuery } from "@tanstack/react-query";
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

// Fetch balances function separated for re-usability
async function fetchBalances(walletAddress: string | undefined): Promise<TokenBalance[]> {
  if (!walletAddress) {
    return [];
  }

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
        args: [walletAddress],
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

  return allBalances;
}

export function useTokenBalances() {
  const { address } = useAccount();

  const {
    data: balances = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tokenBalances", address],
    queryFn: () => fetchBalances(address),
    enabled: !!address,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Group tokens by their tokenSymbol or symbol if no tokenSymbol
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
    // For now, add the full balance (we'll adjust this to use available balances in the component)
    acc[normalizedGroupId].totalBalance += amount;

    return acc;
  }, {});

  return {
    balances,
    balancesByToken: Object.values(balancesByToken),
    balancesByGroup: Object.values(balancesByGroup),
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
