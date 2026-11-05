import { describe, it, expect } from 'vitest';
import {
  splitSseEvents,
  parseAnthropicEvent,
  extractGoogleDelta,
  readSseStream,
  toErrorPayload,
} from './stream';

describe('splitSseEvents', () => {
  it('완결된 이벤트의 data 줄만 추출하고 나머지는 rest로 돌려준다', () => {
    const buf = 'event: x\ndata: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"';
    const { datas, rest } = splitSseEvents(buf);
    expect(datas).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"c"');
  });

  it('CRLF 구분자도 처리한다', () => {
    const { datas, rest } = splitSseEvents('data: hi\r\n\r\n');
    expect(datas).toEqual(['hi']);
    expect(rest).toBe('');
  });
});

describe('parseAnthropicEvent', () => {
  it('content_block_delta 의 text_delta 텍스트를 반환한다', () => {
    const d = JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'abc' } });
    expect(parseAnthropicEvent(d)).toEqual({ text: 'abc', stop: false });
  });

  it('message_stop 이면 stop 을 true 로 표시한다', () => {
    expect(parseAnthropicEvent(JSON.stringify({ type: 'message_stop' }))).toEqual({ text: '', stop: true });
  });

  it('다른 이벤트나 깨진 입력은 빈 결과를 반환한다', () => {
    expect(parseAnthropicEvent(JSON.stringify({ type: 'message_start' }))).toEqual({ text: '', stop: false });
    expect(parseAnthropicEvent('not json')).toEqual({ text: '', stop: false });
  });

  it('overloaded_error 이벤트는 API error: 529 로 던진다', () => {
    const d = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'x' } });
    expect(() => parseAnthropicEvent(d)).toThrow('Claude API error: 529');
  });

  it('rate_limit_error 이벤트는 API error: 429 로 던진다', () => {
    const d = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'x' } });
    expect(() => parseAnthropicEvent(d)).toThrow('Claude API error: 429');
  });

  it('그 밖의 error 이벤트는 원본 메시지로 던진다', () => {
    const d = JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } });
    expect(() => parseAnthropicEvent(d)).toThrow('boom');
  });
});

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      chunks.forEach((s) => c.enqueue(enc.encode(s)));
      c.close();
    },
  });
}

describe('readSseStream', () => {
  it('청크 경계에서 이벤트가 쪼개져도 순서대로 data 를 전달한다', async () => {
    const got: string[] = [];
    await readSseStream(streamOf('data: {"a"', ':1}\n', '\ndata: 2\n\n'), (d) => got.push(d));
    expect(got).toEqual(['{"a":1}', '2']);
  });

  it('빈 줄 없이 끝난 마지막 이벤트도 전달한다', async () => {
    const got: string[] = [];
    await readSseStream(streamOf('data: last'), (d) => got.push(d));
    expect(got).toEqual(['last']);
  });
});

describe('toErrorPayload', () => {
  it('503/529 는 과부하 안내 503 으로 변환한다', () => {
    expect(toErrorPayload(new Error('Gemini API error: 503')).status).toBe(503);
    expect(toErrorPayload(new Error('Claude API error: 529')).status).toBe(503);
  });

  it('429 는 요청 과다 429 로 변환한다', () => {
    expect(toErrorPayload(new Error('Claude API error: 429')).status).toBe(429);
  });

  it('그 밖의 에러는 메시지를 그대로 500 으로 반환한다', () => {
    expect(toErrorPayload(new Error('boom'))).toEqual({ error: 'boom', status: 500 });
    expect(toErrorPayload('x')).toEqual({ error: 'Unknown error', status: 500 });
  });
});

describe('extractGoogleDelta', () => {
  it('candidates 파츠 텍스트를 이어붙인다', () => {
    const d = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] });
    expect(extractGoogleDelta(d)).toEqual({ text: 'ab', truncated: false });
  });

  it('finishReason 이 MAX_TOKENS 이면 truncated 를 true 로 표시한다', () => {
    const d = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'a' }] }, finishReason: 'MAX_TOKENS' }] });
    expect(extractGoogleDelta(d)).toEqual({ text: 'a', truncated: true });
  });

  it('파싱 불가 입력은 빈 결과를 반환한다', () => {
    expect(extractGoogleDelta('x')).toEqual({ text: '', truncated: false });
  });
});
