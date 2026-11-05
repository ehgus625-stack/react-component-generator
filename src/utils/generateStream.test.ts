import { describe, it, expect, vi } from 'vitest';
import { readGenerateStream } from './generateStream';

function streamOf(...lines: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      lines.forEach((l) => c.enqueue(enc.encode(JSON.stringify(l) + '\n')));
      c.close();
    },
  });
}

describe('readGenerateStream', () => {
  it('delta 를 콜백으로 전달하고 done 의 최종 코드를 반환한다', async () => {
    const onDelta = vi.fn();
    const code = await readGenerateStream(
      streamOf({ type: 'delta', text: 'a' }, { type: 'delta', text: 'b' }, { type: 'done', code: 'ab!' }),
      { onDelta, onReset: vi.fn() },
    );
    expect(onDelta.mock.calls).toEqual([['a'], ['b']]);
    expect(code).toBe('ab!');
  });

  it('reset 이벤트를 onReset 으로 전달한다', async () => {
    const onReset = vi.fn();
    await readGenerateStream(streamOf({ type: 'reset' }, { type: 'done', code: 'x' }), {
      onDelta: vi.fn(),
      onReset,
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('error 이벤트는 해당 메시지로 reject 한다', async () => {
    await expect(
      readGenerateStream(streamOf({ type: 'error', error: '과부하' }), {
        onDelta: vi.fn(),
        onReset: vi.fn(),
      }),
    ).rejects.toThrow('과부하');
  });

  it('done 없이 끝나면 끊김 에러로 reject 한다', async () => {
    await expect(
      readGenerateStream(streamOf({ type: 'delta', text: 'a' }), {
        onDelta: vi.fn(),
        onReset: vi.fn(),
      }),
    ).rejects.toThrow('중간에 끊겼');
  });
});
