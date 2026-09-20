// ==============================================================================
// BABATA LENS — ANTHROPIC CLAUDE AI ADAPTER
// ==============================================================================

import {
  AIProvider,
  AgentInput,
  AgentOutput,
  ProviderHealthReport,
  ToolCallRequest,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";

export class AnthropicAIProvider implements AIProvider {
  id = "anthropic";
  name = "Anthropic Claude";
  capability = "ai" as const;
  private baseUrl = "https://api.anthropic.com/v1";

  isConfigured(): boolean {
    return hasCredential("ANTHROPIC_API_KEY");
  }

  async checkHealth(): Promise<ProviderHealthReport> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        capability: this.capability,
        status: "configured",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: "Credentials not configured.",
      };
    }

    const startTime = Date.now();
    try {
      const env = getEnv();
      // Probe with minimal token check
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

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
      } else if (res.status === 401) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "invalid",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "Invalid Anthropic API Key",
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
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("[AnthropicAIProvider] Missing ANTHROPIC_API_KEY");
    }

    const modelName =
      input.modelTier === "complex"
        ? "claude-3-5-sonnet-latest"
        : "claude-3-5-haiku-latest";
    const startTime = Date.now();

    const systemMessage = input.messages.find((m) => m.role === "system")?.content;
    const conversationMessages = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 2048,
        system: systemMessage,
        messages: conversationMessages,
      }),
    });

    const latency = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    let text = "";
    const toolCalls: ToolCallRequest[] = [];

    if (json.content) {
      for (const block of json.content) {
        if (block.type === "text" && block.text) {
          text += block.text;
        } else if (block.type === "tool_use" && block.name) {
          toolCalls.push({
            id: block.id || `call_${Date.now()}`,
            name: block.name,
            arguments: block.input || {},
          });
        }
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
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
