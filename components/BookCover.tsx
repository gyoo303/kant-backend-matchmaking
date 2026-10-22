'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Theme } from '@/types/product';
import { FallbackCover } from './FallbackCover';

interface BookCoverProps {
    src: string;
    title: string;
    theme: Theme;
    sizes: string;
    priority?: boolean;
    soldOut?: boolean;
}

// 표지 3:4 고정, object-cover (CONV-06, NFR-03). 이미지가 깨지면 같은 비율의 대체 표지 (AC-04-2, UX-D-10)
// src가 바뀌면 부모가 key={src}로 새로 그려 실패 상태를 초기화한다.
export function BookCover({ src, title, theme, sizes, priority = false, soldOut = false }: BookCoverProps) {
    const [failed, setFailed] = useState(false);
    const alt = `${title} 표지`;

    return (
        <div className={`relative aspect-3/4 overflow-hidden rounded-xs shadow-sm ${soldOut ? 'opacity-55' : ''}`}>
            {failed ? (
                <FallbackCover theme={theme} title={title} alt={alt} />
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes={sizes}
                    priority={priority}
                    className="object-cover"
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}
