import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDataStore, githubToken } from '../lib/github-data.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'dist');
const store = await createDataStore({ cachePath: join(root, 'data', 'cache.json'), token: githubToken() });
// A failed sync fails the build; the last successful snapshot stays online.
const snapshot = await store.refresh();
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });
const html = await readFile(join(output, 'index.html'), 'utf8');
await writeFile(join(output, 'index.html'), html.replace('name="omi-data-mode" content="live"', 'name="omi-data-mode" content="static"'));
await mkdir(join(output, 'data'), { recursive: true });
await writeFile(join(output, 'data', 'leaderboard.json'), JSON.stringify(snapshot));
await writeFile(join(output, '.nojekyll'), '');
console.log(`Built static site in dist/ with data synced at ${snapshot.syncedAt}.`);
