from exceptions import DomainRuleError


# 아이디 형식 위반을 나타냄
class InvalidLoginIdError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("아이디는 4~20자의 영문 소문자와 숫자만 쓸 수 있습니다")


# 닉네임 형식 위반을 나타냄
class InvalidNicknameError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("닉네임은 2~12자의 한글, 영문, 숫자만 쓸 수 있습니다")


# 비밀번호 길이 위반을 나타냄
class InvalidPasswordError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("비밀번호는 8자 이상이어야 합니다")


# 아이디 중복을 나타냄
class DuplicateLoginIdError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 사용 중인 아이디입니다")


# 닉네임 중복을 나타냄
class DuplicateNicknameError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 사용 중인 닉네임입니다")


# 로그아웃에 사용할 수 없는 refresh 토큰을 나타냄
class InvalidRefreshTokenError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("유효하지 않거나 이미 만료된 토큰입니다")


# 이미 로그아웃한 토큰의 재처리를 나타냄
class AlreadyLoggedOutError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 로그아웃 처리된 토큰입니다")
