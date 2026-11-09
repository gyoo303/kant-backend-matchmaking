#!/usr/bin/env node
// docs/PIPELINE.md(산출물 레지스트리)를 읽어 단계별 입력·산출물을 점검한다.
//
// 사용법:
//   node scripts/check-handoff.mjs <STAGE> [--ticket T]        # 실행 전: 필수 입력 확인
//   node scripts/check-handoff.mjs <STAGE> --post [--ticket T]  # 실행 후: 산출물 확인
// STAGE: PM | ARCH | DB | BE | FE | QA | UX
// DB·BE·FE·QA의 실행 전 점검은 --ticket이 필요하다. HANDOFF "선행" 열의 티켓 브리핑을 필수 입력으로 본다.
// 실행 전 점검은 docs/change-requests.md의 변경 요청(CR)도 본다(PIPELINE.md §2-9): 대상 단계가 앞인 '제안' CR은 막고,
// '승인'·미반영 CR은 경고한다.
// 종료 코드: 0 = 진행 가능, 1 = 막힘, 64 = 사용법 오류. 마지막 줄은 항상 `STATUS: ...`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const STAGES = ['PM', 'ARCH', 'DB', 'BE', 'FE', 'QA', 'UX'];
const STAGE_PATTERN = /\b(PM|ARCH|DB|BE|FE|QA|UX)\b/g;
const TICKET_STAGES = ['DB', 'BE', 'FE', 'QA'];
const REGISTRY_PATH = 'docs/PIPELINE.md';
const HANDOFF_PATH = 'docs/02-arch/HANDOFF.md';
const MAP_HEADING = '## 디렉토리 지도';
const PREDECESSOR_MARK = '선행';
const TICKET_PATTERN = /TKT-(?:DB|BE|FE|QA)-[A-Z0-9-]*[A-Z0-9]/g;
const PROFILE_PATH = 'docs/00-inputs/project-profile.md';
const SCOPE_PATH = 'docs/01-pm/04-scope.md';
const CHANGE_REQUEST_PATH = 'docs/change-requests.md';
// 변경 요청의 단계 순서. '사람'은 프로파일(사람이 고침)이다. CR 대상은 사람·PM·ARCH뿐이다(PIPELINE.md §2-9).
const CHANGE_REQUEST_ORDER = ['사람', 'PM', 'ARCH', 'DB', 'BE', 'FE', 'QA'];
const CHANGE_REQUEST_TARGETS = ['사람', 'PM', 'ARCH'];
const CHANGE_REQUEST_STATUS = /^(제안|승인|거절|반영됨)/;

const usage = () => {
  console.error('사용법: node scripts/check-handoff.mjs <PM|ARCH|DB|BE|FE|QA|UX> [--post] [--ticket TKT-XX-M1-01]');
  process.exit(64);
};

const ticketStage = (ticket) => ticket.match(/^TKT-(DB|BE|FE|QA)-/)?.[1] ?? null;

const parseArgs = (argv) => {
  const stage = argv[0]?.toUpperCase();
  if (!STAGES.includes(stage)) usage();
  const ticketIndex = argv.indexOf('--ticket');
  const ticket = ticketIndex === -1 ? null : argv[ticketIndex + 1];
  if (ticketIndex !== -1 && !ticket) usage();
  return { stage, post: argv.includes('--post'), ticket };
};

const stageCodes = (cell) => [...new Set(cell.match(STAGE_PATTERN) ?? [])];

// 레지스트리 표의 각 행: | ID | `경로` | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
const readRegistry = () => {
  if (!existsSync(REGISTRY_PATH)) {
    console.log(`STATUS: BLOCKED_BY_MISSING REGISTRY (${REGISTRY_PATH} 없음)`);
    process.exit(1);
  }
  return readFileSync(REGISTRY_PATH, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 7 && /^[A-Z]+-[A-Z0-9-]+$/.test(cells[1]))
    .map((cells) => ({
      id: cells[1],
      path: cells[2].match(/`([^`]+)`/)?.[1] ?? '',
      producers: stageCodes(cells[3]),
      requiredBy: stageCodes(cells[4]),
      // `읽는 단계 (필수)`가 '선행'인 행: 점검하는 티켓의 HANDOFF 선행 티켓이 이 단계일 때만 필수
      byPredecessor: cells[4].includes(PREDECESSOR_MARK),
    }))
    .filter((row) => row.path);
};

const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.replace(/[`*]/g, '').trim());

