import { describe, it, expect } from 'vitest';
import { splitNdjson } from './ndjson';

describe('splitNdjson', () => {
  it('완결된 줄만 파싱하고 미완결 줄은 rest로 남긴다', () => {
    const { events, rest } = splitNdjson('{"type":"delta","text":"a"}\n{"type":"done"');
    expect(events).toEqual([{ type: 'delta', text: 'a' }]);
    expect(rest).toBe('{"type":"done"');
  });

  it('빈 줄과 깨진 줄은 건너뛴다', () => {
    const { events } = splitNdjson('\nbroken\n{"type":"reset"}\n');
    expect(events).toEqual([{ type: 'reset' }]);
  });
});
