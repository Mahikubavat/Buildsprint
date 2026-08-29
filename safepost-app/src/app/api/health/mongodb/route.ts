import { NextResponse } from "next/server";
import { getMongoDb } from "../../../../lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getMongoDb();
    await database.command({ ping: 1 });
    return NextResponse.json({ ok: true, database: database.databaseName });
  } catch {
    return NextResponse.json({ ok: false, error: "MongoDB connection failed." }, { status: 503 });
  }
}