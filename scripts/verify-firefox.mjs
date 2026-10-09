import { createHmac, randomUUID } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';
import process from 'node:process';

// Read back the exact submitted version, including versions awaiting review.
// A successful upload is not the same as Mozilla approving a public release.
const manifest = JSON.parse(await readFile('.output/firefox-mv2/manifest.json', 'utf8'));
const id = manifest.browser_specific_settings.gecko.id;
const { FIREFOX_JWT_ISSUER: issuer, FIREFOX_JWT_SECRET: secret } = process.env;
if (!issuer || !secret) throw new Error('Firefox JWT credentials are required');
const issuedAt = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  iss: issuer, jti: randomUUID(), iat: issuedAt, exp: issuedAt + 60,
})}`;
const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
const url = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(id)}/versions/${encodeURIComponent(manifest.version)}/`;
const response = await fetch(url, {
  headers: { Authorization: `JWT ${unsigned}.${signature}` },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`AMO version verification failed: HTTP ${response.status}`);
const version = await response.json();
if (version.version !== manifest.version || version.channel !== 'listed' || !version.file?.id || !version.source) {
  throw new Error('AMO did not return the expected listed version with review sources');
}
const summary = `Firefox ${version.version}: submission verified, file ${version.file.id}, status ${version.file.status}. Mozilla review may still be pending.\n`;
process.stdout.write(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
