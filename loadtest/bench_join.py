"""방 참가 부하 측정 스크립트 (도전 A 2단계 기준선 · 7단계 검증, docs/03-concurrency)

측정 전용 DB(`matchmaking_bench`)를 매 회차 비우고, 회원은 DB에 직접 넣고, 토큰은 JWT 비밀키로
미리 발급한다(로그인 bcrypt를 측정 구간에서 뺀다, HA-04). 방은 API로 만들어 도메인 규칙을 거친다.

시나리오
  s0  목록 조회 GET /api/rooms           — 쓰기 없는 요청의 처리량 기준
  s1  분산 참가 POST .../participants    — 방끼리 겹치지 않게 보내 처리량 한계를 찾는다
  s2  핫스팟 참가                         — 방장 1명 있는 방 하나에 N명이 동시에 참가, 정합성 확인
  s3  고정 속도 참가                      — 초당 R건(open loop)으로 목표 TPS의 응답 시간 확인
  s4  중복 요청                           — 회원마다 같은 방 k건 + 다른 방 k건을 동시에 (VC-07)
  s5  핫스팟 + 고정 속도 (목표 규모)      — 60 TPS 도중 핫스팟 100명 (VC-05·06)
  s6  핫스팟 + 고정 속도 (과부하)         — 120 TPS 도중 핫스팟 300명 (VC-06)

요청 시간 제한은 기본 5초다(화면의 AbortController와 같은 값, VC-02). 넘으면 status 0으로 센다.
기준선(2026-11-09)은 30초로 쟀다 — 다시 재려면 --timeout 30.

실행 (앱은 별도 터미널에서 측정 DB로 띄운다 — loadtest/README.md)
  uv run python loadtest/bench_join.py s1 --levels 10,50,100,200
"""

import argparse
import asyncio
import json
import os
import statistics
import time
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

import asyncpg
import httpx
import jwt

ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = Path(__file__).resolve().parent / "results"
DEFAULT_DB_URL = "postgresql://matchmaking:matchmaking@localhost:5432/matchmaking_bench"
TABLES = "participation_logs, participations, teams, rooms, token_blacklist, users"


# ── 설정 ──────────────────────────────────────────────────────────────


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET_KEY") or read_dotenv(ROOT / ".env").get("JWT_SECRET_KEY")
    if not secret:
        raise SystemExit("JWT_SECRET_KEY를 찾을 수 없습니다 (.env 또는 환경변수)")
    return secret


def bench_db_url() -> str:
    url = os.environ.get("BENCH_DATABASE_URL", DEFAULT_DB_URL)
    return url.replace("postgresql+asyncpg://", "postgresql://")  # asyncpg는 순수 URL을 쓴다


# ── 데이터 준비 ───────────────────────────────────────────────────────


@dataclass
class Member:
    user_id: int
    token: str


