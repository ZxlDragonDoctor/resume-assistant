import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('./fileUrl.ts', import.meta.url));
let helpers = {};
if (existsSync(source)) {
  const { outputFiles } = await build({ entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false });
  helpers = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const resolve = (value) => {
  assert.equal(typeof helpers.publicFileUrl, 'function');
  return helpers.publicFileUrl(value);
};

test('repairs saved loopback MinIO URLs while preserving avatar cache versions', () => {
  assert.equal(resolve('http://localhost:9010/resume-files/avatars/user.png?v=42'), '/minio/resume-files/avatars/user.png?v=42');
  assert.equal(resolve('http://127.0.0.1:9000/resume-files/uploads/photo.jpg'), '/minio/resume-files/uploads/photo.jpg');
});

test('preserves relative, external and non-storage image URLs', () => {
  for (const value of ['/minio/resume-files/avatars/user.png', 'https://images.example.com/a.png', 'http://localhost:5173/logo.png', 'http://localhost:9010/another-bucket/a.png', 'data:image/png;base64,AAAA']) {
    assert.equal(resolve(value), value);
  }
});

test('returns no source for absent avatars', () => {
  assert.equal(resolve(undefined), undefined);
  assert.equal(resolve(''), undefined);
});
