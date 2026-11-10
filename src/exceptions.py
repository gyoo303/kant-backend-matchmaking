# 도메인 예외의 부모 클래스들 — 외부 라이브러리 import 금지
# exception.py = domain/ 계층이 import하는 파일 = 여기 의존성은 domain 의존성 추가로 이어진다.
# -> 여기에 fastapi가 들어가면 도메인이 간접적으로 웹 프레임워크에 묶여서 GATE-02 위반
# -> 그래서 HTTP 상태 코드(HTTPException)도 이 파일에 적지 않는다:
#    "이 예외는 404" 연결은 bootstrap/error_handlers.py의 핸들러가 수행.

###### 1. 순수 파이썬 클래스 작성 ######
###### 2. 오류 응답형식 {"detail":...} ######
# https://github.com/gyoo303/kant-backend-matchmaking/blob/dev/docs/01-pm/decision-log.md
# D-027: 오류 응답 본문을 {"detail": "문구"} 하나로 [APPROVED by user, 2026-11-01]
# FastAPI 기본 오류(HTTPException·401·422)는 여전히 detail이라 형식이 둘로 갈림
# 선택 이유 1 (구현의 간편성) - FastAPI가 원래 내는 모양을 따르므로
#   우리 핸들러는 exc.message를 detail에 넣기만 하면 되고,
#   프레임워크·인증 라이브러리가 만드는 오류까지 손대지 않아도 형식이 하나로 맞는다
# 선택 이유 2 (학습 효율성) - 기본 예외 핸들러 덮어쓰기는 교안 범위 밖

# DomainError (도메인 예외 최상위 부모)
# 도메인 수준의 오류 = ValueError로 판단한다 => ValueError 상속한다.
class DomainError(ValueError):
    def __init__(self, message: str) -> None:
        super().__init__(message)

        # self.message -> bootstrap/error_handlers.py 핸들러가
        #   {"detail": exc.message}를 만들 때 가져오는 속성값
        self.message = message


# 상태 코드별 자식 3개 (400, 404, 410)
# DomainRuleError   → 400
class DomainRuleError(DomainError):
    """
    - HTTP 400 (bootstrap/error_handlers.py 전역 핸들러가 상태코드 연결)
    - 도메인 규칙 위반 (+서비스 이용 권한 포함)
    - 입력 규칙 위반, 정원 마감, 삭제된 방 변경요청, 방장/참가자 아닌데 요청 등
    ** HTTP 403(방장/참가자 권한오류)에 대응하는 클래스는 구현하지 않고 HTTP 400에 포함시킨다.
    """


# NotFoundError     → 404
class NotFoundError(DomainError):
    """
    - HTTP 404
    - 대상 없음, 정보 조회 권한 없음
    - 없는 방 조회, 인원수 0으로 삭제된 방 조회, 기타 정보 조회 권한 없음
    """


# GoneError         → 410
class GoneError(DomainError):
    """
    - HTTP 410
    - 게임 시작으로 해산된 방 상세 조회
    """


# AuthenticationError → 401
# 부모 클래스로 DomainError를 쓰지 않는다
# 인증 오류는 "누구인지 확인 불가"라서 DomainError와 성격 다르다.
class AuthenticationError(Exception):
    """토큰없음, 무효, 만료, 블랙리스트, 로그인 실패"""

    def __init__(self, message: str = "인증이 필요합니다") -> None:
        super().__init__(message)
        self.message = message

# ServiceBusyError -> 409
# 부모 클래스로 DomainError 쓰지 않는다
#   "정원 마감" 같은 규칙 위반 X
#   "지금은 서버가 시간 안에 처리하지 못했다"는 의미.
#   1) 방 잠금을 2초 넘게 기다림 (repository가 PostgreSQL 55P03 오류를 이 예외로 받는다.)
#   2) 커넥션 풀에서 1초 넘게 연결을 못 빌림 (전역 핸들러가 SQLAlchemy TimeoutError를 직접 409로)
class ServiceBusyError(Exception):
    """요청이 몰려 서버가 시간 내 처리하지 못함(재시도 시 될 수도 있음)"""

    def __init__(
            self, message: str = "요청이 많아 처리하지 못했습니다. 다시 시도해 주세요."
    ) -> None:
        super().__init__(message)
        self.message = message