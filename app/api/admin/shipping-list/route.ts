import { NextResponse, type NextRequest } from 'next/server';
import { shippingListFileName, toShippingCsv } from '@/domains/shipping/shipping-list';
import { getCurrentMember } from '@/lib/auth/guards';
import { listShippingTargets, recordShippingListDownload } from '@/lib/data/admin';
import { errorCodeOf } from '@/lib/http/result';

// API-14 주소록 내려받기(SEQ-11, ADR-007): 조회 → CSV → 다운로드 기록 → 응답. 파일은 저장하지 않는다
export async function GET(request: NextRequest) {
    const member = await getCurrentMember();
    if (!member) return new NextResponse('로그인이 필요해요.', { status: 401 });
    if (member.role !== 'keeper') return new NextResponse('이 작업을 할 수 있는 권한이 없어요.', { status: 403 }); // AC-19-3

    try {
        const rows = await listShippingTargets();
        // 보낼 책이 없으면 파일 대신 안내(AC-19-2·4)
        if (rows.length === 0) return NextResponse.redirect(new URL('/admin/orders?empty=1', request.url), 302);

        const csv = toShippingCsv(rows);
        await recordShippingListDownload(member.id, rows.length);
        const fileName = shippingListFileName(new Date());
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        const code = errorCodeOf(error);
        console.error('[API-14]', code, error);
        return new NextResponse('주소록을 만들지 못했어요. 잠시 후 다시 시도해 주세요.', { status: code === 'FORBIDDEN' ? 403 : 500 });
    }
}
