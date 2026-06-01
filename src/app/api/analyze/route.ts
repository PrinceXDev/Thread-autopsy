import { NextResponse } from "next/server";
import { runFullAnalysis } from "@/lib/analyzers";
import type { ThreadData } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body: ThreadData = await request.json();

    if (
      !body.tweets ||
      !Array.isArray(body.tweets) ||
      body.tweets.length === 0
    ) {
      return NextResponse.json(
        { error: "No tweets provided for analysis" },
        { status: 400 },
      );
    }

    const result = runFullAnalysis(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
