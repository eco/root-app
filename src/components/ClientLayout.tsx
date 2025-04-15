"use client";

import { ReactNode } from "react";
import { Web3Provider } from "@/components/Web3Provider";
import { Header } from "@/components/Header";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Web3Provider>
      <Header />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </Web3Provider>
  );
}