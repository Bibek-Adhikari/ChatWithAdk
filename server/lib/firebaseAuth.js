// server/lib/firebaseAuth.js
// Verify Firebase ID tokens on the server.
//
// Primary path: firebase-admin `verifyIdToken()` (needs a service account for
// the SAME project as the web app). If that service account is missing or
// belongs to another project, we fall back to verifying the RS256 JWT against
// Google's public secure-token certs. This is the documented approach for
// custom backends and is just as strict: signature, audience, issuer and
// expiry are all checked against VITE_FIREBASE_PROJECT_ID.
import crypto from 'node:crypto';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const WEB_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || '';

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { keys: [], fetchedAt: 0 };
let warnedAboutFallback = false;

export const initFirebaseAdmin = () => {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }

  return initializeApp({ credential: applicationDefault() });
};

export const getDb = () => {
  initFirebaseAdmin();
  return getFirestore();
};

const base64UrlDecode = (value) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const getJwks = async () => {
  const now = Date.now();
  if (jwksCache.keys.length && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    if (jwksCache.keys.length) return jwksCache.keys;
    throw new Error(`Could not fetch Firebase public keys (${response.status}).`);
  }

  const data = await response.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  if (keys.length) jwksCache = { keys, fetchedAt: now };
  return keys;
};

const verifyWithPublicCerts = async (token) => {
  if (!WEB_PROJECT_ID) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256') return null;

  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid) || (keys.length === 1 ? keys[0] : null);
  if (!jwk) return null;

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    base64UrlDecode(encodedSignature)
  );
  if (!signatureValid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) return null;
  if (!payload.iat || payload.iat > now + 300) return null;
  if (payload.aud !== WEB_PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${WEB_PROJECT_ID}`) return null;
  if (!payload.sub) return null;

  return {
    ...payload,
    uid: payload.sub,
    email: payload.email || null,
  };
};

export const verifyFirebaseToken = async (token) => {
  try {
    initFirebaseAdmin();
    return await getAuth().verifyIdToken(token);
  } catch (adminError) {
    const decoded = await verifyWithPublicCerts(token).catch(() => null);
    if (decoded) {
      if (!warnedAboutFallback) {
        warnedAboutFallback = true;
        console.warn(
          '[auth] Using public-cert token verification. Replace FIREBASE_SERVICE_ACCOUNT_JSON ' +
          `with a key for project "${WEB_PROJECT_ID}" to restore firebase-admin verification.`
        );
      }
      return decoded;
    }
    throw adminError;
  }
};
