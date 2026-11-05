// PreToolUse(Edit|Write|MultiEdit) 훅: 파일 생성/수정 전에 .claude/rules/tdd.md 핵심을 컨텍스트로 주입한다.
// 차단하지 않고(exit 0) additionalContext만 추가한다.
const input = await Bun.stdin.json().catch(() => null)
const file: string = String(input?.tool_input?.file_path ?? '').replaceAll('\\', '/')

// TDD 불필요 대상(문서/설정/스타일/훅·스킬 등 하네스 파일)은 건너뛴다
const skip = /\.(md|json|css|html|svg|lock)$/i.test(file) || /(^|\/)\.(claude|agents|vscode)\//.test(file)
if (!file || skip) process.exit(0)

const isTest = /\.test\.tsx?$/.test(file)

const reminder = isTest
  ? [
      '[TDD 리마인더] 테스트 파일을 작성/수정하려 합니다 (.claude/rules/tdd.md).',
      '- RED: 하나의 동작 = 하나의 테스트. 작성 후 반드시 실행해 "기능 미구현"으로 실패하는지 확인하라 (오타/import 오류로 인한 실패는 RED가 아니다).',
      '- 아직 구현이 없다면 이 테스트를 먼저 실행해 실패를 확인한 뒤에만 프로덕션 코드를 작성하라.',
    ]
  : [
      `[TDD 리마인더] 프로덕션 코드를 작성/수정하려 합니다: ${file} (.claude/rules/tdd.md, Rigid).`,
      '- 비즈니스 로직/API/유틸/순수 함수/버그 수정이면 반드시 TDD다. 애매하면 적용한다.',
      '- 이 변경을 요구하는 실패 테스트가 먼저 있고, 실행해서 실패("기능 미구현")를 확인했는가? 아니라면 지금 멈추고 테스트부터 작성하라.',
      '- 테스트 전에 프로덕션 코드를 먼저 썼다면 삭제하고 RED부터 다시 시작한다 ("참고용" 보관 금지).',
      '- GREEN은 테스트를 통과시키는 최소한의 코드만(YAGNI). 신규+기존 테스트 전체 실행으로 확인. REFACTOR에서 새 동작 추가 금지.',
      '- 타입 정의, 설정, 순수 UI(로직 없는 마크업/스타일)는 TDD 불필요.',
    ]

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: reminder.join('\n'),
    },
  }),
)
