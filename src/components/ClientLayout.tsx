"use client";

import { ReactNode } from "react";
import { Web3Provider } from "@/components/Web3Provider";
import { Header } from "@/components/Header";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Web3Provider>
        <Header />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </Web3Provider>
    </QueryClientProvider>
  );
}
