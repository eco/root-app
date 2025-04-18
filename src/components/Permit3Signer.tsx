"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { tokens } from "@/config/tokens";
import { keccak256, encodePacked, toHex, getAddress, Hex } from "viem";

// The types are defined according to the Permit3 contract
const PERMIT3_DOMAIN_NAME = "Permit3";
const PERMIT3_DOMAIN_VERSION = "1";

// The SignedPermit3 type string (used in the typedData structure below)
// Note: This is defined here for documentation, we use the full type structure in typedData

// The hash of the UnhingedCommitment type
const UNHINGED_COMMITMENT_TYPEHASH = keccak256(
  encodePacked(["string"], ["UnhingedCommitment(AllowanceOrTransfer[] allowanceOrTransfer)"]),
);

// The hash of the AllowanceOrTransfer type
const ALLOWANCE_OR_TRANSFER_TYPEHASH = keccak256(
  encodePacked(
    ["string"],
    [
      "AllowanceOrTransfer(uint48 modeOrExpiration,address token,address account,uint160 amountDelta)",
    ],
  ),
);

// This is a simplified version for demo purposes
export function Permit3Signer() {
  const { address: walletAddress } = useAccount();
  const [salt] = useState(toHex(crypto.getRandomValues(new Uint8Array(32))));
  const [deadline] = useState(Math.floor(Date.now() / 1000) + 60 * 60 * 24); // 24 hours from now
  const [timestamp] = useState(Math.floor(Date.now() / 1000));
  const [signature, setSignature] = useState("");
  const [selectedToken, setSelectedToken] = useState(tokens[0]);

  // For a real implementation, this would come from a smart contract or database
  const permit3ContractAddress = "0xFB63C771dd42F5f8C949c69Cddb15aFe585D6889" as Hex; // mainnet Permit3 contract
  // This would normally be the address of a spender contract
  const spenderAddress = walletAddress!;

  // Create an AllowanceOrTransfer for the selected token
  const createAllowanceOrTransfer = (token: (typeof tokens)[0], chainId: number) => {
    const tokenAddress = token.addresses[chainId];
    if (!tokenAddress) return null;

    return {
      // This is a permissive, unbounded approval (expiration = 0)
      modeOrExpiration: 0, // Permit/Transfer mode (0 = Transfer)
      token: getAddress(tokenAddress),
      account: spenderAddress, // The spender address
      amountDelta: BigInt("0xffffffffffffffffffffffffffffffff"), // Max approval amount
    };
  };

  // This creates the hash for the unhinged commitment (containing the list of token approvals)
  const createUnhingedRoot = (chainId: number, useAllTokens = false) => {
    let allowanceHashes: Hex[] = [];

    if (useAllTokens) {
      // Create an AllowanceOrTransfer for each token
      tokens.forEach((token) => {
        const allowanceOrTransfer = createAllowanceOrTransfer(token, chainId);
        if (allowanceOrTransfer) {
          const hash = keccak256(
            encodePacked(
              ["bytes32", "uint48", "address", "address", "uint160"],
              [
                ALLOWANCE_OR_TRANSFER_TYPEHASH,
                allowanceOrTransfer.modeOrExpiration,
                allowanceOrTransfer.token,
                allowanceOrTransfer.account,
                allowanceOrTransfer.amountDelta,
              ],
            ),
          );
          allowanceHashes.push(hash);
        }
      });

      if (allowanceHashes.length === 0) return null;
    } else {
      // Create an AllowanceOrTransfer for the selected token
      const allowanceOrTransfer = createAllowanceOrTransfer(selectedToken, chainId);
      if (!allowanceOrTransfer) return null;

      // Hash for a single AllowanceOrTransfer
      const allowanceHash = keccak256(
        encodePacked(
          ["bytes32", "uint48", "address", "address", "uint160"],
          [
            ALLOWANCE_OR_TRANSFER_TYPEHASH,
            allowanceOrTransfer.modeOrExpiration,
            allowanceOrTransfer.token,
            allowanceOrTransfer.account,
            allowanceOrTransfer.amountDelta,
          ],
        ),
      );

      allowanceHashes = [allowanceHash];
    }

    // For multiple items, we create a combined hash
    // This is a simplified implementation - in production you would use a Merkle tree
    // but for this demo we'll just hash all the items together
    const combinedHash = allowanceHashes.reduce(
      (acc, hash) => keccak256(encodePacked(["bytes32", "bytes32"], [acc, hash])),
      allowanceHashes[0],
    );

    // For the unhinged commitment hash
    return keccak256(
      encodePacked(["bytes32", "bytes32"], [UNHINGED_COMMITMENT_TYPEHASH, combinedHash]),
    );
  };

  // Use wagmi's signTypedData for EIP-712 signing
  const { signTypedDataAsync, isLoading } = useSignTypedData();

  const [useAllTokens, setUseAllTokens] = useState(false);

  const handleSign = async () => {
    if (!walletAddress) {
      throw new Error("Missing wallet address");
    }

    // Using Ethereum mainnet for this example
    const chainId = 1;
    const unhingedRoot = createUnhingedRoot(chainId, useAllTokens);

    if (!unhingedRoot) {
      alert("Selected token(s) not available on this chain");
      return;
    }

    // EIP-712 TypedData structure
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
      owner: walletAddress,
      salt,
      deadline: BigInt(deadline),
      timestamp,
      unhingedRoot,
    };

    try {
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: "SignedPermit3",
        message,
      });
      setSignature(signature);
      console.log("Signature:", signature);
    } catch (error) {
      console.error("Error signing:", error);
    }
  };

  return (
    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Sign Permit3 Message</h2>

      <div className="mb-4">
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="useAllTokens"
            checked={useAllTokens}
            onChange={(e) => setUseAllTokens(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="useAllTokens" className="text-sm font-medium">
            Sign for all tokens
          </label>
        </div>

        {!useAllTokens && (
          <>
            <label className="block text-sm font-medium mb-1">Token</label>
            <select
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              value={selectedToken.symbol}
              onChange={(e) => {
                const token = tokens.find((t) => t.symbol === e.target.value);
                if (token) setSelectedToken(token);
              }}
            >
              {tokens.map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
          </>
        )}

        {useAllTokens && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            <p className="text-sm font-medium mb-1">Will sign for:</p>
            <div className="flex flex-wrap gap-1">
              {tokens.map((token) => (
                <span
                  key={token.symbol}
                  className="inline-block px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded-md"
                >
                  {token.symbol}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm">
          <strong>Salt:</strong> {salt.substring(0, 10)}...
        </p>
        <p className="text-sm">
          <strong>Deadline:</strong> {new Date(deadline * 1000).toLocaleString()}
        </p>
      </div>

      <button
        onClick={handleSign}
        disabled={isLoading || !walletAddress}
        className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
      >
        {isLoading
          ? "Signing..."
          : useAllTokens
            ? "Sign Permit3 Message for All Tokens"
            : "Sign Permit3 Message"}
      </button>

      {signature && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
          <h3 className="text-sm font-medium mb-1">Signature</h3>
          <p className="text-xs break-all font-mono">{signature}</p>
        </div>
      )}
    </div>
  );
}
