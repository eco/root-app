import { formatUnits } from "viem/utils";

export function formatTokenAmount(amount: bigint, decimals: number, maxDecimals = 4): string {
  const formatted = formatUnits(amount, decimals);
  const parts = formatted.split(".");

  if (parts.length === 1) return parts[0];

  const integerPart = parts[0];
  const decimalPart = parts[1].slice(0, maxDecimals).replace(/0+$/, "");

  if (decimalPart === "") return integerPart;
  return `${integerPart}.${decimalPart}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
}

export function formatChainName(chainName: string): string {
  return chainName.charAt(0).toUpperCase() + chainName.slice(1);
}
