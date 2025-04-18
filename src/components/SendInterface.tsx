"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { shortenAddress } from "@/utils/format";
import { useTokenBalances, TokenBalance } from "@/hooks/useTokenBalances";
import { formatTokenAmount } from "@/utils/format";
import { chains } from "@/config/chains";
import { z } from "zod";
import { isAddress } from "viem";

type SelectedToken = TokenBalance & {
  isSelected: boolean;
};

// Define validation schema with Zod
const sendFormSchema = z
  .object({
    recipient: z.string().refine((val) => isAddress(val), {
      message: "Invalid Ethereum address",
    }),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
    selectedTokens: z.array(z.any()).refine((tokens) => tokens.length > 0, {
      message: "At least one token must be selected",
    }),
    availableBalance: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Available balance must be greater than zero",
    }),
  })
  .refine(
    (data) => {
      // Validate that amount is less than or equal to available balance
      return Number(data.amount) <= Number(data.availableBalance);
    },
    {
      message: "Amount exceeds available balance",
      path: ["amount"], // Assign the error to the amount field
    },
  );

export function SendInterface() {
  const { address, isConnected } = useAccount();
  const { balances, isLoading } = useTokenBalances();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [errors, setErrors] = useState<{
    recipient?: string;
    amount?: string;
    selectedTokens?: string;
    form?: string;
  }>({});

  // Initialize selected tokens state from balances
  const [selectedTokens, setSelectedTokens] = useState<SelectedToken[]>([]);

  // Get chain map for displaying chain names
  const chainMap = Object.fromEntries(chains.map((chain) => [chain.id, chain]));

  // Update selected tokens when balances change
  useEffect(() => {
    if (balances.length > 0 && selectedTokens.length === 0) {
      setSelectedTokens(
        balances
          .filter((balance) => balance.balance > 0n)
          .map((balance) => ({
            ...balance,
            isSelected: true,
          })),
      );
    }
  }, [balances, selectedTokens.length]);

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

  const handleTokenSelectionChange = (chainId: number, tokenAddress: string) => {
    setSelectedTokens((current) =>
      current.map((token) =>
        token.chainId === chainId && token.address === tokenAddress
          ? { ...token, isSelected: !token.isSelected }
          : token,
      ),
    );
  };

  const getTotalSelectedBalance = () => {
    const selectedCount = selectedTokens.filter((token) => token.isSelected).length;

    if (selectedCount === 0) return "0";

    // For simplicity, we'll just show the number of tokens selected
    return `${selectedCount} token${selectedCount > 1 ? "s" : ""}`;
  };

  const getTotalAvailableBalance = () => {
    const selectedTokensList = selectedTokens.filter((token) => token.isSelected);
    if (selectedTokensList.length === 0) return "0";

    // Sum up the balances
    const totalBalance = selectedTokensList.reduce((total, token) => {
      return total + token.balance;
    }, 0n);

    // For simplicity, we'll use 18 decimals (most common in ETH tokens)
    // In a real app, you would handle different token decimals correctly
    const decimals = selectedTokensList[0]?.decimals || 18;
    return formatTokenAmount(totalBalance, decimals);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    const selectedTokensList = selectedTokens.filter((t) => t.isSelected);
    const availableBalance = getTotalAvailableBalance();

    try {
      // Validate form data using Zod
      const validatedData = sendFormSchema.parse({
        recipient: recipient || address || "",
        amount,
        selectedTokens: selectedTokensList,
        availableBalance,
      });

      // If validation passes, proceed with transaction
      console.log("Validated data:", {
        tokens: selectedTokensList.map((t) => ({
          chainId: t.chainId,
          chainName: chainMap[t.chainId]?.name,
          tokenSymbol: t.tokenSymbol,
          address: t.address,
        })),
        amount: validatedData.amount,
        recipient: validatedData.recipient,
      });

      // In a real app, you would handle the transaction here
      alert("Transaction validated successfully!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format and set error messages
        const newErrors: Record<string, string> = {};

        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const field = err.path[0].toString();
            newErrors[field] = err.message;
          } else {
            // General form error
            newErrors.form = err.message;
          }
        });

        setErrors(newErrors);
      } else {
        // Handle unexpected errors
        setErrors({ form: "An unexpected error occurred" });
        console.error("Validation error:", error);
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-xl bg-white dark:bg-gray-800 shadow-md text-center">
        <p className="text-gray-600 dark:text-gray-300">
          Connect your wallet to use the send interface
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {errors.form && (
          <div className="p-3 mb-2 text-sm text-red-600 bg-red-100 rounded-md">{errors.form}</div>
        )}
        {errors.selectedTokens && (
          <div className="p-3 mb-2 text-sm text-red-600 bg-red-100 rounded-md">
            {errors.selectedTokens}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tokens to Send
            </label>
            <button
              type="button"
              onClick={() => setShowTokenSelector(true)}
              className="text-sm text-blue-600 dark:text-blue-400"
            >
              Select Tokens
            </button>
          </div>

          <div className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
            {isLoading ? (
              <div className="py-2 text-center text-gray-500 dark:text-gray-400">
                Loading tokens...
              </div>
            ) : selectedTokens.filter((t) => t.isSelected).length === 0 ? (
              <div className="py-2 text-center text-gray-500 dark:text-gray-400">
                No tokens selected
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTokens
                  .filter((token) => token.isSelected)
                  .map((token) => (
                    <div
                      key={`${token.chainId}-${token.address}`}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md text-sm"
                    >
                      {token.tokenSymbol} ({chainMap[token.chainId]?.name})
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Available balance section */}
          {!isLoading && selectedTokens.filter((t) => t.isSelected).length > 0 && (
            <div className="mt-2 text-sm flex justify-between">
              <p className="text-gray-500 dark:text-gray-400">Available balance:</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {getTotalAvailableBalance()}
              </p>
            </div>
          )}
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
            className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border ${
              errors.amount ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
        </div>

        <div className="space-y-2">
          <label className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
            <span>Recipient</span>
            <span
              className="text-blue-600 dark:text-blue-400 text-xs cursor-pointer"
              onClick={() => setRecipient(address || "")}
            >
              Use my address
            </span>
          </label>
          <input
            type="text"
            value={recipient}
            onChange={handleRecipientChange}
            placeholder="0x..."
            className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border ${
              errors.recipient ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {recipient && !errors.recipient && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {shortenAddress(recipient, 8)}
            </p>
          )}
          {errors.recipient && <p className="mt-1 text-sm text-red-600">{errors.recipient}</p>}
        </div>

        <button
          type="submit"
          disabled={
            !recipient ||
            !amount ||
            Number(amount) <= 0 ||
            selectedTokens.filter((t) => t.isSelected).length === 0
          }
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Send {getTotalSelectedBalance()}
        </button>
      </form>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 max-w-md w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Tokens</h3>
              <button
                onClick={() => setShowTokenSelector(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {selectedTokens.map((token) => (
                <div
                  key={`${token.chainId}-${token.address}`}
                  className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-md"
                >
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={token.isSelected}
                      onChange={() => handleTokenSelectionChange(token.chainId, token.address)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-gray-900 dark:text-white">{token.tokenSymbol}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {chainMap[token.chainId]?.name}
                      </span>
                    </div>
                  </label>
                  <span className="text-gray-600 dark:text-gray-300">
                    {formatTokenAmount(token.balance, token.decimals)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowTokenSelector(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