// HANDOFF 티켓 목록 표: 헤더(`| TKT | … | 선행 |`)에서 "선행" 열 위치를 찾고, 그 표 안의 행만 읽는다.
// 선행 칸은 전체 ID를 쉼표로 나열, 없으면 —. 같은 티켓이 다른 표에 또 나오면 처음 읽은 행을 쓴다.
const readPredecessors = () => {
  const predecessors = new Map();
  if (!existsSync(HANDOFF_PATH)) return predecessors;
  let column = -1;
  for (const line of readFileSync(HANDOFF_PATH, 'utf-8').split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) {
      column = -1; // 표가 끝났다
      continue;
    }
    const cells = tableCells(line);
    if (cells[0] === 'TKT' && cells.includes('선행')) {
      column = cells.indexOf('선행');
      continue;
    }
    if (column === -1 || !/^TKT-/.test(cells[0]) || predecessors.has(cells[0])) continue;
    predecessors.set(cells[0], (cells[column] ?? '').match(TICKET_PATTERN) ?? []);
  }
  return predecessors;
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `<TKT>`, `<slug>`, `xxx`, `YYYY-MM-DD` 같은 자리표시자는 "아무 이름"으로 본다.
const placeholderToRegex = (name) =>
  new RegExp(
    '^' +
      escapeRegex(name)
        .replace(/<[^>]*>/g, '.+')
        .replace(/YYYY-MM-DD/g, '\\d{4}-\\d{2}-\\d{2}')
        .replace(/xxx/g, '.+') +
      '$',
  );

const findFiles = (path) => {
  if (path.endsWith('/')) {
    return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0 ? [path] : [];
  }
  const dir = dirname(path);
  if (!existsSync(dir)) return [];
  const pattern = placeholderToRegex(basename(path));
  return readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => join(dir, name).replace(/\\/g, '/'));
};

const frontMatterStatus = (file) => {
  const content = readFileSync(file, 'utf-8');
  if (!content.startsWith('---')) return null;
  return content.match(/^status:\s*(\w+)/m)?.[1] ?? null;
};

const frontMatterTickets = (file) => {
  const content = readFileSync(file, 'utf-8');
  if (!content.startsWith('---')) return [];
  return content.match(/^tickets:\s*\[([^\]]*)\]/m)?.[1].match(TICKET_PATTERN) ?? [];
};

const frontMatterBlockedTickets = (file) => {
  const content = readFileSync(file, 'utf-8');
  if (!content.startsWith('---')) return null;
  const match = content.match(/^blocked_tickets:\s*\[([^\]]*)\]/m);
  return match ? match[1].match(TICKET_PATTERN) ?? [] : null;
};

const isBriefing = (path) => /^docs\/0[3-6]-[^/]+\/briefing/.test(path);

// 선행 티켓 하나의 브리핑: 파일이 있고, blocked가 아니고, 머리말 tickets에 그 티켓이 있어야 한다.
const checkPredecessor = (predecessor, registry) => {
  const stage = ticketStage(predecessor);
  const row = registry.find((item) => item.byPredecessor && item.producers.includes(stage));
  if (!row) return { id: predecessor, problem: `${predecessor}: 레지스트리에 ${stage} 브리핑 행('선행') 없음` };

  const path = row.path.replace(/<TKT[^>]*>/g, predecessor);
  const [file] = findFiles(path);
  if (!file) return { id: row.id, problem: `${row.id} 없음: ${path} (선행 ${predecessor})` };

  const status = frontMatterStatus(file);
  if (status === null) return { id: row.id, problem: `${row.id} 머리말 없음: ${file} (PIPELINE.md §4)` };
  // 누적 브리핑은 blocked_tickets가 있으면 그 티켓들만 막힌 것으로 본다(없으면 파일 전체가 막힌 것으로 본다).
  const blockedTickets = frontMatterBlockedTickets(file);
  const predecessorBlocked = blockedTickets ? blockedTickets.includes(predecessor) : status === 'blocked';
  if (predecessorBlocked) return { id: row.id, problem: `${row.id} ${predecessor} 막힘 — ${file}` };
  if (!frontMatterTickets(file).includes(predecessor)) {
    return { id: row.id, problem: `${row.id} 미완료: ${file} 머리말 tickets에 ${predecessor} 없음` };
  }
  return null;
};

