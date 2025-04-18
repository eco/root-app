"use client";

import { SendInterface } from "@/components/SendInterface";
import { TokenBalances } from "@/components/TokenBalances";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="md:w-1/2">
          <SendInterface />
        </div>
        <div className="md:w-1/2">
          <TokenBalances />
        </div>
      </div>
    </div>
  );
}
