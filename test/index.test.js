import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveInputFilePath, extractBackendIds, buildArtifactUrl } from '../index.js';

test('resolveInputFilePath resolves paths inside workspace', () => {
  const resolved = resolveInputFilePath('reports/report.html', '/workspace/repo');
  assert.equal(resolved, path.resolve('/workspace/repo/reports/report.html'));
});

test('resolveInputFilePath rejects traversal outside workspace', () => {
  const resolved = resolveInputFilePath('../secrets.txt', '/workspace/repo');
  assert.equal(resolved, null);
});

test('extractBackendIds extracts run and job ids from runtime token', () => {
  const payload = Buffer.from(JSON.stringify({ scp: 'Actions.Results:123:456 other:scope' })).toString('base64url');
  const token = `header.${payload}.signature`;
  assert.deepEqual(extractBackendIds(token), ['123', '456']);
});

test('buildArtifactUrl returns absolute artifact url', () => {
  const url = buildArtifactUrl({
    serverUrl: 'https://github.com',
    repository: 'svrooij/gh-artifact-upload-advanced',
    runId: '42',
    artifactId: '99',
  });

  assert.equal(url, 'https://github.com/svrooij/gh-artifact-upload-advanced/actions/runs/42/artifacts/99');
});