async def reset_db(conn: asyncpg.Connection) -> None:
    await conn.execute(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE")


async def create_members(conn: asyncpg.Connection, count: int, secret: str) -> list[Member]:
    # 로그인하지 않으므로 비밀번호 해시는 의미 없는 값 하나를 같이 쓴다
    records = [(f"b{i:06d}", f"b{i:06d}", "bench-no-login") for i in range(1, count + 1)]
    await conn.copy_records_to_table(
        "users", records=records, columns=["login_id", "nickname", "hashed_password"]
    )
    rows = await conn.fetch("SELECT id, login_id FROM users ORDER BY id")
    exp = datetime.now(UTC) + timedelta(hours=3)
    return [
        Member(
            row["id"],
            jwt.encode(
                {"sub": row["login_id"], "token_type": "access", "exp": exp},
                secret,
                algorithm="HS256",
            ),
        )
        for row in rows
    ]


def auth(member: Member) -> dict[str, str]:
    return {"Authorization": f"Bearer {member.token}"}


async def create_rooms(client: httpx.AsyncClient, hosts: list[Member]) -> list[int]:
    # 준비 단계(측정 밖). 동시 20개로 나눠 만든다
    sem = asyncio.Semaphore(20)

    async def one(i: int, host: Member) -> int:
        async with sem:
            res = await client.post("/api/rooms", json={"title": f"r{i}"}, headers=auth(host))
            res.raise_for_status()
            return res.json()["id"]

    return list(await asyncio.gather(*(one(i, h) for i, h in enumerate(hosts))))


async def integrity_report(conn: asyncpg.Connection) -> dict[str, int]:
    # 0이 아니면 정합성 위반 (CR-01·02, INV)
    checks = {
        "rooms_over_capacity": """
            SELECT count(*) FROM (SELECT room_id FROM participations
            GROUP BY room_id HAVING count(*) > 4) t""",
        "teams_over_capacity": """
            SELECT count(*) FROM (SELECT team_id FROM participations
            GROUP BY team_id HAVING count(*) > 2) t""",
        "duplicate_join_order": """
            SELECT count(*) FROM (SELECT room_id, join_order FROM participations
            GROUP BY room_id, join_order HAVING count(*) > 1) t""",
        "last_join_order_mismatch": """
            SELECT count(*) FROM rooms r WHERE r.deleted_at IS NULL AND r.last_join_order <>
            (SELECT coalesce(max(p.join_order), 0) FROM participations p WHERE p.room_id = r.id)""",
    }
    return {name: await conn.fetchval(sql) for name, sql in checks.items()}


# ── 측정 ──────────────────────────────────────────────────────────────


SLOW_NOTICE_MS = 3000  # 화면이 지연 안내로 바뀌는 시점 (VC-06a, ADR-014)
SERVER_LIMIT_MS = 4000  # 서버 응답 상한 (VC-06, 지연 예산 합계)


@dataclass
class Sample:
    status: int  # 0 = 연결 실패·시간 초과
    latency_ms: float
    started_at: float = 0.0  # time.perf_counter() 기준 출발 시각 (s5·s6에서 구간을 자를 때 쓴다)


@dataclass
class RunStats:
    label: str
    concurrency: int
    requests: int
    elapsed_s: float
    tps: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float
    statuses: dict[str, int]
    # 부하 발생기 프로세스 CPU (1코어 = 100%). 100%에 가까우면 발생기가 병목
    generator_cpu_pct: float
    over_3s: int = 0  # 3초 넘은 요청 수 = 화면에 지연 안내가 뜬 요청 (VC-06a)
    over_4s: int = 0  # 4초 넘은 요청 수 = 서버 상한 위반 (VC-06)
    integrity: dict[str, int] = field(default_factory=dict)
    extra: dict[str, object] = field(default_factory=dict)


def percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, max(0, round(pct / 100 * len(sorted_values)) - 1))
    return sorted_values[index]


def summarize(
    label: str, concurrency: int, samples: list[Sample], elapsed: float, cpu: float
) -> RunStats:
    latencies = sorted(s.latency_ms for s in samples)
    return RunStats(
        label=label,
        concurrency=concurrency,
        requests=len(samples),
        elapsed_s=round(elapsed, 3),
        tps=round(len(samples) / elapsed, 1) if elapsed else 0.0,
        p50_ms=round(statistics.median(latencies), 1) if latencies else 0.0,
        p95_ms=round(percentile(latencies, 95), 1),
        p99_ms=round(percentile(latencies, 99), 1),
        max_ms=round(latencies[-1], 1) if latencies else 0.0,
        statuses=dict(sorted(Counter(str(s.status) for s in samples).items())),
        generator_cpu_pct=round(cpu * 100, 1),
        over_3s=sum(1 for v in latencies if v > SLOW_NOTICE_MS),
        over_4s=sum(1 for v in latencies if v > SERVER_LIMIT_MS),
    )


async def timed(client: httpx.AsyncClient, method: str, url: str, headers: dict) -> Sample:
    # httpx의 timeout은 연결·읽기·풀 대기 "단계마다" 따로 걸려 합계가 넘을 수 있다.
    # 화면의 AbortController처럼 요청 "전체"에 한 번 더 건다 (new_client가 --timeout을 넣어 둔다)
    start = time.perf_counter()
    try:
        async with asyncio.timeout(client.timeout.read):
            res = await client.request(method, url, headers=headers)
        status = res.status_code
    except (httpx.HTTPError, TimeoutError):  # 연결 실패·시간 초과
        status = 0
    return Sample(status, (time.perf_counter() - start) * 1000, start)