// 행 하나를 점검하고 문제를 problems에 담는다.
const checkRow = (row, { ticket, post }) => {
  const path = post && ticket ? row.path.replace(/<TKT[^>]*>/g, ticket) : row.path;
  const files = findFiles(path);
  if (files.length === 0) return `${row.id} 없음: ${path}`;

  if (path === 'AGENTS.md' && !readFileSync(path, 'utf-8').includes(MAP_HEADING)) {
    return `${row.id} 미작성: AGENTS.md에 '${MAP_HEADING}' 섹션 없음`;
  }
  if (isBriefing(path)) {
    for (const file of files) {
      const status = frontMatterStatus(file);
      if (status === null) return `${row.id} 머리말 없음: ${file} (PIPELINE.md §4)`;
      if (status === 'blocked') return `${row.id} status: blocked — ${file}`;
      // 누적 브리핑(경로에 <TKT>가 없음)은 실행 후 점검에서 이번 티켓이 머리말 tickets에 들어갔는지 본다.
      if (post && ticket && !row.path.includes('<TKT') && !frontMatterTickets(file).includes(ticket)) {
        return `${row.id} 머리말 tickets에 ${ticket} 없음: ${file}`;
      }
    }
  }
  return null;
};

// 사람 승인 게이트: 승인 전 결정이 남아 있으면 다음 단계로 넘어가지 않는다.
const pendingDecisions = (stage) => {
  const found = [];
  const decisionLog = 'docs/01-pm/decision-log.md';
  if (stage === 'ARCH' && existsSync(decisionLog)) {
    const pending = readFileSync(decisionLog, 'utf-8').match(/D-\d+[^\n]*\[PENDING\]/g) ?? [];
    found.push(...pending.map((line) => line.match(/D-\d+/)[0]));
  }
  const adrDir = 'docs/02-arch/adr';
  if (['DB', 'BE', 'FE', 'QA'].includes(stage) && existsSync(adrDir)) {
    for (const name of readdirSync(adrDir)) {
      if (/상태:\s*Proposed/.test(readFileSync(join(adrDir, name), 'utf-8'))) found.push(name.replace(/\.md$/, ''));
    }
  }
  return found;
};

// 변경 요청 표: 헤더 행(`| CR | … | 대상 단계 | 대상 | … | 상태 | …`)에서 열 위치를 찾고, 그 표의 `CR-` 행만 읽는다.
// 읽을 수 없는 행(열 수 불일치 등)은 broken으로 표시해 점검이 막는 쪽으로 다루게 한다.

const readChangeRequests = () => {
  if (!existsSync(CHANGE_REQUEST_PATH)) return [];
  const requests = [];
  let columns = null;
  for (const line of readFileSync(CHANGE_REQUEST_PATH, 'utf-8').split(/\r?\n/)) {
    const isTableLine = line.trim().startsWith('|');
    if (!columns) {
      if (isTableLine && tableCells(line)[0] === 'CR') {
        const header = tableCells(line);
        columns = { count: header.length, target: header.indexOf('대상 단계'), what: header.indexOf('대상'), status: header.indexOf('상태') };
      }
      continue;
    }
    if (!isTableLine) break; // 첫 표가 끝나면 상세 절은 읽지 않는다
    const cells = tableCells(line);
    const id = cells[0].match(/^CR-\d+/)?.[0];
    if (!id) continue; // 구분선 등
    const broken = cells.length !== columns.count || columns.target < 0 || columns.status < 0;
    requests.push({
      id,
      raw: line,
      broken,
      target: broken ? '' : cells[columns.target],
      what: broken || columns.what < 0 ? '' : cells[columns.what],
      status: broken ? '' : cells[columns.status],
    });
  }
  return requests;
};

