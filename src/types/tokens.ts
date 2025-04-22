import { Hex } from "viem";

export interface TokenBalance {
  chainId: number;
  tokenSymbol: string;
  tokenName: string;
  balance: bigint;
  decimals: number;
  address: Hex;
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
      address: Hex;
      tokenSymbol: string;
    }>
  >;
}
