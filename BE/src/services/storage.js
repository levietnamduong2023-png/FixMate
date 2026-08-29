import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { opaqueToken } from '../utils/security.js';

async function callSigner(operation, payload) {
  if (!config.objectStorageSignerUrl) {
    if (config.nodeEnv === 'production') {
      throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'Object storage chưa được cấu hình.');
    }
    return {
      objectKey: payload.objectKey || 'requests/' + opaqueToken(18),
      url: 'https://storage.invalid/development-signed-url',
      expiresIn: operation === 'read' ? 900 : 600,
      developmentOnly: true,
    };
  }
  const response = await fetch(config.objectStorageSignerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.objectStorageApiKey,
    },
    body: JSON.stringify({ operation, ...payload }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(502, 'STORAGE_SIGNER_ERROR', 'Không thể cấp signed URL.');
  return response.json();
}

export function createUploadUrl(payload) {
  return callSigner('upload', payload);
}

export function createReadUrl(objectKey) {
  return callSigner('read', { objectKey, expiresIn: 900 });
}
