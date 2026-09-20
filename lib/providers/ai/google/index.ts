// ==============================================================================
// BABATA LENS — GOOGLE GEMINI AI ADAPTER
// ==============================================================================

import {
  AIProvider,
  AgentInput,
  AgentOutput,
  ProviderHealthReport,
  ToolCallRequest,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";

export class GoogleAIProvider implements AIProvider {
  id = "google";
  name = "Google AI (Gemini)";
  capability = "ai" as const;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  isConfigured(): boolean {
    return hasCredential("GOOGLE_AI_API_KEY");
  }

  async checkHealth(): Promise<ProviderHealthReport> {
    const startTime = Date.now();
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        capability: this.capability,
        status: "configured",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: "Credentials not configured.",
      };
    }

    try {
      const env = getEnv();
      const res = await fetch(
        `${this.baseUrl}/models?key=${env.GOOGLE_AI_API_KEY}`,
        { method: "GET" }
      );
      const latency = Date.now() - startTime;
      if (res.ok) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "connected",
          lastSuccessAt: new Date().toISOString(),
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
        };
      } else if (res.status === 401 || res.status === 403) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "invalid",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: `Authentication failed (${res.status})`,
        };
      } else {
        return {
          provider: this.id,
          capability: this.capability,
          status: "degraded",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: `Status code: ${res.status}`,
        };
      }
    } catch (err: unknown) {
      return {
        provider: this.id,
        capability: this.capability,
        status: "unavailable",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async generateResponse(input: AgentInput): Promise<AgentOutput> {
    const env = getEnv();
    if (!env.GOOGLE_AI_API_KEY) {
      throw new Error("[GoogleAIProvider] Missing GOOGLE_AI_API_KEY");
    }

    const modelName =
      input.modelTier === "complex" ? "gemini-1.5-pro" : "gemini-1.5-flash";
    const startTime = Date.now();

    // Map messages to Gemini contents format
    const contents = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemMessage = input.messages.find((m) => m.role === "system");

    const body: Record<string, unknown> = {
      contents,
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    const res = await fetch(
      `${this.baseUrl}/models/${modelName}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const latency = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Gemini API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const firstPart = json.candidates?.[0]?.content?.parts?.[0];
    const text = firstPart?.text || "";

    const toolCalls: ToolCallRequest[] = [];
    if (firstPart?.functionCall) {
      toolCalls.push({
        id: `call_${Date.now()}`,
        name: firstPart.functionCall.name,
        arguments: firstPart.functionCall.args || {},
      });
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: json.usageMetadata
        ? {
            promptTokens: json.usageMetadata.promptTokenCount || 0,
            completionTokens: json.usageMetadata.candidatesTokenCount || 0,
            totalTokens: json.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      model: modelName,
      source: {
        provider: this.id,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }
}
