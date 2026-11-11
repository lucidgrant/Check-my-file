/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Utilitaires cryptographiques déterministes (SHA-256)
 */

export async function computeSha256(bytes: Uint8Array): Promise<string> {
  // Support environnement Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const { createHash } = await import('node:crypto');
      return createHash('sha256').update(bytes).digest('hex');
    } catch {
      // Fallback
    }
  }

  // Support environnement Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Aucun environnement cryptographique disponible pour le calcul SHA-256');
}

export function bufferToBase64(buffer: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
