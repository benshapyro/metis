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
  return new ToolLoopAgent({
    model: getLanguageModel(METIS_MODELS.synthesize),
    instructions: await systemPromptString(),
    tools: {
      search_pages: searchPagesTool,
      read_page: readPageTool,
      read_frontmatter: readFrontmatterTool,
      list_pages: listPagesTool,
      get_backlinks: getBacklinksTool,
    },
    stopWhen: stepCountIs(12),
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral", ttl: "1h" },
      },
    },
  });
}

export type MetisAgent = Awaited<ReturnType<typeof makeMetisAgent>>;
export type MetisUIMessage = InferAgentUIMessage<MetisAgent>;
