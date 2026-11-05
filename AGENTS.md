# AGENTS.md

## Operational Commands

- 패키지 매니저/런타임은 `bun` 고정 (`bun.lock` 존재). npm/yarn/pnpm 사용 금지.
- 설치: `bun install`
- 개발 (API 서버 + Vite 동시): `bun run dev` (API 3002, Vite 5173)
- 테스트: `bun run test` (vitest, `src/**` 와 `server/**` 의 `*.test.ts(x)` 대상). `bun test`는 Bun 내장 러너를 호출하므로 사용 금지.
- 린트: `bun run lint`
- 빌드/타입체크: `bun run build` (`tsc -b && vite build`)
- 변경 후 완료 보고 전 `bun run lint`, `bun run test`, `bun run build`를 실행한다.

## Golden Rules

Immutable:
- API 키 경계: 서버 환경변수 키는 클라이언트로 값을 내보내지 않는다. `/api/config`는 boolean만 반환한다 (`server/index.ts:182-192`). 키 값을 응답, 로그, 에러 메시지에 포함하지 마라.
- `.env`는 커밋 금지 (`.gitignore`). 키를 코드에 하드코딩하지 마라.
- 민감 파일 접근 금지: `.env`, `.env.*`, `*secret*`, `*credential*`, `*.pem`, `*.key`, `id_rsa*`, `.npmrc`, `.ssh/`, `.aws/` 등은 읽기·수정·복사·출력 모두 금지한다. `.claude/settings.json`의 `permissions.deny`로 강제된다. 이 목록을 우회(셸 `cat`, `printenv`, 다른 도구로 읽기)하거나 deny 규칙을 약화·삭제하지 마라. 환경변수 설정이 필요하면 값을 요구하지 말고 사용자에게 직접 `.env` 편집을 요청하라.
- 생성 코드는 react-live `noInline` 모드에서 실행된다 (`src/components/LivePreview.tsx:11`). 이 모드는 `render(...)` 호출이 없으면 아무것도 그리지 않는다.

Do's & Don'ts:
- 생성 코드 계약(시스템 프롬프트 `server/index.ts:8-50`)을 바꾸면 후처리(`server/generator.ts`), 스트림 소비(`src/utils/generateStream.ts`), `LivePreview`를 함께 확인하라. 계약: import 금지, 인라인 스타일만, TypeScript 문법 금지, 마지막에 `render(<Name />)`.
- `render` 호출 보장은 프롬프트(`index.ts:13`의 규칙)와 `ensureRenderCall`(`generator.ts:23`, `buildFinalCode`가 호출) 두 곳에서 이중으로 방어한다. 한쪽만 제거하지 마라.
- 프로바이더 간 비대칭을 인지하라: Google만 모델 폴백(`index.ts:166-170`)과 `MAX_TOKENS` 검사(`index.ts:154-156`)가 있다. Anthropic 경로에는 없다. 변경 시 양쪽 의도를 확인하라.
- 코드 구현(생성/수정)을 마치면 완료 보고 전에 `evaluator` 서브 에이전트(`.claude/agents/evaluator.md`, 읽기 전용·적대적 리뷰)를 호출한다. 변경 파일 목록과 구현 의도를 전달하고, Critical/Major 지적은 반영한 뒤 보고한다.
- 포트 3002는 `server/index.ts:174`와 `vite.config.ts` 프록시 두 곳에 있다. 함께 변경하라.
- 순수 로직은 `server/generator.ts`, `server/fallback.ts`에 두고 단위 테스트를 추가하라. `server/index.ts`는 `Bun.serve` 부수효과 때문에 테스트 대상이 아니며 로직을 늘리지 마라.

## Project Context

프롬프트로 React 컴포넌트를 생성하고 실시간 미리보기/코드를 제공하는 도구. 상세 소개와 실행 방법은 README.md 참고.
Stack: React 19, TypeScript, Vite, Bun(API 서버), react-live, vitest, Anthropic/Gemini API.

## Standards & References

- 커밋: `타입: 요약` 한국어, 타입은 feat/fix/refactor/chore (`.claude/skills/commit/SKILL.md`).
- 서버 영역 규칙: [server/AGENTS.md](./server/AGENTS.md)
- Maintenance Policy: 규칙과 코드가 어긋나면 AGENTS.md 업데이트를 제안하라.
