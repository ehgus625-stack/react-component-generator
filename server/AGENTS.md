# server/AGENTS.md

## Module Context

Bun 기반 AI API 프록시. `index.ts`가 `/api/config`, `/api/generate`를 제공하고, 응답 정규화는 `generator.ts`, 모델 폴백은 `fallback.ts`, SSE 파싱·에러 변환은 `stream.ts`가 담당한다.
`/api/generate`는 NDJSON 스트림(`application/x-ndjson`)으로 응답한다. 이벤트: `delta`(코드 조각), `reset`(폴백 재시도, 클라이언트가 누적 코드를 비움), `done`(최종 코드), `error`. 클라이언트 소비는 `src/utils/generateStream.ts`.

## Tech Stack & Constraints

- 실행은 Bun (`bun --watch run server/index.ts`). 외부 HTTP 클라이언트 라이브러리 없이 전역 `fetch`만 사용한다.
- 에러 분기는 `stream.ts`의 `toErrorPayload`(`stream.ts:72`)에서 메시지 문자열 매칭(`'503'`/`'529'`, `'429'`)으로 한다. 프로바이더 에러 메시지는 `API error: <status>` 형식을 유지해야 상태 코드 변환이 동작한다. 스트림 중간 에러(Anthropic `error` 이벤트)도 `parseAnthropicEvent`가 이 형식으로 던진다.
- 에러는 HTTP 200 스트림 시작 후에는 `error` 이벤트로 전달된다. 스트림 시작 전(요청 검증) 에러만 HTTP 상태 코드로 응답한다.

## Implementation Patterns

- 새 프로바이더: `streamXxx` 함수 추가(`emit`으로 `delta` 전송, `AbortSignal` 전달), `Provider` 타입(`index.ts:58`)과 `ENV_KEYS`(`index.ts:60`) 확장, 분기 추가.
- 모델 폴백이 필요하면 `withModelFallback(models, attempt)`를 재사용한다 (`index.ts:166`). 시도마다 `reset` 이벤트를 보내 클라이언트가 앞선 부분 코드를 버리게 한다.
- 응답 후처리는 `buildFinalCode(text)`(`index.ts:236`)로 한다. 내부 순서 `stripCodeFences` → `ensureRenderCall`은 고정이며, 빈 결과는 에러다.

## Testing Strategy

- `bun run test`로 실행. 테스트는 순수 함수 파일에 대응한다: `generator.test.ts`, `fallback.test.ts`, `stream.test.ts`.
- `index.ts`(네트워크 호출, `Bun.serve`)는 테스트 경계 밖이다. 새 로직은 순수 함수로 분리해 테스트하라.

## Local Golden Rules

- Google API 키는 URL 쿼리에 들어간다 (`index.ts:121`). 이 URL을 로깅하거나 에러 메시지에 포함하지 마라.
- `streamGoogleModel`의 `MAX_TOKENS` 에러(`index.ts:154-156`)는 스트림 종료 후에야 판정되며, 폴백 루프에서 잡혀 다음 모델로 재시도된다. 사용자 메시지로 전달하려면 모든 모델이 실패했을 때의 마지막 에러라는 점을 고려하라.
- CORS 헤더는 모든 응답에 수동으로 붙인다 (`CORS_HEADERS`). 새 응답을 추가할 때 `{ headers: CORS_HEADERS }`를 빠뜨리지 마라.
