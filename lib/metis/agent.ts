import { type InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai";
import { METIS_MODELS } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  getBacklinksTool,
  listPagesTool,
  readFrontmatterTool,
  readPageTool,
  searchPagesTool,
} from "@/lib/metis/tools";
import { systemPromptString } from "./prompt";

export async function makeMetisAgent() {
  const systemText = await systemPromptString();
  return new ToolLoopAgent({
    model: getLanguageModel(METIS_MODELS.synthesize),
    instructions: {
      role: "system",
      content: systemText,
      // 1h ephemeral cache on the static system prefix. Stable across turns; hot
      // caches change slowly (refreshed via /api/warm). Amortizes 50K-token preload
      // over a session — verify with providerMetadata.anthropic.cacheCreationInputTokens.
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    tools: {
      search_pages: searchPagesTool,
      read_page: readPageTool,
      read_frontmatter: readFrontmatterTool,
      list_pages: listPagesTool,
      get_backlinks: getBacklinksTool,
    },
    stopWhen: stepCountIs(12),
  });
}

export type MetisAgent = Awaited<ReturnType<typeof makeMetisAgent>>;
export type MetisUIMessage = InferAgentUIMessage<MetisAgent>;
