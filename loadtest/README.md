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

검증 기준(VC-01~05)과 판정 방법은 `docs/03-concurrency/02-criteria.md`에 있다.

| 시나리오 | 내용 |
|---|---|
| s0 | 목록 조회 `GET /api/rooms` — 쓰기 없는 요청의 처리량 기준 |
| s1 | 분산 참가 — 방 R개에 3명씩, 같은 방 요청이 동시에 겹치지 않게 보내 처리량 한계를 찾는다 |
| s2 | 핫스팟 — 방장 1명 있는 방 하나에 N명이 동시에 참가, 정합성 확인 |
| s3 | 고정 속도 참가 — 초당 R건을 일정 간격으로 보내(open loop) 목표 TPS에서의 응답 시간 확인 |

결과는 `loadtest/results/<시나리오>-<tag>-<시각>.json`에 남는다.

## 결과 읽는 법

- `tps`: 완료 요청 수 ÷ 걸린 시간
- `p50/p95/p99`: 응답 시간 백분위(ms)
- `gen_cpu`: 부하 발생기 프로세스의 CPU(1코어 = 100%). **100%에 가까우면 발생기가 병목**이라 그 구간의 수치는 앱의 한계가 아니다
- `integrity`: 0이 아니면 정합성 위반 (정원 초과·팀 정원 초과·join_order 중복·last_join_order 불일치)

## 측정 환경 (2026-11-09 기준선)

- CPU Intel Core Ultra 9 275HX 24코어, RAM 31.4GB, Windows 11
- 앱: Windows에서 uvicorn 워커 1개(uvloop 없음), 커넥션 풀 10+10, 요청 로그(INFO) 켜짐
- DB: Docker Desktop(WSL2) postgres:16, `max_connections=100`, `shared_buffers=128MB`
- 앱·DB·부하 발생기가 같은 PC에서 CPU를 나눠 쓴다 → 절대값이 아니라 **이 PC 안의 before/after 비교 기준**
