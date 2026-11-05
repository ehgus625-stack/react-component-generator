export const MAX_HISTORY = 20;

/** 프롬프트를 히스토리 맨 앞에 추가한다. 중복은 앞으로 당기고 MAX_HISTORY개까지만 유지한다. */
export function addToHistory(history: string[], prompt: string): string[] {
  return [prompt, ...history.filter((p) => p !== prompt)].slice(0, MAX_HISTORY);
}
