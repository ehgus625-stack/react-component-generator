/** NDJSON 버퍼에서 완결된 줄을 JSON으로 파싱하고, 미완결 꼬리는 rest로 반환한다. 깨진 줄은 건너뛴다. */
export function splitNdjson(buffer: string): { events: unknown[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: unknown[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // 깨진 줄은 무시
    }
  }
  return { events, rest };
}
