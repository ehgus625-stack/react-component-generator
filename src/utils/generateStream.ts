import { splitNdjson } from './ndjson';
import type { StreamEvent } from '../types';

/** /api/generate 의 NDJSON 스트림을 소비해 최종 코드를 반환한다. error 이벤트나 done 누락 시 reject. */
export async function readGenerateStream(
  body: ReadableStream<Uint8Array>,
  handlers: { onDelta: (text: string) => void; onReset: () => void },
): Promise<string> {
  let finalCode: string | null = null;

  const handle = (event: StreamEvent) => {
    if (event.type === 'reset') handlers.onReset();
    else if (event.type === 'delta') handlers.onDelta(event.text);
    else if (event.type === 'done') finalCode = event.code;
    else if (event.type === 'error') throw new Error(event.error);
  };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = splitNdjson(buffer);
    buffer = parsed.rest;
    (parsed.events as StreamEvent[]).forEach(handle);
  }
  buffer += decoder.decode();
  (splitNdjson(buffer + '\n').events as StreamEvent[]).forEach(handle);

  if (finalCode === null) throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
  return finalCode;
}
