import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "active", message: "Backend is awake." }, { status: 200 });
}
