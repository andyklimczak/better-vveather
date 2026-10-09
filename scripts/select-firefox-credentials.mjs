import { createHmac, randomUUID } from 'node:crypto';
import console from 'node:console';
import process from 'node:process';

// Validate credentials with a read-only request. Never print secrets or JWTs.
const { JWT_ISSUER: issuer, JWT_SECRET: secret } = process.env;
if (!issuer || !secret) throw new Error('JWT_ISSUER and JWT_SECRET are required');
const name = 'JWT_ISSUER/JWT_SECRET';
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
if (!response.ok) throw new Error(`Mozilla credential check failed: HTTP ${response.status}`);
console.log(`Mozilla authentication verified using ${name}.`);

