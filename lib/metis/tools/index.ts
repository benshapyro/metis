export type ToolFailureReason =
  | 'not_found'
  | 'malformed'
  | 'size_capped'
  | 'timeout'
  | 'error';

export type ToolResult<T> =
  | { ok: true; data: T; sizeCapped?: boolean }
  | { ok: false; reason: ToolFailureReason; detail?: string };

export { readPageTool, readPage } from './read-page';
export type { ReadPageData } from './read-page';

export { readFrontmatterTool, readFrontmatter } from './read-frontmatter';
export type { ReadFrontmatterData } from './read-frontmatter';

export { listPagesTool, listPages } from './list-pages';
