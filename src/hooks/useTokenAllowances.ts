"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, Hex } from "viem";
import { tokens } from "@/config/tokens";
import { chains } from "@/config/chains";

import { TokenBalance } from "@/types/tokens";
import { keyManagerRpc } from "@/utils/keyManagerRpc";
import { PERMIT3_ADDRESSES } from "@/config/contracts";

// ERC20 ABI (minimal for allowance checking)
const erc20Abi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface TokenAllowance {
  chainId: number;
  tokenSymbol: string;
  tokenName: string;
  address: Hex;
  decimals: number;
  allowance: bigint;
}

// Fetch allowances function
async function fetchAllowances(walletAddress: string | undefined): Promise<TokenAllowance[]> {
  if (!walletAddress) {
    return [];
  }

  const allAllowances: TokenAllowance[] = [];

  // For each chain that has a Permit3 contract
  for (const chain of chains) {
    // Skip chains without Permit3 contract
    const permit3Address = PERMIT3_ADDRESSES[chain.id];
    if (!permit3Address) continue;

    const publicClient = createPublicClient({
      chain,
      transport: keyManagerRpc(),
    });

    // Filter tokens available on this chain
    const tokensOnChain = tokens.filter((token) => token.addresses[chain.id]);

    if (tokensOnChain.length === 0) continue;

    try {
      // Use multicall for all tokens on the chain
      const contracts = tokensOnChain.map((token) => ({
        address: token.addresses[chain.id],
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletAddress, permit3Address],
      }));

      const results = await publicClient.multicall({
        contracts,
        allowFailure: true,
      });

      // Process multicall results
      results.forEach((result, index) => {
        if (result.status === "success") {
          const token = tokensOnChain[index];
          allAllowances.push({
            chainId: chain.id,
            tokenSymbol: token.symbol,
            tokenName: token.name,
            address: token.addresses[chain.id] as Hex,
            decimals: token.decimals,
            allowance: result.result as bigint,
          });
        } else {
          console.error(
            `Multicall failed for ${tokensOnChain[index].symbol} allowance on ${chain.name}:`,
            result.error,
          );
        }
      });
    } catch (err) {
      console.error(`Error with multicall for allowances on ${chain.name}:`, err);
      // Skip this chain if multicall fails
    }
  }

  return allAllowances;
}

export function useTokenAllowances() {
  const { address } = useAccount();

  const {
    data: allowances = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["tokenAllowances", address],
    queryFn: () => fetchAllowances(address),
    enabled: !!address,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Function to get the available balance (min of balance and allowance)
  const getAvailableBalance = (balance: TokenBalance, allowances: TokenAllowance[]): bigint => {
    // Find corresponding allowance for this token on this chain
    const allowance = allowances.find(
      (a) =>
        a.chainId === balance.chainId && a.address.toLowerCase() === balance.address.toLowerCase(),
    );

    // If no allowance found or allowance is 0, return 0
    if (!allowance || allowance.allowance === 0n) return 0n;

    // Max uint256 value is treated as infinite allowance
    const maxUint256 = 2n ** 256n - 1n;
    if (allowance.allowance === maxUint256) return balance.balance;

    // Return the minimum of balance and allowance
    return balance.balance < allowance.allowance ? balance.balance : allowance.allowance;
  };

  return {
    allowances,
    isLoading,
    error: error ? (error as Error).message : null,
    getAvailableBalance,
    refetch,
  };
}
