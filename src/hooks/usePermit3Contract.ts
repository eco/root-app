"use client";

import { useState } from "react";
import { encodeFunctionData, Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { PERMIT3_ADDRESSES } from "./usePermit3";
import { Permit3SignatureResult } from "./usePermit3";
import { permit3Abi } from "@/abis/permit3";
import {
  createUnhingedProofFromAllLeaves,
  encodeChainAllowances,
} from "@/utils/createUnhingedProof";

export type UsePermit3ContractResult = {
  executePermit3: (
    signatureResult: Permit3SignatureResult,
    chainId: number,
  ) => Promise<`0x${string}` | null>;
  isLoading: boolean;
  error: Error | null;
  txHash: `0x${string}` | null;
};

export function usePermit3Contract(): UsePermit3ContractResult {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Function to call the Permit3 contract's permit function with chain-specific permits
  const executePermit3 = async (
    signatureResult: Permit3SignatureResult,
    chainId: number,
  ): Promise<`0x${string}` | null> => {
    if (!address || !walletClient || !publicClient) {
      setError(new Error("Wallet not connected"));
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      // Get the Permit3 contract address for the chain
      const permit3Address = PERMIT3_ADDRESSES[chainId];
      if (!permit3Address) {
        throw new Error(`Permit3 contract not available for chain ID ${chainId}`);
      }

      // Get the permits for this specific chain
      const chainPermits = signatureResult.permitsByChain[chainId];
      if (!chainPermits || chainPermits.length === 0) {
        throw new Error(`No token permits found for chain ID ${chainId}`);
      }

      // Verify we have the correct chain context

      // Create a chain-specific permits structure
      // IMPORTANT: The chainId MUST match the current chain where the transaction is executed
      const currentChainId = publicClient.chain?.id;
      if (currentChainId !== chainId) {
        throw new Error(
          `Current chain (${currentChainId}) does not match target chain (${chainId}). Make sure to switch networks first.`,
        );
      }

      const chainSpecificPermits = {
        chainId: BigInt(currentChainId),
        permits: chainPermits,
      };

      const leaf = encodeChainAllowances(
        chainSpecificPermits.chainId,
        chainSpecificPermits.permits,
      );

      const targetLeafIndex = signatureResult.leafs.indexOf(leaf);

      const { proof: unhingedProof, root: unhingedRoot } = createUnhingedProofFromAllLeaves(
        signatureResult.leafs,
        targetLeafIndex,
      );

      console.log({ unhingedProof, unhingedRoot, targetLeafIndex, leaf });

      // Create a chain-specific unhinged proof structure
      const chainSpecificProof = {
        permits: chainSpecificPermits,
        unhingedProof,
      };

      // Simulate the transaction to check for potential errors
      const permitData = encodeFunctionData({
        abi: permit3Abi,
        functionName: "permit",
        args: [
          signatureResult.owner,
          signatureResult.salt,
          signatureResult.deadline,
          signatureResult.timestamp,
          chainSpecificProof,
          signatureResult.signature as Hex,
        ],
      });

      console.log("Permit transaction", { data: permitData, to: permit3Address });

      // Simulate the transaction to check for potential errors
      const simulation = await publicClient.simulateContract({
        address: permit3Address,
        abi: permit3Abi,
        functionName: "permit",
        args: [
          signatureResult.owner,
          signatureResult.salt,
          signatureResult.deadline,
          signatureResult.timestamp,
          chainSpecificProof,
          signatureResult.signature as Hex,
        ],
        account: address,
      });

      console.log("simulation", simulation);

      // If simulation succeeded, send the transaction
      const hash = await walletClient.writeContract({
        address: permit3Address,
        abi: permit3Abi,
        functionName: "permit",
        args: [
          signatureResult.owner,
          signatureResult.salt,
          signatureResult.deadline,
          signatureResult.timestamp,
          chainSpecificProof,
          signatureResult.signature as Hex,
        ],
      });

      setTxHash(hash);

      // Wait for the transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      // Check if transaction was successful
      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }

      return hash;
    } catch (err) {
      console.error("Error executing Permit3 transaction:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    executePermit3,
    isLoading,
    error,
    txHash,
  };
}
