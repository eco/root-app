"use client";

import { SwapInterface } from "@/components/SwapInterface";
import { TokenBalances } from "@/components/TokenBalances";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="md:w-1/2">
        <SwapInterface />
      </div>
      <div className="md:w-1/2">
        <TokenBalances />
      </div>
    </div>
  );
}