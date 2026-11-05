// 프로바이더 스트리밍(SSE) 응답을 해석하는 순수 함수들. 네트워크 부수효과 없음.

/** SSE 버퍼에서 완결된 이벤트의 data 줄을 추출하고, 미완결 꼬리는 rest로 반환한다. */
export function splitSseEvents(buffer: string): { datas: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const datas: string[] = [];
  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (data) datas.push(data);
  }
  return { datas, rest };
}

function safeParse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

const ANTHROPIC_ERROR_STATUS: Record<string, number> = {
  overloaded_error: 529,
  rate_limit_error: 429,
};

/** Anthropic SSE 이벤트를 해석한다. 스트림 중간 error 이벤트는 `API error: <status>` 형식으로 던진다. */
export function parseAnthropicEvent(data: string): { text: string; stop: boolean } {
  const json = safeParse(data) as {
    type?: string;
    delta?: { type?: string; text?: string };
    error?: { type?: string; message?: string };
  } | null;
  if (json?.type === 'error') {
    const status = ANTHROPIC_ERROR_STATUS[json.error?.type ?? ''];
    throw new Error(status ? `Claude API error: ${status}` : (json.error?.message ?? 'Claude API error'));
  }
  if (json?.type === 'message_stop') return { text: '', stop: true };
  if (json?.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
    return { text: json.delta.text ?? '', stop: false };
  }
  return { text: '', stop: false };
}

/** SSE 응답 본문을 읽으며 완결된 data 페이로드마다 콜백을 호출한다. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { datas, rest } = splitSseEvents(buffer);
    buffer = rest;
    datas.forEach(onData);
  }
  buffer += decoder.decode();
  splitSseEvents(buffer + '\n\n').datas.forEach(onData);
}

/** 에러를 클라이언트용 메시지/상태 코드로 변환한다. */
export function toErrorPayload(err: unknown): { error: string; status: number } {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('503') || message.includes('529')) {
    return { error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.', status: 503 };
  }
  if (message.includes('429')) {
    return { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', status: 429 };
  }
  return { error: message, status: 500 };
}

export function extractGoogleDelta(data: string): { text: string; truncated: boolean } {
  const json = safeParse(data) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  } | null;
  const candidate = json?.candidates?.[0];
  return {
    text: candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
    truncated: candidate?.finishReason === 'MAX_TOKENS',
  };
}
