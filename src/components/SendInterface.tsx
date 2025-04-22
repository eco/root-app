"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useSwitchNetwork } from "wagmi";
import { mainnet } from "wagmi/chains";
import { formatTokenAmount, shortenAddress } from "@/utils/format";
import { TokenBalance, useTokenBalances } from "@/hooks/useTokenBalances";
import { chains } from "@/config/chains";
import { tokens } from "@/config/tokens";
import { z } from "zod";
import { Hex, isAddress, isAddressEqual, parseUnits } from "viem";
import { PERMIT3_ADDRESSES, Permit3SignatureResult, usePermit3 } from "@/hooks/usePermit3";
import { usePermit3Contract } from "@/hooks/usePermit3Contract";
import { useTokenAllowances } from "@/hooks/useTokenAllowances";
import { useQuery } from "@tanstack/react-query";
import { EcoChainIds, EcoProtocolAddresses, IntentType } from "@eco-foundation/routes-ts";
import {
  CreateSimpleIntentParams,
  OpenQuotingClient,
  RoutesService,
  RoutesSupportedChainId,
  selectCheapestQuote,
} from "@eco-foundation/routes-sdk";
import { intentSourceAbi } from "@/abis/intentSource";

type SelectedToken = TokenBalance & {
  isSelected: boolean;
  availableBalance?: bigint; // Add available balance
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

// eslint-disable-next-line
function sendToExecuteEndpoint(param: {
  permit3Result: Permit3SignatureResult;
  intents: IntentType[];
}) {}

export function SendInterface() {
  const { address, isConnected } = useAccount();
  const { balances, isLoading } = useTokenBalances();
  const { allowances, getAvailableBalance, isLoading: allowancesLoading } = useTokenAllowances();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [errors, setErrors] = useState<{
    recipient?: string;
    amount?: string;
    selectedTokens?: string;
    form?: string;
    targetToken?: string;
  }>({});

  // Get the generatePermit3Signature function
  const {
    generatePermit3Signature,
    isLoading: isPermit3Loading,
    // We're not using the error directly, but it's logged inside the hook
  } = usePermit3();

  // Hook for calling the Permit3 contract
  const { executePermit3, isLoading: isPermit3TxLoading } = usePermit3Contract();

  // Hook for switching networks and interacting with the blockchain
  const { switchNetwork, isLoading: isSwitchingNetwork } = useSwitchNetwork();
  const publicClient = usePublicClient();

  // State for tracking transaction submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permit3Result, setPermit3Result] = useState<Permit3SignatureResult | null>(null);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showFullSignature, setShowFullSignature] = useState(false);
  const [chainTxHashes, setChainTxHashes] = useState<Record<number, `0x${string}`>>({});
  const [isSwitchingToEthereum, setIsSwitchingToEthereum] = useState(false);

  // Initialize selected tokens state from balances
  const [selectedTokens, setSelectedTokens] = useState<SelectedToken[]>([]);
  const [selectedChainTokenPair, setSelectedChainTokenPair] = useState<string | null>(null);

  // Get chain map for displaying chain names
  const chainMap = Object.fromEntries(chains.map((chain) => [chain.id, chain]));

  // Update selected tokens when balances change
  useEffect(() => {
    if (balances.length > 0 && allowances.length > 0 && selectedTokens.length === 0) {
      const tokensList = balances.map((balance) => {
        const availableBal = getAvailableBalance(balance, allowances);
        return {
          ...balance,
          isSelected: availableBal > 0,
          availableBalance: availableBal,
        };
      });

      setSelectedTokens(tokensList);
    }
  }, [balances, allowances, selectedTokens.length, getAvailableBalance]);

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
    setSelectedTokens((current) => {
      return current.map((token) => {
        if (token.chainId === chainId && token.address === tokenAddress) {
          return { ...token, isSelected: !token.isSelected };
        }
        return token;
      });
    });
  };

  const parseSelectedTokenPair = (value: string) => {
    // Parse the selected value to get chainId and tokenAddress
    const [chainId, tokenAddress] = value.split("|");

    if (!chainId || !tokenAddress) throw new Error("Invalid token");

    const chainIdNum = parseInt(chainId);
    const addressHex = tokenAddress as Hex;

    // Find the token in the tokens list
    const selectedConfigToken = tokens.find((token) => token.addresses[chainIdNum] === addressHex);

    if (!selectedConfigToken) throw new Error("Invalid token");

    return { token: selectedConfigToken, chainId: chainIdNum };
  };

  const handleChainTokenPairChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;

    if (value === "") {
      setSelectedChainTokenPair(null);
      return;
    }

    setSelectedChainTokenPair(value);
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

    // Sum up the available balances
    const totalBalance = selectedTokensList.reduce((total, token) => {
      // Use the cached availableBalance or calculate it if not available
      const availableBal =
        token.availableBalance !== undefined
          ? token.availableBalance
          : getAvailableBalance(token, allowances);
      return total + availableBal;
    }, 0n);

    // For simplicity, we'll use 18 decimals (most common in ETH tokens)
    // In a real app, you would handle different token decimals correctly
    const decimals = selectedTokensList[0]?.decimals || 18;
    return formatTokenAmount(totalBalance, decimals);
  };

  // Function to handle calling the Permit3 contract
  const handleExecutePermit3 = async (chainId: number) => {
    if (!permit3Result || !switchNetwork) return;

    try {
      // Get the current chain ID to check if we need to switch networks
      const currentChain = publicClient?.chain?.id;

      // Switch to the correct network if needed
      if (currentChain !== chainId && switchNetwork) {
        console.log(`Switching from chain ${currentChain} to chain ${chainId}`);
        await switchNetwork(chainId);

        // Give a moment for the UI to update after chain switch
        // This helps ensure the publicClient has the new chain when we execute the transaction
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Call the Permit3 contract with the specific chainId
      const hash = await executePermit3(permit3Result, chainId);

      if (hash) {
        // Store the transaction hash for this chain
        setChainTxHashes((prev) => ({
          ...prev,
          [chainId]: hash,
        }));
      }
    } catch (error) {
      console.error(`Error executing Permit3 on chain ${chainId}:`, error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});
    setPermit3Result(null);
    setChainTxHashes({});

    // Validate amount field before continuing
    if (!amount || amount === "" || Number(amount) <= 0) {
      setErrors({ amount: "Amount must be a positive number" });
      return;
    }

    // Validate amount field before continuing
    if (!selectedChainTokenPair) {
      setErrors({ targetToken: "Select a target token" });
      return;
    }

    // Validate amount field before continuing
    if (!quotesData) {
      return;
    }

    // Validate that at least one token is selected
    const selectedTokensList = selectedTokens.filter((t) => t.isSelected);
    if (selectedTokensList.length === 0) {
      setErrors({ selectedTokens: "No tokens selected for transfer" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure we're on Ethereum mainnet for sending tokens
      const currentChain = publicClient?.chain?.id;
      if (currentChain !== mainnet.id && switchNetwork) {
        console.log(`Switching from chain ${currentChain} to Ethereum mainnet (${mainnet.id})`);
        try {
          setIsSwitchingToEthereum(true);
          await switchNetwork(mainnet.id);
          // Give a moment for the UI to update after chain switch
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (switchError) {
          console.error("Error switching to Ethereum mainnet:", switchError);
          setErrors({
            form: "Failed to switch to Ethereum mainnet. Please switch manually and try again.",
          });
          setIsSubmitting(false);
          setIsSwitchingToEthereum(false);
          return;
        } finally {
          setIsSwitchingToEthereum(false);
        }
      }

      // Get available balance for validation
      const availableBalance = getTotalAvailableBalance();

      // Validate form data using Zod
      sendFormSchema.parse({
        recipient: recipient || address || "",
        amount,
        selectedTokens: selectedTokensList,
        availableBalance,
      });

      const permit3SendRequests = quotesData.tokens.map(async ({ token, amount }) => {
        const quote = quotesData.quotes.find(
          (quote) => quote.token.address === token.address && quote.token.chainId === token.chainId,
        );

        if (!quote) {
          // Transfer funds directly to recipient
          return { token, amount, recipient: recipient as Hex };
        }

        const { intent } = quote;

        const { IntentSource: intentSourceAddr } =
          EcoProtocolAddresses[publicClient.chain.id.toString() as EcoChainIds];
        const vaultAddr = await publicClient.readContract({
          abi: intentSourceAbi,
          address: intentSourceAddr,
          functionName: "intentVaultAddress",
          args: [intent],
        });

        return { token, amount, recipient: vaultAddr };
      });

      const permit3Send = await Promise.all(permit3SendRequests);

      // Generate Permit3 signature for this chain and tokens using available balances
      const result = await generatePermit3Signature(permit3Send);

      if (!result) {
        setErrors({ form: "Failed to generate Permit3 signature" });
        setIsSubmitting(false);
        return;
      }

      // Store the result and log (in a real app, you would submit this to your backend or smart contract)
      setPermit3Result(result);

      // Log the transaction details and signature
      console.log("Transaction prepared with Permit3 signature:", {
        tokens: selectedTokensList.map((t) => ({
          chainId: t.chainId,
          chainName: chainMap[t.chainId]?.name,
          tokenSymbol: t.tokenSymbol,
          address: t.address,
          amount: t.balance.toString(),
        })),
        recipient: recipient,
        signature: result.signature,
        deadline: result.deadline.toString(),
        permitsByChain: result.permitsByChain,
      });

      const intents = quotesData.quotes.map((quote) => quote.intent);
      sendToExecuteEndpoint({ permit3Result: result, intents });

      // In a real app, you would now submit this data to your backend or directly to a smart contract
      // that uses the Permit3 contract for approving and transferring tokens
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
        console.error("Submission error:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const {
    data: quotesData,
    isLoading: areQuotesLoading,
    error: quotesError,
  } = useQuery({
    queryKey: [
      "quote",
      selectedChainTokenPair,
      amount,
      ...selectedTokens.map((token) => `${token.chainId}-${token.address}`),
    ],
    queryFn: async () => {
      if (!selectedChainTokenPair || !address || !recipient || !selectedChainTokenPair || !amount) {
        throw new Error("Invalid data");
      }

      const target = parseSelectedTokenPair(selectedChainTokenPair);

      const amountBig = parseUnits(amount, target.token.decimals);

      const { tokens, remaining } = selectedTokens
        .sort((tokenA, tokenB) => {
          if (tokenA.chainId !== tokenB.chainId) {
            if (tokenA.chainId === target.chainId) return -1;
            if (tokenB.chainId === target.chainId) return 1;
          }
          return tokenA.balance > tokenB.balance ? -1 : 1;
        })
        .reduce<{
          remaining: bigint;
          tokens: { token: TokenBalance; amount: bigint }[];
        }>(
          (acc, token) => {
            if (acc.remaining === 0n || !token.availableBalance || token.availableBalance <= 0n)
              return acc;
            const tokenAmount =
              token.availableBalance >= acc.remaining ? acc.remaining : token.availableBalance;

            return {
              remaining: acc.remaining - tokenAmount,
              tokens: [...acc.tokens, { token, amount: tokenAmount }],
            };
          },
          { remaining: amountBig, tokens: [] },
        );

      if (remaining > 0n) {
        throw new Error("Not enough funds");
      }

      const openQuotingClient = new OpenQuotingClient({
        dAppID: "root-app",
        customBaseUrl: process.env.NEXT_PUBLIC_OPEN_QUOTING_CLIENT_URL,
      });

      const routesService = new RoutesService({
        isPreprod: process.env.NEXT_PUBLIC_ROUTES_ENV === "preprod",
      });

      // Note: Since Eco routes doesn't support multi-token intents, we need to create an intent per token
      const quoteTokens = tokens.filter((token) => token.token.chainId !== target.chainId);
      const quoteRequests = quoteTokens.map(async ({ token, amount }) => {
        const preflightIntentParams: CreateSimpleIntentParams = {
          creator: address,
          amount,
          recipient: recipient as Hex,
          spendingToken: token.address,
          originChainID: token.chainId as RoutesSupportedChainId,
          destinationChainID: target.chainId as RoutesSupportedChainId,
          receivingToken: target.token.addresses[target.chainId],
          spendingTokenLimit: BigInt(Number.MAX_VALUE),
        };

        const preflightIntent = routesService.createSimpleIntent(preflightIntentParams);

        const quotes = await openQuotingClient.requestQuotesForIntent(preflightIntent);
        const quote = selectCheapestQuote(quotes);

        // TODO: Not the correct way to get the amount out. Currently, the amount passed in
        //  the quote returns the amount needed to be sent. Instead, we want to get the
        //  amount of tokens receiving by sending X amount.
        const amountOut = 2n * amount - BigInt(quote.quoteData.tokens[0].amount);

        const intent = routesService.createSimpleIntent({
          ...preflightIntentParams,
          spendingTokenLimit: amount,
          amount: amountOut,
        });

        return { intent, quote: quote.quoteData, token, amountOut };
      });

      const quotes = await Promise.all(quoteRequests);

      const nonQuoteTokens = tokens.filter((token) => !quoteTokens.includes(token));
      const nonQuoteAmount = nonQuoteTokens.reduce((acc, token) => acc + token.amount, 0n);
      const quotesAmount = quotes.reduce((acc, token) => acc + BigInt(token.amountOut), 0n);

      return { tokens, target, quotes, nonQuoteTokens, amount: quotesAmount + nonQuoteAmount };
    },
    enabled: Boolean(selectedChainTokenPair && amount && selectedTokens.length),
  });

  if (!isConnected) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-xl bg-white dark:bg-gray-800 shadow-md text-center">
        <p className="text-gray-600 dark:text-gray-300">
          Connect your wallet to use the send interface
        </p>
      </div>
    );
  }

  console.log({ quotesData });

  return (
    <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Network check info - only show when not on Ethereum */}
        {publicClient?.chain?.id !== mainnet.id && (
          <div className="p-3 mb-2 text-sm text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 rounded-md">
            Note: You will be switched to Ethereum network when sending tokens.
          </div>
        )}
        {errors.form && (
          <div className="p-3 mb-2 text-sm text-red-600 bg-red-100 rounded-md">{errors.form}</div>
        )}
        {errors.selectedTokens && (
          <div className="p-3 mb-2 text-sm text-red-600 bg-red-100 rounded-md">
            {errors.selectedTokens}
          </div>
        )}
        {/* Chain-Token Pair Selector */}
        <div className="space-y-2 mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Target token
          </label>
          <select
            value={selectedChainTokenPair || ""}
            onChange={handleChainTokenPairChange}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a token</option>
            {tokens.flatMap((token) =>
              // For each token, create options for each chain it's available on
              Object.entries(token.addresses).map(([chainId, address]) => {
                const chainIdNum = Number(chainId);
                const chainInfo = chainMap[chainIdNum];

                if (!chainInfo) return null;

                return (
                  <option key={`${chainIdNum}-${address}`} value={`${chainIdNum}|${address}`}>
                    {token.symbol} on {chainInfo.name}
                  </option>
                );
              }),
            )}
          </select>
          {errors.targetToken && <p className="mt-1 text-sm text-red-600">{errors.targetToken}</p>}
        </div>

        {/* Tokens to Send Section */}
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
              Advanced Selection
            </button>
          </div>

          <div className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
            {isLoading || allowancesLoading ? (
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
          {!isLoading &&
            !allowancesLoading &&
            selectedTokens.filter((t) => t.isSelected).length > 0 && (
              <div className="mt-2 text-sm flex justify-between">
                <p className="text-gray-500 dark:text-gray-400">Available balance:</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {getTotalAvailableBalance()}
                </p>
              </div>
            )}
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

        {/* Display quote amount before the send button */}
        {amount && selectedChainTokenPair && (
          <div className="mb-4">
            {areQuotesLoading ? (
              <div className="flex items-center justify-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-gray-700 dark:text-gray-300">
                  Calculating amount to receive...
                </span>
              </div>
            ) : quotesError ? (
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-200">
                  {quotesError instanceof Error ? quotesError.message : "Error calculating quote"}
                </p>
              </div>
            ) : quotesData ? (
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You will receive approximately:
                </p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {(() => {
                    // Get target token decimals
                    const targetPair = parseSelectedTokenPair(selectedChainTokenPair);
                    return formatTokenAmount(quotesData.amount, targetPair.token.decimals);
                  })()}{" "}
                  {parseSelectedTokenPair(selectedChainTokenPair).token.symbol}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            isPermit3Loading ||
            allowancesLoading ||
            isSwitchingToEthereum ||
            !recipient ||
            !amount ||
            !quotesData ||
            Number(amount) <= 0 ||
            selectedTokens.filter((t) => t.isSelected).length === 0
          }
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isSwitchingToEthereum
            ? "Switching to Ethereum..."
            : isSubmitting || isPermit3Loading
              ? "Signing Permit3..."
              : permit3Result
                ? "✓ Signature Generated"
                : `Send ${getTotalSelectedBalance()}`}
        </button>

        {/* Show Permit3 signature result if available */}
        {permit3Result && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
            <h3 className="text-sm font-medium mb-1">Permit3 Signature Generated</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Signature generated for {selectedTokens.filter((t) => t.isSelected).length} token(s).
              This signature can be used with the Permit3 contract to approve and transfer tokens.
            </p>

            {/* Chain Action Buttons */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                Execute on Chain:
              </p>

              <div className="flex flex-wrap gap-2">
                {/* Get unique chainIds from the selected tokens */}
                {Array.from(
                  new Set(
                    selectedTokens
                      .filter((t) => t.isSelected && t.balance > 0n)
                      .map((t) => t.chainId),
                  ),
                )
                  .filter((chainId) => PERMIT3_ADDRESSES[chainId]) // Only show chains with Permit3 contract
                  .map((chainId) => {
                    const chainInfo = chains.find((c) => c.id === chainId);
                    const txHash = chainTxHashes[chainId];
                    const isLoading = isPermit3TxLoading && permit3Result.chainId === chainId;

                    return (
                      <div key={chainId} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleExecutePermit3(chainId);
                          }}
                          disabled={isLoading || isSwitchingNetwork || !!txHash}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-center min-w-24 ${
                            txHash
                              ? "bg-green-600 text-white"
                              : isLoading || isSwitchingNetwork
                                ? "bg-gray-400 text-white"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {txHash ? (
                            <span>✓ Success</span>
                          ) : isLoading ? (
                            <span>Submitting...</span>
                          ) : isSwitchingNetwork ? (
                            <span>Switching...</span>
                          ) : (
                            <span>Execute on {chainInfo?.name || `Chain ${chainId}`}</span>
                          )}
                        </button>

                        {txHash && (
                          <a
                            href={`${chainInfo?.blockExplorers?.default.url || "#"}/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 mt-1 hover:underline"
                          >
                            View Transaction
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Copy button and feedback */}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  // Create a JSON string with all relevant data
                  const dataToCopy = JSON.stringify(
                    {
                      signature: permit3Result.signature,
                      deadline: permit3Result.deadline.toString(),
                      chainId: permit3Result.chainId,
                      owner: permit3Result.owner,
                      salt: permit3Result.salt,
                      timestamp: permit3Result.timestamp,
                    },
                    null,
                    2,
                  );

                  // Copy to clipboard
                  navigator.clipboard
                    .writeText(dataToCopy)
                    .then(() => {
                      setShowCopiedMessage(true);
                      setTimeout(() => setShowCopiedMessage(false), 2000);
                    })
                    .catch((err) => console.error("Failed to copy: ", err));
                }}
                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
              >
                <span>Copy All Data</span>
                {showCopiedMessage && (
                  <span className="ml-2 text-xs bg-white text-blue-600 px-1 rounded">
                    ✓ Copied!
                  </span>
                )}
              </button>
            </div>

            {/* Signature data */}
            <div className="space-y-3">
              {/* Signature */}
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Signature:</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowFullSignature(!showFullSignature);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showFullSignature ? "Show Less" : "Show Full"}
                  </button>
                </div>
                <p className="text-xs break-all font-mono bg-gray-200 dark:bg-gray-800 p-2 rounded">
                  {showFullSignature
                    ? permit3Result.signature
                    : `${permit3Result.signature.substring(0, 40)}...`}
                </p>
              </div>

              {/* Other Permit3 data */}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Permit3 Data:
                </p>
                <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-500 dark:text-gray-400">Salt:</span>
                    <span className="break-all">
                      {showFullSignature
                        ? permit3Result.salt
                        : `${permit3Result.salt.substring(0, 10)}...`}
                    </span>

                    <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                    <span>{new Date(permit3Result.timestamp * 1000).toLocaleString()}</span>

                    <span className="text-gray-500 dark:text-gray-400">Deadline:</span>
                    <span>{new Date(Number(permit3Result.deadline) * 1000).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Token Allowances */}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Token Allowances:
                </p>
                <div className="bg-gray-200 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead>
                      <tr className="bg-gray-300 dark:bg-gray-700">
                        <th className="py-1 px-2 text-left">Token</th>
                        <th className="py-1 px-2 text-left">Recipient</th>
                        <th className="py-1 px-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(permit3Result.permitsByChain)
                        .flat()
                        .map((allowance, index) => {
                          // Find the matching token to show symbol and format amount
                          const matchingToken = selectedTokens.find(
                            (t) =>
                              t.isSelected &&
                              t.address.toLowerCase() === allowance.token.toLowerCase(),
                          );
                          return (
                            <tr
                              key={index}
                              className="border-t border-gray-300 dark:border-gray-700"
                            >
                              <td className="py-1 px-2 font-medium">
                                {matchingToken?.tokenSymbol || "Unknown"}
                              </td>
                              <td className="py-1 px-2">
                                {allowance.account.substring(0, 6)}...
                                {allowance.account.substring(38)}
                              </td>
                              <td className="py-1 px-2 text-right">
                                {matchingToken
                                  ? formatTokenAmount(allowance.amountDelta, matchingToken.decimals)
                                  : allowance.amountDelta.toString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
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
              {balances.map((token) => {
                // Calculate available balance for this token
                const availableBal = getAvailableBalance(token, allowances);
                const isSelected = selectedTokens.find(
                  (selectToken) =>
                    isAddressEqual(token.address, selectToken.address) &&
                    token.chainId === selectToken.chainId,
                )?.isSelected;

                // Determine if the token is disabled
                const isDisabled = availableBal === 0n;

                return (
                  <div
                    key={`${token.chainId}-${token.address}`}
                    className={`flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-md ${
                      isDisabled ? "opacity-70" : ""
                    }`}
                  >
                    <label
                      className={`flex items-center space-x-3 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTokenSelectionChange(token.chainId, token.address)}
                        disabled={isDisabled}
                        className={`h-4 w-4 border-gray-300 rounded ${
                          isDisabled
                            ? "text-gray-400 focus:ring-gray-400 cursor-not-allowed"
                            : "text-blue-600 focus:ring-blue-500"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span
                          className={`${isDisabled ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
                        >
                          {token.tokenSymbol}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {chainMap[token.chainId]?.name}
                        </span>
                      </div>
                    </label>
                    <div className="flex flex-col items-end">
                      <span
                        className={`${isDisabled ? "text-gray-500" : "text-gray-700 dark:text-gray-300"} font-medium`}
                      >
                        {formatTokenAmount(availableBal, token.decimals)}
                      </span>
                      {availableBal !== token.balance && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTokenAmount(token.balance, token.decimals)} total
                        </span>
                      )}
                      {isDisabled && (
                        <span className="text-xs text-red-500 mt-1">No allowance</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => {
                  // Update the selectedChainTokenPair based on what's selected
                  const selected = selectedTokens.find((t) => t.isSelected);
                  if (selected) {
                    setSelectedChainTokenPair(`${selected.chainId}|${selected.address}`);
                  } else {
                    setSelectedChainTokenPair(null);
                  }
                  setShowTokenSelector(false);
                }}
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
