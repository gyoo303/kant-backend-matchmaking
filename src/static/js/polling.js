// 1초 폴링 (04-interfaces-api.md SEQ-13, 07-screens.md §2 폴링 규칙)
// - 진행 중인 조회가 있으면 이번 차례는 건너뛴다(요청이 겹치지 않음, AC-15-5).
// - 탭이 숨겨지면 멈추고, 다시 보이면 바로 한 번 조회한 뒤 재개한다(AC-15-6).
// - 조회마다 번호(seq)를 붙여, 멈춘 뒤나 더 새로운 조회가 시작된 뒤 도착한 응답은 버리게 한다.
//
// 사용법: const poller = startPolling(async function (isCurrent) {
//           const result = await apiRequest("GET", "/api/rooms");
//           if (!isCurrent()) return;   // 늦게 온 응답은 버린다
//           ...화면 갱신...
//         });
//         poller.stop();  // 해산·로그인 만료 등으로 더 조회하지 않을 때

function startPolling(fetchFn, intervalMs) {
  const interval = intervalMs || 1000;
  let timer = null;
  let running = false;
  let stopped = false;
  let seq = 0;

  async function tick() {
    if (running || stopped) {
      return;
    }
    running = true;
    seq += 1;
    const mySeq = seq;
    try {
      await fetchFn(function () {
        return !stopped && mySeq === seq;
      });
    } finally {
      running = false;
    }
  }

  function resume() {
    if (stopped || timer !== null) {
      return;
    }
    tick();
    timer = setInterval(tick, interval);
  }

  function pause() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  if (!document.hidden) {
    resume();
  }

  return {
    stop: function () {
      stopped = true;
      pause();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
