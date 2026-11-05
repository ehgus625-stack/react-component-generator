import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEYS,
  loadStored,
  saveStored,
  parseString,
  parseProvider,
  parseStringArray,
  parseComponents,
} from './storage';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('STORAGE_KEYS', () => {
  it('상태별 고유 키를 제공한다', () => {
    expect(new Set(Object.values(STORAGE_KEYS)).size).toBe(4);
  });
});

describe('loadStored', () => {
  it('저장된 값이 없으면 fallback을 반환한다', () => {
    expect(loadStored('k', parseString, 'fb')).toBe('fb');
  });

  it('저장된 JSON을 parse 함수로 변환해 반환한다', () => {
    localStorage.setItem('k', JSON.stringify('abc'));
    expect(loadStored('k', parseString, 'fb')).toBe('abc');
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('k', '{not json');
    expect(loadStored('k', parseString, 'fb')).toBe('fb');
  });

  it('localStorage 접근이 throw해도 fallback을 반환한다', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStored('k', parseString, 'fb')).toBe('fb');
  });
});

describe('saveStored', () => {
  it('값을 JSON으로 저장한다', () => {
    saveStored('k', ['a']);
    expect(localStorage.getItem('k')).toBe('["a"]');
  });

  it('저장이 throw해도(용량 초과 등) 예외를 전파하지 않는다', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveStored('k', 'v')).not.toThrow();
  });
});

describe('parseString', () => {
  it('문자열이 아니면 빈 문자열이다', () => {
    expect(parseString(123)).toBe('');
  });
});

describe('parseProvider', () => {
  it('유효한 provider는 그대로 반환한다', () => {
    expect(parseProvider('anthropic')).toBe('anthropic');
  });

  it('알 수 없는 값은 기본값 google이다', () => {
    expect(parseProvider('openai')).toBe('google');
  });
});

describe('parseStringArray', () => {
  it('문자열이 아닌 요소는 걸러낸다', () => {
    expect(parseStringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
  });

  it('배열이 아니면 빈 배열이다', () => {
    expect(parseStringArray('a')).toEqual([]);
  });
});

describe('parseComponents', () => {
  const valid = { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-02T03:04:05.000Z' };

  it('createdAt 문자열을 Date로 복원한다', () => {
    const [component] = parseComponents([valid]);
    expect(component.createdAt).toBeInstanceOf(Date);
    expect(component.createdAt.toISOString()).toBe(valid.createdAt);
  });

  it('필드가 잘못된 항목은 걸러낸다', () => {
    const result = parseComponents([valid, { id: 2 }, null, { ...valid, createdAt: 'nope' }]);
    expect(result).toHaveLength(1);
  });

  it('배열이 아니면 빈 배열이다', () => {
    expect(parseComponents({})).toEqual([]);
  });
});
