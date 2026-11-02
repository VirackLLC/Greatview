import { readFile } from 'node:fs/promises';
import { initialContent } from '../shared/content.mjs';
const data = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
const content = JSON.stringify(initialContent(data)).replaceAll("'", "''");
console.log(`-- Preserves every original cover, featured, service and gallery photo. No license is prefilled.
insert into public.site_content (id, content) values (1, '${content}'::jsonb)
on conflict (id) do nothing;`);
