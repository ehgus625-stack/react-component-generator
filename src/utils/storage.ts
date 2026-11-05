import type { GeneratedComponent, Provider } from '../types';

export const STORAGE_KEYS = {
  apiKey: 'rcg:apiKey',
  provider: 'rcg:provider',
  history: 'rcg:history',
  components: 'rcg:components',
} as const;

const PROVIDERS: readonly Provider[] = ['anthropic', 'google'];
const DEFAULT_PROVIDER: Provider = 'google';

/** localStorage에서 JSON을 읽어 parse로 검증/변환한다. 어떤 실패든 fallback을 반환한다. */
export function loadStored<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/** 값을 JSON으로 저장한다. 용량 초과/접근 차단 등 실패는 무시한다. */
export function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패가 앱 동작을 막아서는 안 된다.
  }
}

export function parseString(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

export function parseProvider(raw: unknown): Provider {
  return PROVIDERS.find((p) => p === raw) ?? DEFAULT_PROVIDER;
}

export function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

export function parseComponents(raw: unknown): GeneratedComponent[] {
  if (!Array.isArray(raw)) return [];
  const result: GeneratedComponent[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, prompt, code, createdAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') continue;
    if (typeof createdAt !== 'string') continue;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) continue;
    result.push({ id, prompt, code, createdAt: date });
  }
  return result;
}
