import { useState, useEffect } from 'react';
import { loadStored, saveStored } from '../utils/storage';

/** useState처럼 쓰되 값을 localStorage에 동기화하고 새로고침 시 복원한다. */
export function usePersistentState<T>(key: string, initial: T, parse: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => loadStored(key, parse, initial));

  useEffect(() => {
    saveStored(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
