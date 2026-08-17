#!/usr/bin/env node
/**
 * Add authorized domains to a Firebase project.
 *
 * Fixes `Firebase: Error (auth/unauthorized-domain)` after deploying to a new
 * host (e.g. a Vercel URL like `chatadk.vercel.app`).
 *
 * The service account can be supplied in any of these ways:
 *   1. A key JSON file via GOOGLE_APPLICATION_CREDENTIALS or as the first arg
 *   2. Inline, via FIREBASE_SERVICE_ACCOUNT_JSON in .env  (parsed here)
 *
 * The service account needs the "Firebase Authentication Admin" role
 * (roles/firebaseauth.admin) or the Editor role on the project.
 *
 * Usage:
 *   node scripts/authorize-firebase-domain.js chatadk.vercel.app www.chatadk.vercel.app
 *   GOOGLE_APPLICATION_CREDENTIALS=./key.json \
 *     node scripts/authorize-firebase-domain.js chatadk.vercel.app
 */
import fs from 'fs';
import crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const IAKIT_URL = 'https://identitytoolkit.googleapis.com/v2';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function base64url(buf) {
  return buf.toString('base64url');
}

// Brace-match the (possibly multi-line) JSON value of FIREBASE_SERVICE_ACCOUNT_JSON in .env.
function parseServiceAccountFromEnv(envFile) {
  if (!fs.existsSync(envFile)) {
    throw new Error(`.env not found at ${envFile}`);
  }
  const text = fs.readFileSync(envFile, 'utf8');
  const marker = 'FIREBASE_SERVICE_ACCOUNT_JSON=';
  const idx = text.indexOf(marker);
  if (idx < 0) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env');
  }
  const start = text.indexOf('{', idx);
  if (start < 0) throw new Error('Could not find JSON object in FIREBASE_SERVICE_ACCOUNT_JSON');
  let depth = 0;
  let end = start;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return JSON.parse(text.slice(start, end));
}

function loadServiceAccount() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return JSON.parse(fs.readFileSync(fromEnv, 'utf8'));
  }
  throw new Error(
    'No service account available.\n' +
      'Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json or add the first arg, ' +
      'or include FIREBASE_SERVICE_ACCOUNT_JSON in .env.',
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Best-effort: enable a Google API on the project if it isn't already.
async function ensureApiEnabled(host, service, projectId, token) {
  const url = `https://${host}/v1/projects/${projectId}/services/${service}:enable`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: '{}',
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      console.log(`note: failed to enable ${service} on ${projectId} (${res.status}) — ${text}`);
    } else {
      console.log(`enabled ${service} on ${projectId}`);
    }
    // Enabling can take a few seconds to propagate.
    await sleep(6000);
  } catch (e) {
    console.log(`note: could not enable ${service}: ${e.message}`);
    await sleep(4000);
  }
}

// Sign an RS256 JWT with the service account private key and exchange it for an
// IAM access token via the standard service-account JWT flow.
function makeAccessToken(sa) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = crypto.createPrivateKey({
    key: sa.private_key,
    format: 'pem',
    type: sa.private_key.includes('BEGIN PRIVATE KEY') ? 'pkcs8' : 'pkcs1',
  });
  const signature = crypto.sign(null, Buffer.from(signingInput), key).toString('base64url');
  const assertion = `${signingInput}.${signature}`;

  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
    .then((r) => r.json())
    .then((json) => {
      if (!json.access_token) {
        throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
      }
      return json.access_token;
    });
}

function api(method, projectId, token, body) {
  const url = `${IAKIT_URL}/projects/${projectId}?updateMask=authorizedDomains`;
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!r.ok) {
      const err = new Error(`${r.status} ${r.statusText}`);
      err.code = r.status;
      err.body = json;
      throw err;
    }
    return json;
  });
}

function normalizeDomain(d) {
  return String(d).replace(/^\.+/, '').replace(/\/.*$/, '').toLowerCase();
}

(async () => {
  const args = process.argv.slice(2);
  const domains = args.filter((a) => !a.startsWith('--'));
  const useEnv = args.includes('--from-env');

  if (!domains.length) {
    console.error('No domains provided.');
    console.error('Usage: node scripts/authorize-firebase-domain.js <domain> [domain...] [--from-env]');
    process.exit(2);
  }

  let sa;
  try {
    sa = useEnv
      ? parseServiceAccountFromEnv('.env')
      : loadServiceAccount();
  } catch (e) {
    console.error('Failed to load service account:', e.message);
    process.exit(2);
  }

  const projectId = sa.project_id || 'chatwithadk';

  let token;
  try {
    token = await makeAccessToken(sa);
  } catch (e) {
    console.error('Failed to obtain access token:', e.message);
    process.exit(1);
  }

  // The Identity Toolkit Admin API (identitytoolkit.googleapis.com) must be
  // enabled on the project for the authorized-domains endpoints to resolve.
  await ensureApiEnabled(
    'serviceusage.googleapis.com',
    'identitytoolkit.googleapis.com',
    projectId,
    token,
  );

  const requested = domains.map(normalizeDomain);

  let current;
  try {
    current = await api('GET', projectId, token);
  } catch (e) {
    if (e.code === 404) {
      console.error('The Identity Toolkit Admin API (identitytoolkit.googleapis.com) is not enabled on project ' + projectId + ', or the service account lacks access.');
      console.error('Enable it in the Google Cloud Console (APIs & Services -> Library -> Identity Toolkit Admin API) as a project Owner first, then re-run.');
    } else if (e.code === 403 || e.code === 401) {
      console.error('Permission denied (' + e.code + '). Grant the service account the "Firebase Authentication Admin" role.');
    } else {
      console.error('GET failed:', e.message);
    }
    console.error('\nNo worries — you can add the domain manually in 30s via the Firebase Console:');
    console.error('  https://console.firebase.google.com/project/' + projectId + '/authentication');
    console.error('Domains attempted:', requested.join(', '));
    process.exit(1);
  }
  const existing = new Set(
    (current.authorizedDomains || []).map((d) => normalizeDomain(d)),
  );
  for (const d of requested) existing.add(d);
  const updated = [...existing];

  let res;
  try {
    res = await api(
      'PATCH',
      projectId,
      token,
      { name: `projects/${projectId}`, authorizedDomains: updated },
    );
  } catch (e) {
    if (e.code === 403 || e.code === 401) {
      console.error('\nPermission denied (403/401). The service account lacks the "Firebase Authentication Admin" role.');
      console.error('Falling back: please add the domains manually via the Firebase Console instead:');
      console.error('  https://console.firebase.google.com/project/' + projectId + '/authentication/providers');
    } else {
      console.error('Patch failed:', e.message);
    }
    console.error('Domains that were attempted:', requested.join(', '));
    process.exit(1);
  }

  console.log(`Project: ${projectId} (authDomain: ${sa.auth_domain || projectId + '.firebaseapp.com'})`);
  console.log('Authorized domains:');
  for (const d of res.authorizedDomains || updated) {
    console.log('  - ' + d);
  }
  console.log('\nDone. The Vercel domain(s) are now authorized for Firebase Auth.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
