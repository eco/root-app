import { NextRequest, NextResponse } from "next/server";
import { restoreBigInts } from "@/utils/json";
import { z } from "zod";
import { createWalletClient, encodeFunctionData, extractChain, Hex, parseAbi } from "viem";
import { chains } from "@/config/chains";
import {
  createUnhingedProofFromAllLeaves,
  encodeChainAllowances,
} from "@/utils/createUnhingedProof";
import { permit3Abi } from "@/abis/permit3";
import { Permit3SignatureResult } from "@/types/permit3";
import { privateKeyToAccount } from "viem/accounts";
import _ from "lodash";
import { EcoChainIds, EcoProtocolAddresses, IntentType } from "@eco-foundation/routes-ts";
import { intentSourceAbi } from "@/abis/intentSource";
import { keyManagerRpc } from "@/utils/keyManagerRpc";
import { PERMIT3_ADDRESSES } from "@/config/contracts";

// Define schema for AllowanceOrTransfer
const allowanceOrTransferSchema = z.object({
  modeOrExpiration: z.number(),
  token: z.string(),
  account: z.string(),
  amountDelta: z.bigint(),
});

// Define schema for Permit3SignatureResult
const permit3SignatureResultSchema = z.object({
  signature: z.string(),
  deadline: z.bigint(),
  chainId: z.number(),
  leafs: z.array(z.string()),
  owner: z.string(),
  salt: z.string(),
  timestamp: z.number(),
  permitsByChain: z.record(z.string(), z.array(allowanceOrTransferSchema)),
});

// Define schema for the entire request
const executeRequestSchema = z.object({
  permit3Result: permit3SignatureResultSchema,
  intents: z.array(z.any()),
});

const privateKey = process.env.WALLET_PRIVATE_KEY as Hex;
if (!privateKey) throw new Error("Private key required");

const multicall3Abi = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory returnData)",
]);

const handleExecutePermit3 = async (
  chainId: number,
  permit3Result: Permit3SignatureResult,
  intents: IntentType[],
) => {
  const chain = extractChain({ chains, id: chainId as (typeof chains)[number]["id"] });

  const walletClient = createWalletClient({
    chain,
    transport: keyManagerRpc(),
    account: privateKeyToAccount(privateKey),
  });

  // Get the Permit3 contract address for the chain
  const permit3Address = PERMIT3_ADDRESSES[chainId];
  if (!permit3Address) {
    throw new Error(`Permit3 contract not available for chain ID ${chainId}`);
  }

  const chainPermits = permit3Result.permitsByChain[chainId];

  // Get the permits for this specific chain
  if (chainPermits.length === 0) {
    throw new Error(`No token permits found for chain ID ${chainId}`);
  }

  const chainSpecificPermits = {
    chainId: BigInt(chainId),
    permits: chainPermits,
  };

  const leaf = encodeChainAllowances(chainSpecificPermits.chainId, chainSpecificPermits.permits);

  const targetLeafIndex = permit3Result.leafs.indexOf(leaf);

  const { proof: unhingedProof, root: unhingedRoot } = createUnhingedProofFromAllLeaves(
    permit3Result.leafs,
    targetLeafIndex,
  );

  console.log({ unhingedProof, unhingedRoot, targetLeafIndex, leaf });

  // Create a chain-specific unhinged proof structure
  const chainSpecificProof: {
    permits: { chainId: bigint; permits: typeof chainSpecificPermits.permits };
    unhingedProof: { nodes: Hex[]; counts: Hex };
  } = {
    permits: chainSpecificPermits,
    unhingedProof: {
      nodes: unhingedProof.nodes,
      counts: unhingedProof.counts,
    },
  };

  // Simulate the transaction to check for potential errors
  const permitData = encodeFunctionData({
    abi: permit3Abi,
    functionName: "permit",
    args: [
      permit3Result.owner,
      permit3Result.salt,
      permit3Result.deadline,
      permit3Result.timestamp,
      chainSpecificProof,
      permit3Result.signature as Hex,
    ],
  });

  const permit3Tx = { data: permitData, to: permit3Address };

  console.log("Permit transaction", permit3Tx);

  const { IntentSource: intentSourceAddr } =
    EcoProtocolAddresses[chainId.toString() as EcoChainIds];

  const createIntentTxs = intents.map((intent) => {
    const publishAndFundData = encodeFunctionData({
      abi: intentSourceAbi,
      functionName: "publishAndFund",
      args: [intent, false],
    });

    return { to: intentSourceAddr, data: publishAndFundData };
  });

  const txs = [permit3Tx, ...createIntentTxs];

  const multicall3Data = encodeFunctionData({
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [txs.map((tx) => ({ target: tx.to, allowFailure: false, callData: tx.data }))],
  });

  return walletClient.sendTransaction({
    to: chain.contracts.multicall3.address,
    data: multicall3Data,
  });
};

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body from the request
    const body = await req.json();

    // Restore BigInt values from their serialized representation
    const restoredBody = restoreBigInts(body);

    // Log the received data (in a production environment, you might want to log this to a secure location)
    console.log("Received data in execute endpoint:", JSON.stringify(body, null, 2));

    // Validate the request body against the schema
    const validatedData = executeRequestSchema.parse(restoredBody);

    const intentsPerChain = _.groupBy(validatedData.intents as IntentType[], (intent) =>
      Number(intent.route.source),
    );

    const chainIDs = Object.keys(validatedData.permit3Result.permitsByChain);

    const executeRequests = chainIDs.map((_chainId) => {
      const chainId = parseInt(_chainId);
      return handleExecutePermit3(
        chainId,
        validatedData.permit3Result as Permit3SignatureResult,
        intentsPerChain[chainId] || [],
      );
    });

    const executeTransactionHashes = await Promise.all(executeRequests);
    const chainTxs = _.zipObject(chainIDs, executeTransactionHashes);

    // Return a success response
    return NextResponse.json({
      success: true,
      message: "Transactions executed successfully",
      data: { chainTxs },
    });
  } catch (error) {
    console.error("Error processing execute request:", error);

    // Return a more specific error for validation failures
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        },
        { status: 400 },
      );
    }

    // Return a generic error response for other errors
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 },
    );
  }
}
