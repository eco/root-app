import { Hex } from "viem";

import { TokenBalance } from "@/types/tokens";

export type AllowanceOrTransfer = {
  modeOrExpiration: number;
  token: Hex;
  account: Hex;
  amountDelta: bigint;
};
export type ChainPermits = {
  chainId: bigint;
  permits: AllowanceOrTransfer[];
};
export type UnhingedProof = {
  nodes: Hex[];
  counts: Hex;
};
export type Permit3Proof = {
  permits: ChainPermits;
  unhingedProof: UnhingedProof;
};
export type Permit3SignatureResult = {
  signature: string;
  deadline: bigint;
  chainId: number; // The original chain ID from the signature
  leafs: Hex[]; // The original chain ID from the signature
  owner: Hex;
  salt: Hex;
  timestamp: number;
  // Store all permits by chain ID for easy filtering
  permitsByChain: Record<number, AllowanceOrTransfer[]>;
};
export type UsePermit3Result = {
  generatePermit3Signature: (
    tokens: { token: TokenBalance; amount: bigint; recipient: Hex }[],
  ) => Promise<Permit3SignatureResult | null>;
  resetSignature: () => void;
  isLoading: boolean;
  error: Error | null;
};
