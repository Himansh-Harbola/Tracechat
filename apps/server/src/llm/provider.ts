import { config } from "../config.js";
import type { LlmProvider } from "../types.js";
import { MockProvider } from "./mock-provider.js";
import { OpenAiProvider } from "./openai-provider.js";

export type ProviderId = "mock" | "gemini" | "openai" | "groq";

type ProviderDefinition = {
  baseURL?: string;
  configured: boolean;
  description: string;
  id: ProviderId;
  includeStreamUsage?: boolean;
  key?: string;
  model: string;
  name: string;
};

let activeProviderId: ProviderId = normalizeProviderId(config.llmProvider);

export function getProviderDefinitions(): ProviderDefinition[] {
  return [
    {
      configured: true,
      description: "Local deterministic fallback for demos without external API keys.",
      id: "mock",
      model: "local-mock-model",
      name: "Mock"
    },
    {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      configured: hasKey(config.geminiApiKey),
      description: "Google Gemini through the official OpenAI-compatible endpoint.",
      id: "gemini",
      key: config.geminiApiKey,
      model: config.geminiModel,
      name: "Gemini"
    },
    {
      configured: hasKey(config.openAiApiKey),
      description: "OpenAI Chat Completions through the official OpenAI SDK.",
      id: "openai",
      key: config.openAiApiKey,
      model: config.openAiModel,
      name: "OpenAI"
    },
    {
      baseURL: "https://api.groq.com/openai/v1",
      configured: hasKey(config.groqApiKey),
      description: "Groq low-latency inference through its OpenAI-compatible endpoint.",
      id: "groq",
      includeStreamUsage: false,
      key: config.groqApiKey,
      model: config.groqModel,
      name: "Groq"
    }
  ];
}

export function getActiveProviderId() {
  return activeProviderId;
}

export function setActiveProvider(providerId: string) {
  const normalized = normalizeProviderId(providerId);
  const definition = getProviderDefinitions().find((provider) => provider.id === normalized);

  if (!definition) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  if (!definition.configured) {
    throw new Error(`${definition.name} is not configured. Add its API key to .env first.`);
  }

  activeProviderId = normalized;
  return getProviderStatus();
}

export function getProviderStatus() {
  const activeDefinition = getProviderDefinitions().find((provider) => provider.id === activeProviderId);

  if (!activeDefinition?.configured) {
    activeProviderId = "mock";
  }

  return {
    activeProviderId,
    providers: getProviderDefinitions().map(({ key: _key, ...provider }) => ({
      ...provider,
      active: provider.id === activeProviderId
    }))
  };
}

export function createProvider(): LlmProvider {
  const definition = getProviderDefinitions().find((provider) => provider.id === activeProviderId);

  if (!definition || definition.id === "mock" || !definition.key || !definition.configured) {
    activeProviderId = "mock";
    return new MockProvider();
  }

  return new OpenAiProvider(definition.key, {
    baseURL: definition.baseURL,
    includeStreamUsage: definition.includeStreamUsage,
    model: definition.model,
    name: definition.id
  });
}

function hasKey(value?: string) {
  return Boolean(value && value !== "replace-me");
}

function normalizeProviderId(value?: string): ProviderId {
  if (value === "gemini" || value === "openai" || value === "groq" || value === "mock") {
    return value;
  }

  return "mock";
}
