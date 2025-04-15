"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { chains } from "@/config/chains";
import { tokens } from "@/config/tokens";
import { shortenAddress } from "@/utils/format";

export function SwapInterface() {
  const { address, isConnected } = useAccount();
  const [selectedChain, setSelectedChain] = useState(chains[0]);
  const [selectedToken, setSelectedToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chain = chains.find(c => c.id === Number(e.target.value));
    if (chain) setSelectedChain(chain);
  };
  
  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const token = tokens.find(t => t.symbol === e.target.value);
    if (token) setSelectedToken(token);
  };
  
  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipient(e.target.value);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and decimals
    const value = e.target.value;
    if (value === "" || /^[0-9]*[.]?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would handle the transaction
    console.log({
      chainId: selectedChain.id,
      token: selectedToken.symbol,
      amount,
      recipient: recipient || address,
    });
  };
  
  if (!isConnected) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-xl bg-white dark:bg-gray-800 shadow-md text-center">
        <p className="text-gray-600 dark:text-gray-300">Connect your wallet to use the swap interface</p>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Swap</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Chain
          </label>
          <select
            value={selectedChain.id}
            onChange={handleChainChange}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Token
          </label>
          <select
            value={selectedToken.symbol}
            onChange={handleTokenChange}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {tokens.map((token) => (
              <option key={token.symbol} value={token.symbol} disabled={!token.addresses[selectedChain.id]}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount
          </label>
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.0"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="space-y-2">
          <label className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
            <span>Recipient (optional)</span>
            <span className="text-blue-600 dark:text-blue-400 text-xs cursor-pointer" 
                  onClick={() => setRecipient(address || "")}>
              Use my address
            </span>
          </label>
          <input
            type="text"
            value={recipient}
            onChange={handleRecipientChange}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {recipient && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {shortenAddress(recipient, 8)}
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={!amount || Number(amount) <= 0}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Swap
        </button>
      </form>
    </div>
  );
}