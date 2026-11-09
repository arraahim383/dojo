import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const downloads = path.resolve('dist-static', 'downloads');
try {
  const files = await readdir(downloads, { withFileTypes: true });
  await Promise.all(
    files
      .filter((file) => file.isFile() && /\.apk(?:\.sha256)?$/i.test(file.name))
      .map((file) => rm(path.join(downloads, file.name))),
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
