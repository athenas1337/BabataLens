import { NextRequest, NextResponse } from "next/server";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory conversation store for single-user session
const conversations: Conversation[] = [
  {
    id: "conv_default",
    title: "Market & Wallet Analysis",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function GET() {
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: body.title || "New Investigation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    conversations.unshift(newConv);
    return NextResponse.json(newConv, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 400 });
  }
}
