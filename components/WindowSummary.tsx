import Link from 'next/link';
import { LAMP_BUTTON, NIGHT_OUTLINE_BUTTON, WindowScene, type WindowSceneKind } from './WindowScene';

export type WindowSummaryKind = WindowSceneKind;

// 마이페이지 창가 요약 (SCR-06): 작은 창가 + 다음 행동 하나
// 구독 없음(빈 창가)이면 [편지 띄우기], 그 밖에는 [창가로 가기] (AC-12-5)
export function WindowSummary({ kind, copy }: { kind: WindowSummaryKind; copy: string }) {
    return (
        <WindowScene kind={kind} copy={copy} compact>
            {kind === 'empty' ? (
                <Link href="/letters/new" className={`${LAMP_BUTTON} mt-5`}>
                    편지 띄우기
                </Link>
            ) : (
                <Link href="/mypage/window" className={`${NIGHT_OUTLINE_BUTTON} mt-5`}>
                    창가로 가기
                </Link>
            )}
        </WindowScene>
    );
}
