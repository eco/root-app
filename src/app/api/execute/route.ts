import { NextRequest, NextResponse } from "next/server";
import { replaceBigInts } from "@/utils/json";

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body from the request
    const body = await req.json();

    // Process the body to convert any BigInt values to strings
    const processedBody = replaceBigInts(body);

    // Log the received data (in a production environment, you might want to log this to a secure location)
    console.log("Received data in execute endpoint:", JSON.stringify(processedBody, null, 2));

    // Return a success response
    return NextResponse.json({
      success: true,
      message: "Data received successfully",
      data: processedBody,
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
