#!/usr/bin/env bash
# 파이프라인 단계 하나를 헤드리스로 실행한다: 입력 점검 → 스킬 실행 → 산출물 점검.
#
# 사용법: scripts/run-stage.sh <PM|ARCH|DB|BE|FE|QA|UX> [TKT-ID] [추가 지시]
#   예) scripts/run-stage.sh DB TKT-DB-M3-01
#
# 환경변수:
#   CLAUDE_BIN   claude 실행 파일 (기본: claude)
#   CLAUDE_ARGS  claude -p에 넘길 옵션 (기본: --permission-mode acceptEdits)
#   UX_SKILL     UX 단계에 쓸 스킬 이름 (프로젝트마다 다름, UX 단계를 쓸 때만)
#
# 추가 지시 관례(PIPELINE.md §5.2): "CR 반영만" — 그 단계를 대상으로 한 승인 CR만 반영하고 끝낸다.
#
# 종료 코드: 0 완료 / 1 입력 부족·승인 대기로 시작 안 함 / 2 에이전트가 STATUS로 멈춤 / 3 산출물 부족
set -euo pipefail

STAGE="${1:-}"
TICKET="${2:-}"
EXTRA="${3:-}"

STAGE="$(printf '%s' "$STAGE" | tr '[:lower:]' '[:upper:]')"  # bash 3.2(macOS 기본) 호환
case "$STAGE" in
  PM) SKILL=pm-agent ;;
  ARCH) SKILL=architect-agent ;;
  DB) SKILL=db-agent ;;
  BE) SKILL=backend-agent ;;
  FE) SKILL=frontend-impl ;;
  QA) SKILL=qa-agent ;;
  UX) SKILL="${UX_SKILL:-}"; [ -n "$SKILL" ] || { echo "UX 단계는 UX_SKILL 환경변수로 스킬 이름을 지정한다" >&2; exit 64; } ;;
  *) echo "사용법: scripts/run-stage.sh <PM|ARCH|DB|BE|FE|QA|UX> [TKT-ID] [추가 지시]" >&2; exit 64 ;;
esac
case "$STAGE" in
  DB|BE|FE|QA) [ -n "$TICKET" ] || { echo "구현 단계는 티켓 ID가 필요하다: scripts/run-stage.sh $STAGE <TKT-ID>" >&2; exit 64; } ;;
esac

cd "$(git rev-parse --show-toplevel)"

echo "== [$STAGE] 실행 전 점검"
node scripts/check-handoff.mjs "$STAGE" ${TICKET:+--ticket "$TICKET"} || exit 1

PROMPT="/$SKILL
${SKILL} 스킬의 지시대로 작업하라. 스킬 맨 위의 '0단계 — 시작 전 확인'부터 수행한다.
단계: ${STAGE}
티켓: ${TICKET:-없음}
${EXTRA}
멈춰야 하면 마지막 줄에 STATUS: 로 시작하는 한 줄을 출력하고 종료한다."

LOG_DIR=.pipeline-logs
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S)-${STAGE}${TICKET:+-$TICKET}.log"

read -r -a CLAUDE_OPTS <<< "${CLAUDE_ARGS:---permission-mode acceptEdits}"
echo "== [$STAGE] ${SKILL} 실행 (로그: $LOG)"
"${CLAUDE_BIN:-claude}" -p "$PROMPT" "${CLAUDE_OPTS[@]}" | tee "$LOG"

STATUS_LINE="$(grep -E '^STATUS: ' "$LOG" | tail -n 1 || true)"
case "$STATUS_LINE" in
  "STATUS: AWAITING_USER_DECISION"* | "STATUS: BLOCKED"*)
    echo "== [$STAGE] 에이전트가 멈춤: $STATUS_LINE"
    echo "   결정·입력을 채운 뒤 같은 명령으로 다시 실행한다."
    exit 2 ;;
esac

echo "== [$STAGE] 실행 후 점검"
node scripts/check-handoff.mjs "$STAGE" --post ${TICKET:+--ticket "$TICKET"} || exit 3
