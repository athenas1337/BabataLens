// ==============================================================================
// BABATA LENS — OPENROUTER AI ADAPTER
// ==============================================================================

import {
  AIProvider,
  AgentInput,
  AgentOutput,
  ProviderHealthReport,
  ToolCallRequest,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";

export class OpenRouterAIProvider implements AIProvider {
  id = "openrouter";
  name = "OpenRouter";
  capability = "ai" as const;
  private baseUrl = "https://openrouter.ai/api/v1";

  isConfigured(): boolean {
    return hasCredential("OPENROUTER_API_KEY");
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
      const res = await fetch(`${this.baseUrl}/auth/key`, {
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        },
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
          errorMessage: "Invalid OpenRouter API Key",
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
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("[OpenRouterAIProvider] Missing OPENROUTER_API_KEY");
    }

    const modelName =
      input.modelTier === "complex"
        ? "anthropic/claude-3.5-sonnet"
        : "openai/gpt-4o-mini";
    const startTime = Date.now();

    const messages = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://babatalens.local",
        "X-Title": "Babata Lens",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages,
      }),
    });

    const latency = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = json.choices?.[0]?.message;
    const text = choice?.content || "";

    const toolCalls: ToolCallRequest[] = [];
    if (choice?.tool_calls) {
      for (const tc of choice.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          // Keep empty
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        });
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
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
