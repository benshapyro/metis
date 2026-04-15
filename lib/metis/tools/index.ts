export type ToolFailureReason =
  | 'not_found'
  | 'malformed'
  | 'size_capped'
  | 'timeout'
  | 'error';

export type ToolResult<T> =
  | { ok: true; data: T; sizeCapped?: boolean }
  | { ok: false; reason: ToolFailureReason; detail?: string };
