import 'server-only';
import { AppError, isErrorCode } from '@/lib/http/result';

type PostgrestLikeError = { code: string; message: string };

// RPC 오류 규칙(docs/03-db/briefing.md): P0001이면 message가 ErrorCode, 그 밖의 코드는 UNKNOWN
export function toAppError(apiId: string, error: PostgrestLikeError): AppError {
    if (error.code === 'P0001' && isErrorCode(error.message)) {
        return new AppError(error.message, `[${apiId}] ${error.message}`);
    }
    return new AppError('UNKNOWN', `[${apiId}] ${error.code} ${error.message}`);
}

// RPC가 ErrorCode 목록에 없는 신호(CODE_COLLISION 등)를 던졌는지 확인한다
export function isRpcSignal(error: PostgrestLikeError, signal: string): boolean {
    return error.code === 'P0001' && error.message === signal;
}
