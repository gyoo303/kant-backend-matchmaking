#!/usr/bin/env node
// data/products.ts(KANT Mock) → supabase/seed.sql (ADR-001, AR-DB §8)
// 실행: node --import tsx scripts/gen-seed.mjs
// 원격 DB에 여러 번 적용되므로 on conflict (id) do update로 쓴다(재적용해도 8행 유지).

import { writeFileSync } from 'node:fs';
import { products } from '../data/products.ts';

const OUTPUT_PATH = 'supabase/seed.sql';

const COLUMNS = [
    ['id', (p) => p.id],
    ['name', (p) => p.name],
    ['author', (p) => p.author],
    ['price', (p) => p.price],
    ['image_url', (p) => p.imageUrl],
    ['description', (p) => p.description],
    ['theme', (p) => p.theme],
    ['keeper_note', (p) => p.keeperNote],
    ['publisher_description', (p) => p.publisherDescription],
    ['stock', (p) => p.stock],
    ['created_at', (p) => p.createdAt],
];

const toSqlLiteral = (value) => {
    if (value === null) return 'null';
    if (typeof value === 'number') return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
};

const columnNames = COLUMNS.map(([name]) => name);
const rows = products.map((product) => `  (${COLUMNS.map(([, read]) => toSqlLiteral(read(product))).join(', ')})`);
const updates = columnNames.filter((name) => name !== 'id').map((name) => `  ${name} = excluded.${name}`);

const sql = [
    '-- 생성 파일: scripts/gen-seed.mjs가 data/products.ts에서 만든다. 직접 고치지 않는다.',
    `insert into public.products (${columnNames.join(', ')})`,
    'values',
    rows.join(',\n'),
    'on conflict (id) do update set',
    `${updates.join(',\n')};`,
    '',
].join('\n');

writeFileSync(OUTPUT_PATH, sql);
console.log(`${OUTPUT_PATH}: products ${products.length}행`);
