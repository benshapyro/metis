import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from 'ai';
import { systemPromptString } from './prompt';
import { METIS_MODELS } from '@/lib/ai/models';
import { getLanguageModel } from '@/lib/ai/providers';
import {
  searchPagesTool,
  readPageTool,
  readFrontmatterTool,
  listPagesTool,
  getBacklinksTool,
} from '@/lib/metis/tools';

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
        cacheControl: { type: 'ephemeral', ttl: '1h' },
      },
    },
  });
}

export type MetisAgent = Awaited<ReturnType<typeof makeMetisAgent>>;
export type MetisUIMessage = InferAgentUIMessage<MetisAgent>;
