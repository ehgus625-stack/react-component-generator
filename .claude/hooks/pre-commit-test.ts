// PreToolUse(Bash) 훅: `git commit` 실행 전 전체 테스트를 돌리고, 하나라도 실패하면 차단한다.
// 차단 = exit 2 (stderr가 Claude에게 전달됨). 테스트 실행 자체가 실패해도 차단(fail-closed).
const input = await Bun.stdin.json().catch(() => null)
const command: string = input?.tool_input?.command ?? ''

// `git commit`, `git -C x commit`, `git -c k=v commit` 등을 감지 (--amend 포함)
const isGitCommit = /(^|[\s;&|(])git\s+(?:-\S+(?:\s+\S+)?\s+)*commit(\s|$)/.test(command)
if (!isGitCommit) process.exit(0)

const cwd: string = input?.cwd ?? process.cwd()
const proc = Bun.spawnSync(['bun', 'run', 'test'], { cwd, stdout: 'pipe', stderr: 'pipe' })

if (proc.exitCode === 0) process.exit(0)

const tail = (buf: Uint8Array) => new TextDecoder().decode(buf).split('\n').slice(-40).join('\n')
console.error(
  `커밋 차단: 테스트가 실패했습니다 (exit ${proc.exitCode}). 모든 테스트가 통과해야 커밋할 수 있습니다.\n` +
    `테스트를 고친 뒤 다시 시도하세요. 훅을 우회하거나 비활성화하지 마세요.\n\n` +
    tail(proc.stdout) + '\n' + tail(proc.stderr),
)
process.exit(2)
