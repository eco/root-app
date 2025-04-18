"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { keccak256, encodePacked, toHex, Hex } from "viem";
import { TokenBalance } from "./useTokenBalances";

// Constants for Permit3 domain
const PERMIT3_DOMAIN_NAME = "Permit3";
const PERMIT3_DOMAIN_VERSION = "1";

// The verified Permit3 contract addresses
const PERMIT3_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0x6D3c85960F0b42D0eFac0c79DEF4D618223B0C65", // Ethereum Mainnet
  137: "0x6D3c85960F0b42D0eFac0c79DEF4D618223B0C65", // Polygon
  42161: "0x6D3c85960F0b42D0eFac0c79DEF4D618223B0C65", // Arbitrum
  8453: "0x6D3c85960F0b42D0eFac0c79DEF4D618223B0C65", // Base
};

// The hash of the AllowanceOrTransfer type for hashing
const ALLOWANCE_OR_TRANSFER_TYPEHASH = keccak256(
  encodePacked(
    ["string"],
    [
      "AllowanceOrTransfer(uint48 modeOrExpiration,address token,address account,uint160 amountDelta)",
    ],
  ),
);

// The hash of the UnhingedCommitment type for hashing
const UNHINGED_COMMITMENT_TYPEHASH = keccak256(
  encodePacked(["string"], ["UnhingedCommitment(AllowanceOrTransfer[] allowanceOrTransfer)"]),
);

export type AllowanceOrTransfer = {
  modeOrExpiration: number;
  token: Hex;
  account: `0x${string}`;
  amountDelta: bigint;
};

export type Permit3SignatureResult = {
  signature: string;
  deadline: bigint;
  signatureData: {
    salt: `0x${string}`;
    timestamp: number;
    unhingedRoot: `0x${string}`;
    allowances: AllowanceOrTransfer[];
  };
};

export type UsePermit3Result = {
  generatePermit3Signature: (
    tokenBalances: TokenBalance[],
    recipient: `0x${string}`,
  ) => Promise<Permit3SignatureResult | null>;
  resetSignature: () => void;
  isLoading: boolean;
  error: Error | null;
};

export function usePermit3(): UsePermit3Result {
  const { address } = useAccount();
  const { signTypedDataAsync, isLoading, error } = useSignTypedData();
  const [, setSignature] = useState<string | null>(null);

  // Generate a Permit3 signature for selected tokens
  const generatePermit3Signature = async (
    tokenBalances: TokenBalance[],
    recipient: `0x${string}`,
  ): Promise<Permit3SignatureResult | null> => {
    if (!address || !recipient || tokenBalances.length === 0) {
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
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32))) as `0x${string}`;

    // Set deadline 24 hours from now (in seconds)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24);

    // Current timestamp (in seconds)
    const timestamp = Math.floor(Date.now() / 1000);

    // Create AllowanceOrTransfer objects for each token
    const allowances: AllowanceOrTransfer[] = tokenBalances.map((token) => ({
      // Mode 0 is a Transfer in Permit3
      modeOrExpiration: 0,
      token: token.address as Hex,
      account: recipient,
      // For maximum approval/transfer amount
      amountDelta: token.balance,
    }));

    if (allowances.length === 0) {
      console.error("No valid tokens found for the specified chain");
      return null;
    }

    // Hash each AllowanceOrTransfer
    const allowanceHashes = allowances.map((allowance) =>
      keccak256(
        encodePacked(
          ["bytes32", "uint48", "address", "address", "uint160"],
          [
            ALLOWANCE_OR_TRANSFER_TYPEHASH,
            allowance.modeOrExpiration,
            allowance.token as `0x${string}`,
            allowance.account,
            allowance.amountDelta,
          ],
        ),
      ),
    );

    // Create the unhinged root (combines all allowance hashes)
    // For multiple tokens, we need to combine all hashes
    let combinedHash = allowanceHashes[0];
    for (let i = 1; i < allowanceHashes.length; i++) {
      combinedHash = keccak256(
        encodePacked(
          ["bytes32", "bytes32"],
          [combinedHash as `0x${string}`, allowanceHashes[i] as `0x${string}`],
        ),
      );
    }

    // Final unhinged root hash
    const unhingedRoot = keccak256(
      encodePacked(
        ["bytes32", "bytes32"],
        [UNHINGED_COMMITMENT_TYPEHASH, combinedHash as `0x${string}`],
      ),
    ) as `0x${string}`;

    // EIP-712 domain and types for signing
    const domain = {
      name: PERMIT3_DOMAIN_NAME,
      version: PERMIT3_DOMAIN_VERSION,
      chainId,
      verifyingContract: permit3ContractAddress,
    };

    const types = {
      SignedPermit3: [
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
        primaryType: "SignedPermit3",
        message,
      });

      setSignature(signature);

      return {
        signature,
        deadline,
        signatureData: {
          salt,
          timestamp,
          unhingedRoot,
          allowances,
        },
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
