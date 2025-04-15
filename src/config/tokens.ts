export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  addresses: Record<number, string>;
  groupId?: string; // Used for grouping tokens together (e.g., USDC and USDT)
}

export const tokens: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    groupId: "USD",
    addresses: {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
      137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
    },
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    groupId: "USD",
    addresses: {
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
      8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // Base
    },
  },
];