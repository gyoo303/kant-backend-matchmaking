from passlib.context import CryptContext

# 비밀번호 해시에 bcrypt를 사용
pwd_context = CryptContext(schemes=['bcrypt'])

class PasswordHasher:
    # 비밀번호 원문을 저장용 해시로 변환
    @staticmethod
    def hash(raw:str) -> str:
        return pwd_context.hash(raw)

    # 입력한 비밀번호가 저장된 해시와 일치하는지 검사
    @staticmethod
    def verify(raw: str, hashed: str) -> bool:
        return pwd_context.verify(raw, hashed)

# create_access_token(data)
# create_refresh_token(data)
# decode_token(token)