import { createHmac, randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import console from 'node:console';
import process from 'node:process';

// Validate credentials with a read-only request. Never print secrets or JWTs.
const pairs = [
  ['JWT_ISSUER/JWT_SECRET', process.env.FIREFOX_JWT_ISSUER, process.env.FIREFOX_JWT_SECRET],
  ['FIREFOX_ISSUER/FIREFOX_SECRET', process.env.LEGACY_FIREFOX_ISSUER, process.env.LEGACY_FIREFOX_SECRET],
];
let selected = false;
for (const [name, issuer, secret] of pairs) {
  if (!issuer || !secret) continue;
  if (/[\r\n]/.test(issuer + secret)) throw new Error(`${name} must not contain newlines`);
  const issuedAt = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer, jti: randomUUID(), iat: issuedAt, exp: issuedAt + 60,
  })}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  const response = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(process.env.FIREFOX_EXTENSION_ID)}/`, {
    headers: { Authorization: `JWT ${unsigned}.${signature}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401) {
    console.warn(`${name}: Mozilla rejected authentication; trying the next configured pair.`);
    continue;
  }
  if (!response.ok) throw new Error(`Mozilla credential check failed: HTTP ${response.status}`);
  if (!process.env.GITHUB_ENV) throw new Error('This script must run in GitHub Actions');
  await appendFile(process.env.GITHUB_ENV, `FIREFOX_JWT_ISSUER=${issuer}\nFIREFOX_JWT_SECRET=${secret}\n`);
  console.log(`Mozilla authentication verified using ${name}.`);
  selected = true;
  break;
}
if (!selected) throw new Error('No valid Mozilla API credentials. Update JWT_ISSUER and JWT_SECRET with an active AMO API key pair.');
