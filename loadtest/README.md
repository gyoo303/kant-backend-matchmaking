# loadtest — 방 참가 부하 측정 (도전 A)

`bench_join.py`는 측정 전용 DB를 매 회차 비우고 데이터를 새로 만든 뒤 요청을 보낸다. 개발용 DB(`matchmaking`)는 건드리지 않는다.

## 준비 (한 번만)

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking -c "create database matchmaking_bench owner matchmaking;"
```

## 1. 앱을 측정 DB로 띄우기 (터미널 1)

`--reload` 없이 워커 1개로 띄운다. 테이블은 lifespan이 만든다.

```bash
DATABASE_URL="postgresql+asyncpg://matchmaking:matchmaking@localhost:5432/matchmaking_bench" uv run uvicorn main:app --app-dir src --port 8001 --workers 1 --log-level warning --no-access-log
```

## 2. 측정 (터미널 2)

```bash
uv run python loadtest/bench_join.py s1 --levels 1,10,20,50,100,200 --rooms 1000 --tag baseline
```

```bash
uv run python loadtest/bench_join.py s0 --levels 1,10,50 --rooms 100 --requests 2000 --tag baseline
```

```bash
uv run python loadtest/bench_join.py s2 --users 100 --repeat 3 --tag baseline
```

```bash
uv run python loadtest/bench_join.py s3 --rate 60 --duration 60 --tag baseline
```

> 위 명령은 2026-11-09 기준선(잠금 없는 코드)용이다. 기준선은 요청 시간 제한 30초로 쟀으므로, 똑같이 다시 재려면 `--timeout 30`을 붙인다. 지금 기본값은 5초다.

## 3. 7단계 검증 (ADR-013 적용 후, `--tag adr013`)

앱은 위 1번과 **같은 조건**(워커 1개, 풀 10+10, `echo=True` 그대로)으로 띄운다. `.env`의 `DB_POOL_TIMEOUT=1`, `DB_LOCK_TIMEOUT_MS=2000`이 적용된다. 측정 DB에 새 unique 제약 2개가 있는지 먼저 확인한다. 없으면 측정 DB를 지우고 다시 만든다(`create_all`은 기존 테이블을 고치지 않는다).

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking_bench -c "select conname from pg_constraint where conrelid='participations'::regclass and contype='u'"
```

Windows 콘솔(cp949)에서 `--help`가 깨지면 먼저 `export PYTHONUTF8=1`을 실행한다.

```bash
uv run python loadtest/bench_join.py s1 --levels 1,10,20,50 --rooms 1000 --tag adr013
```

```bash
uv run python loadtest/bench_join.py s3 --rate 60 --duration 60 --tag adr013
```

```bash
uv run python loadtest/bench_join.py s2 --users 100 --repeat 3 --tag adr013
```

```bash
uv run python loadtest/bench_join.py s4 --users 20 --dup 3 --repeat 3 --tag adr013
```

```bash
uv run python loadtest/bench_join.py s5 --rate 60 --duration 60 --hotspot-at 10 --users 100 --tag adr013
```

```bash
uv run python loadtest/bench_join.py s6 --rate 120 --duration 60 --hotspot-at 10 --users 300 --tag adr013
```

s3는 3회 재서 중앙값을 쓴다(VC-03). 결과 보고서는 1차 `loadtest/adr013-report-2026-11-10.md`(echo 켬), 2차 `loadtest/adr015-report-2026-11-10.md`(echo 끔 + 동시 처리 상한)에 있다. 2차부터 s6은 `--rate 160`(echo 끔 처리 한계의 1.3배)을 쓴다.

> ⚠️ s6은 부하 발생기 프로세스 하나로는 초당 160건을 감당하지 못한다(발생기 CPU 93%, 앱 도착 약 47%). 결과 줄의 `gen_cpu`가 90%를 넘으면 그 회차는 앱 판정에 쓰지 않는다.

