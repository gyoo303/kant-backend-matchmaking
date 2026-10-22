#!/usr/bin/env node
// docs/PIPELINE.md(산출물 레지스트리)를 읽어 단계별 입력·산출물을 점검한다.
//
// 사용법:
//   node scripts/check-handoff.mjs <STAGE> [--ticket T]        # 실행 전: 필수 입력 확인
//   node scripts/check-handoff.mjs <STAGE> --post [--ticket T]  # 실행 후: 산출물 확인
// STAGE: PM | ARCH | DB | BE | FE | QA | UX
// DB·BE·FE·QA의 실행 전 점검은 --ticket이 필요하다. HANDOFF "선행" 열의 티켓 브리핑을 필수 입력으로 본다.
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

const usage = () => {
  console.error('사용법: node scripts/check-handoff.mjs <PM|ARCH|DB|BE|FE|QA|UX> [--post] [--ticket TKT-XX-01]');
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

// HANDOFF 표의 티켓 행: | TKT | … | 선행 |  (선행은 전체 ID를 쉼표로 나열, 없으면 —)
const readPredecessors = () => {
  const predecessors = new Map();
  if (!existsSync(HANDOFF_PATH)) return predecessors;
  for (const line of readFileSync(HANDOFF_PATH, 'utf-8').split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 4 || !/^TKT-/.test(cells[1])) continue;
    predecessors.set(cells[1], cells[cells.length - 2].match(TICKET_PATTERN) ?? []);
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
  if (status === 'blocked') return { id: row.id, problem: `${row.id} status: blocked — ${file}` };
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
      console.log(`[${stage}] 선행 티켓 브리핑을 점검하려면 --ticket이 필요하다 (예: --ticket TKT-${stage}-01)`);
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

  console.log(`[${stage}] ${post ? '산출물' : '필수 입력'} ${rows.length}개 점검${predecessorNote}`);
  for (const { problem } of blocking) console.log(`  ✗ ${problem}`);
  for (const { problem } of warnings) console.log(`  ! ${problem} (경고: 진행은 가능, 브리핑에 미배포로 기록)`);

  const pending = post ? [] : pendingDecisions(stage);
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
