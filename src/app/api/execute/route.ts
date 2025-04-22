import { NextRequest, NextResponse } from "next/server";
import { replaceBigInts, restoreBigInts } from "@/utils/json";

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body from the request
    const body = await req.json();

    // Restore BigInt values from their serialized representation
    const restoredBody = restoreBigInts(body);

    // For logging, we need to convert BigInt values to a serialized format
    const processedForLogging = replaceBigInts(restoredBody);

    // Log the received data (in a production environment, you might want to log this to a secure location)
    console.log("Received data in execute endpoint:", JSON.stringify(processedForLogging, null, 2));

    // Return a success response
    return NextResponse.json({
      success: true,
      message: "Data received successfully",
      data: processedForLogging,
    });
  } catch (error) {
    console.error("Error processing execute request:", error);

    // Return an error response
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 },
    );
  }
}