const normalizeTarget = (text) => {
  const match = text.match(/^(사람|pm|arch|db|be|fe|qa)/i);
  return match ? (match[1] === '사람' ? '사람' : match[1].toUpperCase()) : null;
};

// 점검하는 단계보다 대상 단계가 앞인 '제안' CR은 막고, '승인'·미반영 CR은 경고한다.
// 대상 단계나 상태를 읽을 수 없는 행은, '제안'이 들어 있으면 막는다(fail-closed).
const changeRequestChecks = (stage) => {
  const result = { pending: [], warnings: [] };
  const stageOrder = CHANGE_REQUEST_ORDER.indexOf(stage);
  if (stageOrder === -1) return result; // UX
  for (const request of readChangeRequests()) {
    const mentionsProposal = request.raw.includes('제안');
    if (request.broken) {
      result.warnings.push(`${request.id}: 표 행을 읽을 수 없음(열 수·헤더 확인) — ${CHANGE_REQUEST_PATH}`);
      if (mentionsProposal) result.pending.push(request.id);
      continue;
    }
    const target = normalizeTarget(request.target);
    const status = request.status.match(CHANGE_REQUEST_STATUS)?.[1] ?? null;
    if (!target || !CHANGE_REQUEST_TARGETS.includes(target)) {
      result.warnings.push(`${request.id}: 대상 단계 '${request.target}'은(는) CR 대상이 아님(사람·PM·ARCH)`);
      if (status === '제안' || (!status && mentionsProposal)) result.pending.push(request.id);
      continue;
    }
    if (!status) {
      result.warnings.push(`${request.id}: 상태 '${request.status}'를 읽을 수 없음(제안·승인·거절·반영됨)`);
      if (mentionsProposal) result.pending.push(request.id);
      continue;
    }
    const targetOrder = CHANGE_REQUEST_ORDER.indexOf(target);
    const where = request.what ? ` (${request.what})` : '';
    if (status === '제안' && targetOrder < stageOrder) {
      result.pending.push(request.id);
    } else if (status === '승인' && targetOrder < stageOrder) {
      result.warnings.push(`${request.id}: 승인됐지만 ${target} 미반영${where} — 상세 절을 읽고 그 내용을 따른다`);
    } else if (status === '승인' && targetOrder === stageOrder) {
      result.warnings.push(`${request.id}: 이 단계가 먼저 반영할 변경 요청${where}`);
    }
  }
  return result;
};

// 사이클 일치(PIPELINE.md §6): 프로파일 §1의 사이클과 PM 요약 블록·HANDOFF 머리의 "현재 사이클"이 다르면
// 앞 단계가 이번 사이클을 아직 끝내지 않은 것이다. 어느 한쪽에 값이 없으면(예전 형식 문서) 확인하지 않는다.
const readCycle = (path, pattern) => (existsSync(path) ? readFileSync(path, 'utf-8').match(pattern)?.[1] ?? null : null);

