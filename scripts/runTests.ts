// Polyfill Uint8Array.prototype.toHex and Promise.try for Node.js if not natively present
if (!(Promise as any).try) {
  (Promise as any).try = function (fn: any, ...args: any[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

if (!(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function () {
    return Buffer.from(this.buffer, this.byteOffset, this.byteLength).toString('hex');
  };
}

import { runPreflightTestSuite } from '../src/services/preflightTests.ts';

async function main() {
  console.log('--- DÉMARRAGE DE LA SUITE DE TESTS PRÉPRESSE DÉTERMINISTE ---');
  try {
    const results = await runPreflightTestSuite();
    let allPassed = true;

    for (const r of results) {
      const mark = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
      console.log(`${mark} ${r.name}`);
      console.log(`     Catégorie : ${r.category}`);
      console.log(`     Attendu   : ${r.expectedStatus}`);
      console.log(`     Obtenu    : ${r.actualStatus}`);
      console.log(`     Détails   : ${r.details}\n`);

      if (!r.passed) {
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log(`🎯 TOUS LES TESTS PRÉPRESSE ONT RÉUSSI (${results.length}/${results.length}).`);
      process.exit(0);
    } else {
      console.error('⚠️ CERTAINS TESTS ONT ÉCHOUÉ.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Erreur critique pendant l’exécution des tests:', err);
    process.exit(1);
  }
}

main();
