"use client";

import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useAccount, usePublicClient, useWalletClient, useSwitchNetwork } from "wagmi";
import { formatTokenAmount } from "@/utils/format";
import { PERMIT3_ADDRESSES } from "@/hooks/usePermit3";
import { TokenAllowance } from "@/hooks/useTokenAllowances";
import { chains } from "@/config/chains";

// ERC20 ABI for approvals
const erc20ApprovalAbi = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface AllowanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAllowance: TokenAllowance | null;
  onSuccess: () => void;
}

export function AllowanceDialog({
  isOpen,
  onClose,
  tokenAllowance,
  onSuccess,
}: AllowanceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchNetwork } = useSwitchNetwork();

  if (!tokenAllowance) return null;

  // Get chain name for display
  const chainName =
    chains.find((chain) => chain.id === tokenAllowance.chainId)?.name ||
    `Chain ${tokenAllowance.chainId}`;

  const handleNetworkSwitch = async () => {
    if (!switchNetwork) {
      setError("Network switching not supported by your wallet");
      return false;
    }

    try {
      setIsSwitchingNetwork(true);
      await switchNetwork(tokenAllowance.chainId);
      // Wait a moment for the network switch to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsSwitchingNetwork(false);
      return true;
    } catch (err) {
      console.error("Error switching network:", err);
      setError("Failed to switch network. Please try manually.");
      setIsSwitchingNetwork(false);
      return false;
    }
  };

  const handleSetAllowance = async (amount: bigint) => {
    if (!address || !walletClient || !publicClient) {
      setError("Wallet not connected");
      return;
    }

    const permit3Address = PERMIT3_ADDRESSES[tokenAllowance.chainId];
    if (!permit3Address) {
      setError(`Permit3 contract not available for chain ID ${tokenAllowance.chainId}`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Verify chain matches
      const currentChainId = publicClient.chain?.id;
      if (currentChainId !== tokenAllowance.chainId) {
        // If chain doesn't match, prompt for network switch
        const networkSwitchMsg = `This token is on ${chainName}, but you're connected to a different network.`;

        // Set informational error
        setError(`${networkSwitchMsg} Please switch networks and try again.`);

        // Attempt to switch network
        const switched = await handleNetworkSwitch();
        if (!switched) {
          return; // Network switch failed or was rejected
        }

        // Update the error to indicate the user needs to click again
        setError(
          `Successfully switched to ${chainName}. Please click the button again to continue.`,
        );
        setIsLoading(false);
        return; // Exit early, requiring user to click button again
      }

      // Simulate the transaction to check for errors
      await publicClient.simulateContract({
        address: tokenAllowance.address,
        abi: erc20ApprovalAbi,
        functionName: "approve",
        args: [permit3Address, amount],
        account: address,
      });

      // If simulation passed, send the transaction
      const hash = await walletClient.writeContract({
        address: tokenAllowance.address,
        abi: erc20ApprovalAbi,
        functionName: "approve",
        args: [permit3Address, amount],
      });

      // Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error setting allowance:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Max uint256 value for infinite approval
  const infiniteAmount = 2n ** 256n - 1n;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                >
                  {tokenAllowance.tokenSymbol} Allowance Settings
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Set the amount of {tokenAllowance.tokenSymbol} that the Permit3 contract is
                    allowed to access.
                  </p>

                  <div className="mt-3 flex flex-col space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Current allowance:{" "}
                      {formatTokenAmount(tokenAllowance.allowance, tokenAllowance.decimals)}{" "}
                      {tokenAllowance.tokenSymbol}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Network: {chainName}</p>
                  </div>

                  {error && (
                    <div className="mt-4 p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 flex space-x-4">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 dark:bg-blue-900 px-4 py-2 text-sm font-medium text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleSetAllowance(infiniteAmount)}
                      disabled={isLoading || isSwitchingNetwork}
                    >
                      {isLoading
                        ? "Processing..."
                        : isSwitchingNetwork
                          ? "Switching Network..."
                          : "Infinite Approval"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-100 dark:bg-red-900 px-4 py-2 text-sm font-medium text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleSetAllowance(0n)}
                      disabled={isLoading || isSwitchingNetwork}
                    >
                      {isLoading
                        ? "Processing..."
                        : isSwitchingNetwork
                          ? "Switching Network..."
                          : "Revoke Approval"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                    disabled={isLoading || isSwitchingNetwork}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
