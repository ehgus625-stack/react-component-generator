---
name: create-pr
description: 현재 브랜치의 변경사항을 분석해 PR 템플릿에 맞춰 GitHub Pull Request를 생성한다. 이 프로젝트(react-component-generator)는 한국어, 그 외 프로젝트는 영어 템플릿을 사용한다. "PR 만들어줘", "PR 생성", "풀리퀘스트 올려줘", "create a PR" 같은 요청에 활성화한다.
context: fork
---

# create-pr

현재 브랜치의 커밋을 분석해 PR 본문을 작성하고 `gh pr create`로 생성하는 스킬.
`context: fork`로 실행되므로 서브 에이전트가 대화 맥락을 이어받아 PR 생성을 대신 수행하고, 결과(PR URL)만 보고한다.

## 언어 규칙

| 대상 | 언어 | 템플릿 |
|------|------|--------|
| 이 프로젝트 (`react-component-generator`) | 한국어 | [references/pr-template.ko.md](references/pr-template.ko.md) |
| 그 외 모든 프로젝트 | 영어 | [references/pr-template.en.md](references/pr-template.en.md) |

판별 방법: `gh repo view --json name -q .name` 결과(실패 시 `git remote get-url origin`의 repo 이름)가 `react-component-generator`이면 한국어, 아니면 영어.
PR 제목과 본문 모두 선택된 언어로 작성한다. 코드 식별자, 파일 경로, 명령어는 번역하지 않는다.

## 절차

### 1. 사전 확인
- `git status`로 커밋되지 않은 변경이 있는지 확인한다. 있으면 PR에 포함되지 않는다는 점을 결과 보고에 알린다(커밋은 임의로 만들지 않는다).
- 현재 브랜치가 기본 브랜치(`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`)와 같으면 중단하고, 작업 브랜치를 만들어야 한다고 알린다.
- 이미 열린 PR이 있는지 `gh pr view` 로 확인한다. 있으면 새로 만들지 않고 그 URL을 알린다.

### 2. 변경사항 분석
- 기준 브랜치 대비 `git log <base>..HEAD --oneline`, `git diff <base>...HEAD --stat`, 필요 시 `git diff <base>...HEAD`로 실제 변경을 읽는다.
- 커밋 메시지가 아니라 diff 내용을 근거로 요약한다.
- 변경 유형(feat/fix/refactor/chore)을 판단한다.

### 3. 제목과 본문 작성
- 위 언어 규칙에 따라 템플릿 파일을 읽고 각 섹션을 채운다. 해당 없는 섹션은 "해당 없음"/"N/A"로 남긴다.
- 제목: 한국어는 `타입: 요약`(`.claude/skills/commit/SKILL.md` 컨벤션), 영어는 `type: summary`. 70자 이내, 마침표 없음.
- 테스트 항목은 실제로 실행해 확인한 것만 체크한다. 실행하지 않은 것을 체크하지 않는다.
- 비밀값(API 키, `.env` 내용)을 본문에 넣지 않는다.

### 4. 푸시 및 생성 (승인 없이 진행)
- PR 생성 요청 자체가 승인이므로 별도 확인 없이 진행한다.
- 원격에 브랜치가 없으면 `git push -u origin <branch>`로 푸시한다.
- 본문은 임시 파일(scratchpad)에 쓰고 `gh pr create --base <base> --title "<제목>" --body-file <파일>`로 생성한다.
- 사용자가 "draft", "초안"을 요청하면 `--draft`를 추가한다.
- 완료 후 PR URL, 제목, 사용한 템플릿 언어를 보고한다.

## 금지 사항
- `--force` 푸시, 기본 브랜치로의 직접 푸시, 사용자 요청 없는 머지는 하지 않는다.
- 커밋 메시지·PR 본문에 사용자가 요청하지 않은 추가 attribution을 임의로 만들지 않는다(시스템 지침이 지정한 PR 본문 말미 문구는 예외로 따른다).