클라이언트가 먼저 끊었을 때 서버가 끝까지 처리하는지 확인하는 보조 실험은 다음 명령으로 실행한다. 결과가 `saved_in_db=1`이면 서버가 끝까지 처리한 것이다.

```bash
uv run python loadtest/probe_disconnect.py
```

 검증 기준(VC-01~08)과 판정 방법은 `docs/03-concurrency/02-criteria.md`에 있다.

| 시나리오 | 내용 | 판정 |
|---|---|---|
| s0 | 목록 조회 `GET /api/rooms` — 쓰기 없는 요청의 처리량 기준 | 참고 |
| s1 | 분산 참가 — 방 R개에 3명씩, 같은 방 요청이 동시에 겹치지 않게 보내 처리량 한계를 찾는다 | VC-04 |
| s2 | 핫스팟 — 방장 1명 있는 방 하나에 N명이 동시에 참가, 정합성 확인 | VC-01 |
| s3 | 고정 속도 참가 — 초당 R건을 일정 간격으로 보내(open loop) 목표 TPS에서의 응답 시간 확인 | VC-03 |
| s4 | 중복 요청 — 회원 M명이 각자 전용 방 A·B에 "A k건 + B k건"을 동시에 보낸다 | VC-07 |
| s5 | 목표 규모 — 60 TPS 분산 참가 도중 `--hotspot-at`초에 핫스팟 100명 | VC-05·06·06a·06b |
| s6 | 과부하 — 120 TPS 분산 참가 도중 핫스팟 300명 | VC-06·06a·06b(비율 기록) |

결과는 `loadtest/results/<시나리오>-<tag>-<시각>.json`에 남는다.

## 결과 읽는 법

- `tps`: 완료 요청 수 ÷ 걸린 시간
- `p50/p95/p99`: 응답 시간 백분위(ms)
- `>3s`·`>4s`: 3초를 넘은 요청 수(화면에 지연 안내가 뜬 요청, VC-06a)와 4초를 넘은 요청 수(서버 상한 위반, VC-06)
- `status`: 상태 코드별 건수. `0` = 5초 시간 초과 또는 연결 실패, `409` = 바빠서 거절(D-034)
- 시간 제한은 요청 **전체**에 건다(화면의 AbortController와 같음). 이벤트 루프가 바쁘면 `max`가 5초를 조금 넘을 수 있다
- `gen_cpu`: 부하 발생기 프로세스의 CPU(1코어 = 100%). **100%에 가까우면 발생기가 병목**이라 그 구간의 수치는 앱의 한계가 아니다
- `integrity`: 0이 아니면 정합성 위반 (정원 초과·팀 정원 초과·join_order 중복·last_join_order 불일치). ADR-013 이후 `join_order` 중복은 unique 제약이 막아 **500으로** 나타나므로 `status`의 5xx도 함께 본다
- s2·s5·s6 `participants`: 핫스팟 방의 최종 인원. 정답은 4
- s4 `no_room`: 아무 방에도 못 들어간 회원 수(409·시간 초과가 없으면 0). `winner_not_200`: 들어간 방으로 보낸 요청 중 200이 아닌 것(정답은 `{}`, D-006)
- s5·s6은 결과가 세 줄이다: `-background`(배경 전체), `-bg-during-hot`(핫스팟이 진행되는 동안 출발한 배경 요청, **VC-05는 이 줄로 판정**), `-hotspot`(핫스팟 요청)

## 측정 환경 (2026-11-09 기준선)

- CPU Intel Core Ultra 9 275HX 24코어, RAM 31.4GB, Windows 11
- 앱: Windows에서 uvicorn 워커 1개(uvloop 없음), 커넥션 풀 10+10, 요청 로그(INFO) 켜짐
- DB: Docker Desktop(WSL2) postgres:16, `max_connections=100`, `shared_buffers=128MB`
- 앱·DB·부하 발생기가 같은 PC에서 CPU를 나눠 쓴다 → 절대값이 아니라 **이 PC 안의 before/after 비교 기준**