// 최종 확인(PIPELINE.md §5.2): PM 요약 블록·HANDOFF 머리에 "최종 확인: 대기"가 남아 있으면 다음 단계는 시작하지 않는다.
// 줄이 없으면(예전 형식) 확인하지 않는다.
const finalConfirmationCheck = (stage) => {
  const target = stage === 'ARCH' ? { id: 'FINAL-PM', path: SCOPE_PATH } : TICKET_STAGES.includes(stage) ? { id: 'FINAL-ARCH', path: HANDOFF_PATH } : null;
  if (!target || !existsSync(target.path)) return null;
  const value = readFileSync(target.path, 'utf-8').match(/최종 확인:\s*\**\s*([^\s*|(]+)/)?.[1];
  return value && value !== '확인됨' ? target.id : null;
};

const cycleCheck = (stage, ticket) => {
  const target = stage === 'ARCH' ? { id: 'PM-SCOPE', path: SCOPE_PATH } : TICKET_STAGES.includes(stage) ? { id: 'AR-HAND', path: HANDOFF_PATH } : null;
  if (!target) return null;
  const profileCycle = readCycle(PROFILE_PATH, /^\s*-\s*사이클:\s*`?(C\d+)`?/m);
  const documentCycle = readCycle(target.path, /현재 사이클[^\n]*?(C\d+)/);
  if (!profileCycle || !documentCycle || profileCycle === documentCycle) return null;
  // 이전 사이클의 남은 티켓(티켓의 사이클 = HANDOFF 사이클)은 다음 사이클 설계 중에도 실행할 수 있다. 사이클 표시가 없는 티켓은 C1이다.
  if (ticket && (ticket.match(/^TKT-[A-Z]+-(C\d+)-/)?.[1] ?? 'C1') === documentCycle) return null;
  return { id: target.id, problem: `${target.id} 사이클 불일치: 프로파일 ${profileCycle}, ${target.path} ${documentCycle} (PIPELINE.md §6)` };
};

const main = () => {
  const { stage, post, ticket } = parseArgs(process.argv.slice(2));
  const registry = readRegistry();
  const rows = registry.filter((row) => (post ? row.producers : row.requiredBy).includes(stage));

  const blocking = [];
  const warnings = [];
  for (const row of rows) {
    const problem = checkRow(row, { ticket, post });
    if (!problem) continue;
    // UX 산출물은 사람 승인 후 배포되므로 없어도 막지 않는다(PIPELINE.md §3.5).
    const softOnly = row.producers.includes('UX') || (post && stage === 'UX');
    (softOnly ? warnings : blocking).push({ id: row.id, problem });
  }

  // 선행 티켓 브리핑 (DB·BE·FE·QA 실행 전, PIPELINE.md §2-1)
  let predecessorNote = '';
  if (!post && TICKET_STAGES.includes(stage)) {
    if (!ticket) {
      console.log(`[${stage}] 선행 티켓 브리핑을 점검하려면 --ticket이 필요하다 (예: --ticket TKT-${stage}-M1-01)`);
      console.log('STATUS: BLOCKED_BY_MISSING TICKET');
      process.exit(1);
    }
    if (ticketStage(ticket) !== stage) usage();
    const predecessors = readPredecessors().get(ticket);
    if (predecessors === undefined) {
      blocking.push({ id: 'AR-HAND', problem: `AR-HAND: ${HANDOFF_PATH}에 ${ticket} 행 없음` });
    } else {
      predecessorNote = ` (${ticket} 선행: ${predecessors.length > 0 ? predecessors.join(', ') : '없음'})`;
      for (const predecessor of predecessors) {
        const problem = checkPredecessor(predecessor, registry);
        if (problem) blocking.push(problem);
      }
    }
  }

  const cycleProblem = post ? null : cycleCheck(stage, ticket);
  if (cycleProblem) blocking.push(cycleProblem);

  console.log(`[${stage}] ${post ? '산출물' : '필수 입력'} ${rows.length}개 점검${predecessorNote}`);
  for (const { problem } of blocking) console.log(`  ✗ ${problem}`);
  for (const { problem } of warnings) console.log(`  ! ${problem} (경고: 진행은 가능, 브리핑에 미배포로 기록)`);

  const changeRequests = post ? { pending: [], warnings: [] } : changeRequestChecks(stage);
  for (const warning of changeRequests.warnings) console.log(`  ! ${warning}`);

  const finalPending = post ? null : finalConfirmationCheck(stage);
  const pending = post ? [] : [...pendingDecisions(stage), ...changeRequests.pending, ...(finalPending ? [finalPending] : [])];
  for (const id of pending) console.log(`  ✗ 승인 대기 결정: ${id}`);

  if (blocking.length > 0) {
    const ids = [...new Set(blocking.map((item) => item.id))].join(' ');
    console.log(post ? `STATUS: INCOMPLETE ${stage} ${ids}` : `STATUS: BLOCKED_BY_MISSING ${ids}`);
    process.exit(1);
  }
  if (pending.length > 0) {
    console.log(`STATUS: AWAITING_USER_DECISION ${pending.join(' ')}`);
    process.exit(1);
  }
  console.log(post ? `STATUS: DONE ${stage}` : `STATUS: READY ${stage}`);
};

main();
