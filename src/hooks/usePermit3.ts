"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { Hex, toHex } from "viem";
import {
  createUnhingedProofFromAllLeaves,
  encodeChainAllowances,
} from "@/utils/createUnhingedProof";
import { TokenBalance } from "@/types/tokens";
import { AllowanceOrTransfer, Permit3SignatureResult, UsePermit3Result } from "@/types/permit3";
import { PERMIT3_ADDRESSES } from "@/config/contracts";

// Constants for Permit3 domain
const PERMIT3_DOMAIN_NAME = "Permit3";
const PERMIT3_DOMAIN_VERSION = "1";

export function usePermit3(): UsePermit3Result {
  const { address } = useAccount();
  const { signTypedDataAsync, isPending: isLoading, error } = useSignTypedData();
  const [, setSignature] = useState<string | null>(null);

  // Generate a Permit3 signature for selected tokens
  const generatePermit3Signature = async (
    tokens: { token: TokenBalance; amount: bigint; recipient: Hex }[],
  ): Promise<Permit3SignatureResult | null> => {
    if (!address || tokens.length === 0) {
      return null;
    }

    // Always use Ethereum
    const chainId = 1;

    // Check if Permit3 contract is available for this chain
    const permit3ContractAddress = PERMIT3_ADDRESSES[chainId];
    if (!permit3ContractAddress) {
      console.error(`Permit3 contract not available for chain ID ${chainId}`);
      return null;
    }

    // Create random salt for the signature
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;

    // Set deadline 24 hours from now (in seconds)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24);

    // Current timestamp (in seconds)
    const timestamp = Math.floor(Date.now() / 1000);

    // Organize permits by chain ID first
    const permitsByChain: Record<number, AllowanceOrTransfer[]> = {};

    // Group all tokens by chain ID
    tokens.forEach(({ token, amount, recipient }) => {
      if (token.balance > 0n) {
        const tokenChainId = token.chainId;

        if (!permitsByChain[tokenChainId]) {
          permitsByChain[tokenChainId] = [];
        }

        // Create a permit for this token
        const allowance = {
          modeOrExpiration: 0, // Transfer mode
          token: token.address as Hex,
          account: recipient,
          amountDelta: amount,
        };

        permitsByChain[tokenChainId].push(allowance);
      }
    });

    // Generate hash for each chain's permits
    const chainHashes: Hex[] = Object.entries(permitsByChain).map(([chainIdStr, chainAllowances]) =>
      encodeChainAllowances(BigInt(chainIdStr), chainAllowances),
    );

    const { root: unhingedRoot } = createUnhingedProofFromAllLeaves(chainHashes, 0);

    // EIP-712 domain and types for signing
    const domain = {
      name: PERMIT3_DOMAIN_NAME,
      version: PERMIT3_DOMAIN_VERSION,
      chainId,
      verifyingContract: permit3ContractAddress,
    };

    const types = {
      SignedUnhingedPermit3: [
        { name: "owner", type: "address" },
        { name: "salt", type: "bytes32" },
        { name: "deadline", type: "uint256" },
        { name: "timestamp", type: "uint48" },
        { name: "unhingedRoot", type: "bytes32" },
      ],
    } as const;

    const message = {
      owner: address,
      salt,
      deadline,
      timestamp,
      unhingedRoot,
    };

    try {
      // Sign the typed data
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: "SignedUnhingedPermit3",
        message,
      });

      setSignature(signature);

      return {
        signature,
        deadline,
        chainId,
        leafs: chainHashes,
        owner: address,
        salt,
        timestamp,
        permitsByChain,
      };
    } catch (error) {
      console.error("Error signing Permit3 message:", error);
      return null;
    }
  };

  const resetSignature = () => {
    setSignature(null);
  };

  return {
    generatePermit3Signature,
    resetSignature,
    isLoading,
    error: error as Error | null,
  };
}
