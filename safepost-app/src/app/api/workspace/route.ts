import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";

export const runtime = "nodejs";

type WorkspaceRequest = {
  workspaceId?: string;
  userEmail?: string;
  profile?: { name: string; email: string; phone?: string; role: string; region: string; apiKey: string };
  post?: { title: string; body: string; platform: string; status: string; score?: number };
  postId?: string;
  score?: number;
};

function getWorkspaceId(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function GET(request: Request) {
  const workspaceId = getWorkspaceId(new URL(request.url).searchParams.get("workspaceId"));
  if (!workspaceId) return NextResponse.json({ error: "A workspace is required." }, { status: 400 });

  try {
    const database = await getMongoDb();
    const [profile, posts] = await Promise.all([
      database.collection("profiles").findOne({ workspaceId }, { projection: { _id: 0, workspaceId: 0 } }),
      database.collection("posts").find({ workspaceId }).sort({ createdAt: -1 }).project({ workspaceId: 0 }).toArray(),
    ]);
    return NextResponse.json({ profile, posts });
  } catch {
    return NextResponse.json({ error: "MongoDB is unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as WorkspaceRequest;
  const workspaceId = getWorkspaceId(body.workspaceId);
  if (!workspaceId || !body.profile) return NextResponse.json({ error: "Workspace and profile are required." }, { status: 400 });

  try {
    const database = await getMongoDb();
    const userEmail = body.userEmail || (body.profile.email ? body.profile.email.toLowerCase().trim() : undefined);
    await database.collection("profiles").updateOne(
      { workspaceId },
      { $set: { ...body.profile, workspaceId, userEmail, updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "MongoDB is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as WorkspaceRequest;
  const workspaceId = getWorkspaceId(body.workspaceId);
  if (!workspaceId || !body.post?.body?.trim()) return NextResponse.json({ error: "Workspace and post body are required." }, { status: 400 });

  try {
    const database = await getMongoDb();
    const userEmail = body.userEmail || (workspaceId.startsWith("user:") ? workspaceId.replace(/^user:/, "") : undefined);
    const post = { ...body.post, workspaceId, userEmail, createdAt: new Date() };
    const result = await database.collection("posts").insertOne(post);
    return NextResponse.json({ post: { ...body.post, id: result.insertedId.toString() } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "MongoDB is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as WorkspaceRequest;
  const workspaceId = getWorkspaceId(body.workspaceId);
  if (!workspaceId || !body.postId) return NextResponse.json({ error: "A valid post is required." }, { status: 400 });

  try {
    const database = await getMongoDb();
    const filter = ObjectId.isValid(body.postId) ? { _id: new ObjectId(body.postId), workspaceId } : { id: body.postId, workspaceId };
    
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (body.post?.body) updateFields.body = body.post.body;
    if (body.post?.status) updateFields.status = body.post.status;
    if (body.score !== undefined) updateFields.score = body.score;
    if (!body.post && body.score !== undefined) {
      updateFields.status = "Ready to publish";
    }

    await database.collection("posts").updateOne(
      filter,
      { $set: updateFields },
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "MongoDB is unavailable." }, { status: 503 });
  }
}