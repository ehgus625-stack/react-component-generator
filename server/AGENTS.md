# server/AGENTS.md

## Module Context

Bun 기반 AI API 프록시. `index.ts`가 `/api/config`, `/api/generate`를 제공하고, 응답 정규화는 `generator.ts`, 모델 폴백은 `fallback.ts`가 담당한다.

## Tech Stack & Constraints

- 실행은 Bun (`bun --watch run server/index.ts`). 외부 HTTP 클라이언트 라이브러리 없이 전역 `fetch`만 사용한다.
- 에러 분기는 메시지 문자열 매칭이다 (`index.ts:194`, `index.ts:201`의 `'503'`, `'429'`). 프로바이더 에러 메시지는 `API error: <status>` 형식을 유지해야 상태 코드 변환이 동작한다.

## Implementation Patterns

- 새 프로바이더: `callXxx` 함수 추가, `Provider` 타입(`index.ts:57`)과 `ENV_KEYS`(`index.ts:59`) 확장, 분기 추가.
- 모델 폴백이 필요하면 `withModelFallback(models, attempt)`를 재사용한다 (`index.ts:135`).
- 응답 후처리 순서는 `ensureRenderCall(stripCodeFences(text))` 고정 (`index.ts:188`).

## Testing Strategy

- `bun run test`로 실행. 테스트는 순수 함수 파일에 대응한다: `generator.test.ts`, `fallback.test.ts`.
- `index.ts`(네트워크 호출, `Bun.serve`)는 테스트 경계 밖이다. 새 로직은 순수 함수로 분리해 테스트하라.

## Local Golden Rules

- Google API 키는 URL 쿼리에 들어간다 (`index.ts:99`). 이 URL을 로깅하거나 에러 메시지에 포함하지 마라.
- `callGoogleModel`의 `MAX_TOKENS` 에러(`index.ts:123`)는 폴백 루프에서 잡혀 다음 모델로 재시도된다. 사용자 메시지로 전달하려면 모든 모델이 실패했을 때의 마지막 에러라는 점을 고려하라.
- CORS 헤더는 모든 응답에 수동으로 붙인다 (`CORS_HEADERS`). 새 응답을 추가할 때 `{ headers: CORS_HEADERS }`를 빠뜨리지 마라.
