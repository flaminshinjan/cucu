import { NextResponse } from "next/server";
import { getRun, loadRunFromDisk } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { id: string } }) {
  const state = getRun(context.params.id);
  if (state) {
    return NextResponse.json({ run: state.run });
  }
  const disk = await loadRunFromDisk(context.params.id);
  if (disk) return NextResponse.json({ run: disk });
  return NextResponse.json({ error: "Unknown run" }, { status: 404 });
}
