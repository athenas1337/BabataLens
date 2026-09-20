import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orchestrator } from "@/lib/agent/orchestrator";
import { AgentMessage } from "@/lib/providers/interfaces";

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const messages = parsed.data.messages as AgentMessage[];
    const result = await orchestrator.handleMessage(messages);

    return NextResponse.json({
      success: true,
      message: {
        role: "assistant",
        content: result.text,
      },
      toolResults: result.toolResults,
      sources: result.sources,
      model: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[API/chat] Error:", err);
    return NextResponse.json(
      {
        error: "Internal agent error",
        message: err instanceof Error ? err.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