async def closed_loop(
    client: httpx.AsyncClient, requests: list[tuple[str, str, dict]], concurrency: int
) -> tuple[list[Sample], float, float]:
    """동시 요청 수를 고정하고(closed loop) 요청 목록을 끝까지 보낸다."""
    queue = iter(requests)
    samples: list[Sample] = []

    async def worker() -> None:
        for method, url, headers in queue:  # 같은 이터레이터를 워커들이 나눠 가진다
            samples.append(await timed(client, method, url, headers))

    cpu_start, wall_start = time.process_time(), time.perf_counter()
    await asyncio.gather(*(worker() for _ in range(concurrency)))
    elapsed = time.perf_counter() - wall_start
    return samples, elapsed, (time.process_time() - cpu_start) / elapsed


async def warm_up(client: httpx.AsyncClient, member: Member) -> None:
    for _ in range(20):
        await client.get("/api/rooms", headers=auth(member))


def new_client(args: argparse.Namespace, connections: int) -> httpx.AsyncClient:
    limits = httpx.Limits(max_connections=connections, max_keepalive_connections=connections)
    return httpx.AsyncClient(base_url=args.base_url, limits=limits, timeout=args.timeout)


# ── 시나리오 ──────────────────────────────────────────────────────────


async def scenario_s0(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """목록 조회 처리량. 방 args.rooms개를 만들어 두고 GET /api/rooms를 반복한다."""
    results = []
    secret = jwt_secret()
    for level in args.levels:
        await reset_db(conn)
        members = await create_members(conn, args.rooms, secret)
        async with new_client(args, level + 10) as client:
            await create_rooms(client, members)
            await warm_up(client, members[0])
            reqs = [
                ("GET", "/api/rooms?page=1&size=10", auth(members[i % len(members)]))
                for i in range(args.requests)
            ]
            samples, elapsed, cpu = await closed_loop(client, reqs, level)
        stats = summarize("s0-list", level, samples, elapsed, cpu)
        stats.extra = {"rooms": args.rooms}
        results.append(stats)
        print_row(stats)
    return results


async def scenario_s1(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """분산 참가. 방 R개에 3명씩, i번째 요청은 i % R번 방으로 보내 같은 방이 겹치지 않게 한다."""
    results = []
    secret = jwt_secret()
    rooms_n = args.rooms
    for level in args.levels:
        await reset_db(conn)
        members = await create_members(conn, rooms_n * 4, secret)
        hosts, joiners = members[:rooms_n], members[rooms_n:]
        async with new_client(args, level + 10) as client:
            room_ids = await create_rooms(client, hosts)
            await warm_up(client, hosts[0])
            reqs = [
                ("POST", f"/api/rooms/{room_ids[i % rooms_n]}/participants", auth(joiner))
                for i, joiner in enumerate(joiners)
            ]
            samples, elapsed, cpu = await closed_loop(client, reqs, level)
        stats = summarize("s1-join-spread", level, samples, elapsed, cpu)
        stats.integrity = await integrity_report(conn)
        stats.extra = {"rooms": rooms_n}
        results.append(stats)
        print_row(stats)
    return results


async def scenario_s2(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """핫스팟. 방장 1명 있는 방 하나에 args.users명이 한꺼번에 참가한다(빈자리 3개)."""
    results = []
    secret = jwt_secret()
    for run in range(1, args.repeat + 1):
        await reset_db(conn)
        members = await create_members(conn, args.users + 1, secret)
        host, joiners = members[0], members[1:]
        async with new_client(args, args.users + 10) as client:
            (room_id,) = await create_rooms(client, [host])
            await warm_up(client, host)
            gate = asyncio.Event()  # 모두 준비시킨 뒤 동시에 출발

            url = f"/api/rooms/{room_id}/participants"

            async def fire(member: Member, gate: asyncio.Event = gate, url: str = url) -> Sample:
                await gate.wait()
                return await timed(client, "POST", url, auth(member))

            tasks = [asyncio.create_task(fire(m)) for m in joiners]
            await asyncio.sleep(0.2)
            cpu_start, wall_start = time.process_time(), time.perf_counter()
            gate.set()
            samples = list(await asyncio.gather(*tasks))
            elapsed = time.perf_counter() - wall_start
            cpu = (time.process_time() - cpu_start) / elapsed
        stats = summarize(f"s2-hotspot#{run}", args.users, samples, elapsed, cpu)
        stats.integrity = await integrity_report(conn)
        stats.extra = {
            "expected_success": 3,
            "participants_in_room": await conn.fetchval(
                "SELECT count(*) FROM participations WHERE room_id = $1", room_id
            ),
        }
        results.append(stats)
        print_row(stats)
    return results


async def scenario_s3(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """고정 속도 분산 참가(open loop). 초당 args.rate건을 args.duration초 동안 일정 간격으로 보낸다.
    응답을 기다리지 않고 다음 요청을 보내므로, 목표 속도를 버티는지와 그때의 응답 시간을 본다."""
    secret = jwt_secret()
    total = int(args.rate * args.duration)
    rooms_n = -(-total // 3)  # 방마다 3명
    await reset_db(conn)
    members = await create_members(conn, rooms_n * 4, secret)
    hosts, joiners = members[:rooms_n], members[rooms_n : rooms_n + total]
    async with new_client(args, 500) as client:
        room_ids = await create_rooms(client, hosts)
        await warm_up(client, hosts[0])

        async def send(i: int, joiner: Member, start: float) -> Sample:
            await asyncio.sleep(max(0.0, start + i / args.rate - time.perf_counter()))
            url = f"/api/rooms/{room_ids[i % rooms_n]}/participants"
            return await timed(client, "POST", url, auth(joiner))

        cpu_start, wall_start = time.process_time(), time.perf_counter()
        samples = list(
            await asyncio.gather(*(send(i, j, wall_start) for i, j in enumerate(joiners)))
        )
        elapsed = time.perf_counter() - wall_start
        cpu = (time.process_time() - cpu_start) / elapsed
    stats = summarize(f"s3-rate{args.rate:g}", 0, samples, elapsed, cpu)
    stats.integrity = await integrity_report(conn)
    stats.extra = {"target_rate": args.rate, "duration_s": args.duration, "rooms": rooms_n}
    print_row(stats)
    return [stats]


async def duplicate_report(
    conn: asyncpg.Connection, joiners: list[Member], outcomes: list[tuple[int, int, Sample]]
) -> dict[str, object]:
    """s4 판정 재료. 회원마다 현재 참가가 정확히 1건인지, 들어간 방으로 보낸 요청이 모두 200인지."""
    ids = [m.user_id for m in joiners]
    rows = await conn.fetch(
        "SELECT user_id, room_id FROM participations WHERE user_id = ANY($1::int[])", ids
    )
    current = {r["user_id"]: r["room_id"] for r in rows}
    # 같은 방 재요청은 200(변화 없음)이어야 한다 (D-006). 다른 방 요청은 400이 정상
    winner_not_200 = Counter(
        str(s.status) for uid, room, s in outcomes if current.get(uid) == room and s.status != 200
    )
    return {
        "members": len(ids),
        "members_without_room": len(ids) - len(current),  # 409·시간 초과가 없다면 0이어야 한다
        "winner_room_not_200": dict(winner_not_200),
    }


async def scenario_s4(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """중복 요청(VC-07). 회원 M명이 각자 '같은 방 k건 + 다른 방 k건'을 한꺼번에 보낸다.
    회원마다 전용 방 2개(A·B)를 줘서 다른 회원과는 겹치지 않고, 같은 회원의 요청끼리만 경합한다.
      - A끼리: 같은 방 잠금을 줄 서서 기다린다 → 첫 요청만 참가, 나머지는 200 변화 없음
      - A와 B: 서로 다른 방이라 잠금이 겹치지 않는다 → uq_participations_user_id가 막고 400"""
    results = []
    secret = jwt_secret()
    m, k = args.users, args.dup
    for run in range(1, args.repeat + 1):
        await reset_db(conn)
        members = await create_members(conn, m * 3, secret)
        hosts, joiners = members[: m * 2], members[m * 2 :]
        async with new_client(args, m * k * 2 + 10) as client:
            room_ids = await create_rooms(client, hosts)
            await warm_up(client, hosts[0])
            gate = asyncio.Event()

            async def fire(
                member: Member, room_id: int, gate: asyncio.Event = gate
            ) -> tuple[int, int, Sample]:
                await gate.wait()
                url = f"/api/rooms/{room_id}/participants"
                return member.user_id, room_id, await timed(client, "POST", url, auth(member))

            tasks = []
            for i, joiner in enumerate(joiners):
                room_a, room_b = room_ids[2 * i], room_ids[2 * i + 1]
                for _ in range(k):
                    tasks.append(asyncio.create_task(fire(joiner, room_a)))
                    tasks.append(asyncio.create_task(fire(joiner, room_b)))
            await asyncio.sleep(0.2)
            cpu_start, wall_start = time.process_time(), time.perf_counter()
            gate.set()
            outcomes = list(await asyncio.gather(*tasks))
            elapsed = time.perf_counter() - wall_start
            cpu = (time.process_time() - cpu_start) / elapsed
        stats = summarize(f"s4-duplicate#{run}", len(tasks), [o[2] for o in outcomes], elapsed, cpu)
        stats.integrity = await integrity_report(conn)
        stats.extra = {"dup_per_room": k, **await duplicate_report(conn, joiners, outcomes)}
        results.append(stats)
        print_row(stats)
    return results


async def scenario_mixed(args: argparse.Namespace, conn: asyncpg.Connection) -> list[RunStats]:
    """핫스팟 + 고정 속도 동시 실행 (s5 목표 규모, s6 과부하).
    배경: s3처럼 초당 rate건 분산 참가를 duration초 동안.
    핫스팟: hotspot_at초에 방 하나(빈자리 3개)로 users명이 한꺼번에 참가.
    VC-05는 '핫스팟이 진행되는 동안 출발한 배경 요청'만 떼어 판정한다.
    결과는 세 줄: 배경 전체 / 핫스팟 중 배경 / 핫스팟."""
    if args.hotspot_at >= args.duration:
        raise SystemExit("--hotspot-at은 --duration보다 작아야 합니다")
    secret = jwt_secret()
    prefix = args.scenario
    total = int(args.rate * args.duration)
    rooms_n = -(-total // 3)  # 배경 방마다 3명
    await reset_db(conn)
    members = await create_members(conn, rooms_n * 4 + 1 + args.users, secret)
    hosts, background = members[:rooms_n], members[rooms_n : rooms_n + total]
    hot_host, hot_joiners = members[rooms_n * 4], members[rooms_n * 4 + 1 :]
    async with new_client(args, 500 + args.users) as client:
        room_ids = await create_rooms(client, [*hosts, hot_host])
        hot_room = room_ids.pop()
        await warm_up(client, hosts[0])

        async def send(i: int, joiner: Member, start: float) -> Sample:
            await asyncio.sleep(max(0.0, start + i / args.rate - time.perf_counter()))
            url = f"/api/rooms/{room_ids[i % rooms_n]}/participants"
            return await timed(client, "POST", url, auth(joiner))

        async def hot(member: Member, at: float) -> Sample:
            # 모두 같은 시각까지 잠들었다가 함께 깨어난다 (s2의 gate와 같은 효과)
            await asyncio.sleep(max(0.0, at - time.perf_counter()))
            url = f"/api/rooms/{hot_room}/participants"
            return await timed(client, "POST", url, auth(member))

        cpu_start, wall_start = time.process_time(), time.perf_counter()
        hot_at = wall_start + args.hotspot_at
        bg_samples, hot_samples = await asyncio.gather(
            asyncio.gather(*(send(i, j, wall_start) for i, j in enumerate(background))),
            asyncio.gather(*(hot(m, hot_at) for m in hot_joiners)),
        )
        elapsed = time.perf_counter() - wall_start
        cpu = (time.process_time() - cpu_start) / elapsed

    # 핫스팟 구간 = 첫 핫스팟 요청 출발 ~ 마지막 핫스팟 응답 도착
    hot_start = min(s.started_at for s in hot_samples)
    hot_end = max(s.started_at + s.latency_ms / 1000 for s in hot_samples)
    window = hot_end - hot_start
    during = [s for s in bg_samples if hot_start <= s.started_at <= hot_end]
    common = {
        "target_rate": args.rate,
        "duration_s": args.duration,
        "hotspot_users": args.users,
        "hotspot_at_s": args.hotspot_at,
        "hotspot_window_s": round(window, 3),
    }
    bg_stats = summarize(f"{prefix}-background", 0, list(bg_samples), elapsed, cpu)
    bg_stats.integrity = await integrity_report(conn)
    bg_stats.extra = dict(common)
    during_stats = summarize(f"{prefix}-bg-during-hot", 0, during, window, cpu)
    during_stats.extra = dict(common)
    hot_stats = summarize(f"{prefix}-hotspot", args.users, list(hot_samples), window, cpu)
    hot_stats.extra = {
        **common,
        "expected_success": 3,
        "participants_in_room": await conn.fetchval(
            "SELECT count(*) FROM participations WHERE room_id = $1", hot_room
        ),
    }
    results = [bg_stats, during_stats, hot_stats]
    for stats in results:
        print_row(stats)
    return results


# ── 출력 ──────────────────────────────────────────────────────────────


def print_row(s: RunStats) -> None:
    line = (
        f"{s.label:<16} c={s.concurrency:<4} n={s.requests:<5} tps={s.tps:<7} "
        f"p50={s.p50_ms:<7} p95={s.p95_ms:<7} p99={s.p99_ms:<7} max={s.max_ms:<7} "
        f">3s={s.over_3s} >4s={s.over_4s} gen_cpu={s.generator_cpu_pct}% status={s.statuses}"
    )
    if s.integrity:
        line += f" integrity={s.integrity}"
    if s.extra.get("participants_in_room") is not None:
        line += f" participants={s.extra['participants_in_room']}"
    if s.extra.get("members_without_room") is not None:
        line += (
            f" no_room={s.extra['members_without_room']}"
            f" winner_not_200={s.extra['winner_room_not_200']}"
        )
    print(line, flush=True)


def save(args: argparse.Namespace, results: list[RunStats]) -> Path:
    RESULTS_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = RESULTS_DIR / f"{args.scenario}-{args.tag + '-' if args.tag else ''}{stamp}.json"
    payload = {
        "scenario": args.scenario,
        "tag": args.tag,
        "measured_at": datetime.now(UTC).isoformat(),
        "args": {k: v for k, v in vars(args).items() if k != "func"},
        "runs": [asdict(r) for r in results],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("scenario", choices=["s0", "s1", "s2", "s3", "s4", "s5", "s6"])
    p.add_argument("--base-url", default="http://127.0.0.1:8001")
    p.add_argument("--levels", default="10,50,100,200", help="s0·s1 동시 요청 수 목록")
    p.add_argument("--rooms", type=int, default=1000, help="s1 방 수(요청 = 방×3), s0 방 수")
    p.add_argument("--requests", type=int, default=2000, help="s0 요청 수")
    p.add_argument(
        "--users",
        type=int,
        default=None,
        help="s2·s5·s6 핫스팟 인원(기본 100, s6은 300), s4 회원 수(기본 20)",
    )
    p.add_argument("--repeat", type=int, default=3, help="s2·s4 반복 횟수")
    p.add_argument("--dup", type=int, default=3, help="s4 회원 1명이 방마다 보내는 요청 수(k)")
    p.add_argument(
        "--rate", type=float, default=None, help="s3·s5·s6 초당 요청 수(기본 60, s6은 120)"
    )
    p.add_argument("--duration", type=float, default=60.0, help="s3·s5·s6 측정 시간(초)")
    p.add_argument("--hotspot-at", type=float, default=10.0, help="s5·s6 핫스팟 출발 시각(초)")
    p.add_argument(
        "--timeout", type=float, default=5.0, help="요청 시간 제한(초). 기준선은 30으로 쟀다"
    )
    p.add_argument("--tag", default="", help="결과 파일 이름 꼬리표 (예: baseline, adr013)")
    args = p.parse_args()
    args.levels = [int(x) for x in args.levels.split(",") if x]
    # 시나리오마다 다른 기본값 — 명령줄에 직접 주면 그 값을 쓴다
    if args.users is None:
        args.users = {"s4": 20, "s6": 300}.get(args.scenario, 100)
    if args.rate is None:
        args.rate = 120.0 if args.scenario == "s6" else 60.0
    return args


async def main() -> None:
    args = parse_args()
    conn = await asyncpg.connect(bench_db_url())
    try:
        runner = {
            "s0": scenario_s0,
            "s1": scenario_s1,
            "s2": scenario_s2,
            "s3": scenario_s3,
            "s4": scenario_s4,
            "s5": scenario_mixed,
            "s6": scenario_mixed,
        }[args.scenario]
        results = await runner(args, conn)
    finally:
        await conn.close()
    print(f"saved: {save(args, results)}")


if __name__ == "__main__":
    asyncio.run(main())
