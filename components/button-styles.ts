// 외곽선 버튼 모양 (design-system §2 "외곽선 버튼 테두리 --input", §5 함께 놓이는 두 번째 행동).
// components/ui/button의 outline 변형은 bg-background·border-border를 쓰고, 그 파일의 cn 패키지는 겹치는 클래스를 정리하지 않는다.
// 그래서 ghost 변형(배경·테두리 없음)에 이 클래스를 더해 쓴다: <Button variant="ghost" className={OUTLINE_BUTTON}> / buttonVariants({ variant: 'ghost', className: OUTLINE_BUTTON })
export const OUTLINE_BUTTON = 'border-input h-11 border px-5 text-base';

// 환불: 빨간 외곽선 — 관리자 화면에서만 (UX-D-09 예외)
export const DESTRUCTIVE_OUTLINE_BUTTON = 'border-destructive text-destructive hover:bg-destructive-soft h-11 border px-5 text-base';
