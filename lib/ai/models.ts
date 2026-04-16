// Metis model registry. v1 runs everything on Sonnet 4.6 — eval demonstrated
// Sonnet handles the full query mix (grounding gates, clarifications, cross-
// domain synthesis, exhaustive pricing tables) at ~5x lower cost than Opus.
// Two-tier routing (D11: Sonnet navigate + Opus synthesize) was designed for
// v1.5 if Sonnet ever regresses on synthesis-class queries at scale.
export const METIS_MODELS = {
  navigate: "anthropic/claude-sonnet-4.6",
  synthesize: "anthropic/claude-sonnet-4.6",
} as const;

export type MetisModelRole = keyof typeof METIS_MODELS;

export const DEFAULT_CHAT_MODEL = METIS_MODELS.synthesize;

export const titleModel = {
  id: METIS_MODELS.navigate,
  name: "Claude Sonnet 4.6",
  provider: "anthropic",
  description: "Fast model for title generation",
  gatewayOrder: ["anthropic"],
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

// Legacy export shape consumed by downstream components and the chat route.
// Single Metis (Sonnet 4.6) entry as the default synthesis model.
export const chatModels: ChatModel[] = [
  {
    id: METIS_MODELS.synthesize,
    name: "Metis (Sonnet 4.6)",
    provider: "anthropic",
    description: "Anthropic Claude Sonnet 4.6 — synthesis + tool-use",
    gatewayOrder: ["anthropic"],
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(async (model) => {
      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
          { next: { revalidate: 86_400 } }
        );
        if (!res.ok) {
          console.warn(
            `[models] capability fetch ${model.id} returned ${res.status} ${res.statusText}`
          );
          return [model.id, { tools: false, vision: false, reasoning: false }];
        }

        const json = await res.json();
        const endpoints = json.data?.endpoints ?? [];
        const params = new Set(
          endpoints.flatMap(
            (e: { supported_parameters?: string[] }) =>
              e.supported_parameters ?? []
          )
        );
        const inputModalities = new Set(
          json.data?.architecture?.input_modalities ?? []
        );

        return [
          model.id,
          {
            tools: params.has("tools"),
            vision: inputModalities.has("image"),
            reasoning: params.has("reasoning"),
          },
        ];
      } catch (err) {
        console.error(`[models] capability fetch failed for ${model.id}`, err);
        return [model.id, { tools: false, vision: false, reasoning: false }];
      }
    })
  );

  return Object.fromEntries(results);
}

export const isDemo = process.env.IS_DEMO === "1";

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0],
        description: "",
        capabilities: {
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
          reasoning: m.tags?.includes("reasoning") ?? false,
        },
      }));
  } catch (err) {
    console.error("[models] getAllGatewayModels failed", err);
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
