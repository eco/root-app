# Decentralized Application

This is a decentralized application built with Next.js, RainbowKit, Wagmi, and Viem. It allows users to connect their wallets, view token balances across multiple chains, and simulate token swaps.

## Features

- Connect wallet with RainbowKit
- View ERC20 token balances across multiple chains (Ethereum, Polygon, Arbitrum, Base)
- Uniswap-like swap interface
- Dark/Light mode support
- Responsive design with Tailwind CSS

## Technologies Used

- **Next.js 15.3.0** with App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS** for styling
- **Wagmi v1** for wallet management
- **Viem** for contract interactions
- **RainbowKit** for wallet connection UI

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/src/app` - Contains the Next.js pages and layout
- `/src/components` - UI components
- `/src/config` - Configuration for chains, tokens, and addresses
- `/src/hooks` - Custom React hooks
- `/src/utils` - Utility functions

## Configuration

To connect to different chains or add more tokens, modify the files in the `/src/config` directory:

- `chains.ts` - Chain definitions
- `tokens.ts` - Token definitions

## Todo

- Implement actual transaction sending
- Add more sophisticated balance fetching with multicall
- Add portfolio view and transaction history
- Implement actual token swapping functionality

## License

MIT
