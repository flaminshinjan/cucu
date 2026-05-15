import { NextResponse } from "next/server";
import { EXAMPLE_BRIEFS } from "@/lib/personas";
import { capabilities } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ examples: EXAMPLE_BRIEFS, capabilities });
}
