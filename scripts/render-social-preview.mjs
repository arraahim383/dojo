import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(path.join(root, 'public', 'social-preview.svg'), 'utf8');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
const output = path.join(root, 'public', 'social-preview.png');
await writeFile(output, png);
process.stdout.write(`Wrote ${output} (${png.byteLength} bytes)\n`);
