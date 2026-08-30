import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const secret =
  process.env.VERIFICATION_SECRET?.trim() || randomBytes(32).toString('hex');
const source = `export const verificationBuildSecret = ${JSON.stringify(secret)};\n`;

await mkdir(new URL('../.generated/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../.generated/verification-secret.ts', import.meta.url),
  source,
  { mode: 0o600 },
);

await mkdir(new URL('../public/vendor/', import.meta.url), { recursive: true });
await copyFile(
  new URL(
    '../node_modules/@vladmandic/human/dist/human.esm.js',
    import.meta.url,
  ),
  new URL('../public/vendor/human.esm.js', import.meta.url),
);
