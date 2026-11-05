import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';
import { parseString } from '../utils/storage';

beforeEach(() => localStorage.clear());

describe('usePersistentState', () => {
  it('저장된 값이 없으면 초기값을 사용한다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init', parseString));
    expect(result.current[0]).toBe('init');
  });

  it('저장된 값이 있으면 그 값으로 시작한다 (새로고침 복원)', () => {
    localStorage.setItem('k', JSON.stringify('saved'));
    const { result } = renderHook(() => usePersistentState('k', 'init', parseString));
    expect(result.current[0]).toBe('saved');
  });

  it('값을 바꾸면 localStorage에 저장한다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init', parseString));
    act(() => result.current[1]('changed'));
    expect(localStorage.getItem('k')).toBe('"changed"');
  });
});
