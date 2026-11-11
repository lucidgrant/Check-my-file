/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-SEC-01 : Suppression des restrictions d'impression sans mot de passe d'ouverture
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FixerDefinition, FixPlan, FixExecutionResult } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

export const secFixer: FixerDefinition = {
  id: 'FIX-SEC-01',
  name: 'Levée des restrictions de sécurité sans mot de passe d’ouverture',
  version: '1.0.0',
  ruleIds: ['INGEST-01'],
  riskLevel: 1,
  description: 'Supprime les restrictions de permissions (modification, impression basse résolution) sur les fichiers qui ne requièrent PAS de mot de passe à l’ouverture.',
  businessObjective: 'Permet l’impression haute résolution et le prévol sur des documents verrouillés par un mot de passe propriétaire oublié.',
  preconditions: [
    'Le document ne doit PAS exiger de mot de passe pour être ouvert et lu.',
    'L’utilisateur doit confirmer être légalement autorisé à imprimer et modifier le document.',
  ],
  limits: [
    'Ne contourne JAMAIS un mot de passe d’ouverture (User Password requis pour le déchiffrement du contenu).',
    'Refuse l’exécution si le document est chiffré par une clé inconnue.',
  ],
  tools: [
    {
      name: 'qpdf',
      version: '11.3.0',
      license: 'Apache-2.0',
      deterministicOptions: ['--decrypt', '--deterministic-id'],
    },
  ],
  untouchedAspects: [
    'Tous les éléments graphiques, textes, polices, calques et géométries sont conservés à l’identique.',
  ],

  plan: async (findings: RuleCheckResult[], _profile: PrintProfile): Promise<FixPlan> => {
    const ingest = findings.find(f => f.ruleId === 'INGEST-01');
    const isRestricted = ingest && (ingest.status === 'FAIL' || ingest.observedValue.toLowerCase().includes('sécurité'));

    return {
      fixerId: 'FIX-SEC-01',
      applicable: !!isRestricted,
      riskLevel: 1,
      plannedChanges: [
        'Suppression du dictionnaire /Encrypt dans le trailer PDF.',
        'Autorisation complète des droits d’impression haute résolution.',
      ],
      untouchedAspects: [
        'Contenu visuel et mise en page intouchés.',
      ],
      estimatedImpact: 'Rend le fichier exploitable par les logiciels d’imposition et les RIP professionnels.',
      userConfirmationRequired: true,
      confirmationPrompt: 'Confirmez-vous détenir les droits légaux d’impression et de modification sur ce document ?',
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, _profile: PrintProfile, extraOptions?: Record<string, any>): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    if (extraOptions?.confirmLegalRights !== true) {
      return {
        fixerId: 'FIX-SEC-01',
        applied: false,
        refusalReason: 'Confirmation requise : Vous devez attester disposer des droits légaux sur ce fichier.',
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { qpdf: '11.3.0' },
      };
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-sec-'));
    const inPath = path.join(tempDir, 'input.pdf');
    const outPath = path.join(tempDir, 'output.pdf');

    try {
      fs.writeFileSync(inPath, inputBytes);

      // Tester d'abord si le fichier nécessite un mot de passe d'ouverture
      const checkRes = spawnSync('qpdf', ['--requires-password', inPath], { encoding: 'utf-8' });
      // qpdf code 2 = password required
      if (checkRes.status === 2 || (checkRes.stderr && checkRes.stderr.includes('password required'))) {
        return {
          fixerId: 'FIX-SEC-01',
          applied: false,
          refusalReason: 'Le fichier requiert un mot de passe d’ouverture (lecture chiffrée). Contournement refusé par politique de sécurité.',
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { qpdf: '11.3.0' },
        };
      }

      // Appliquer le déchiffrement des permissions
      const qpdfArgs = [
        '--decrypt',
        '--deterministic-id',
        inPath,
        outPath,
      ];

      const res = spawnSync('qpdf', qpdfArgs, { encoding: 'utf-8' });

      if (res.status !== 0 && res.status !== 3) {
        return {
          fixerId: 'FIX-SEC-01',
          applied: false,
          refusalReason: `Échec du déchiffrement QPDF : ${res.stderr || res.stdout || 'Erreur de permission'}`,
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { qpdf: '11.3.0' },
        };
      }

      if (!fs.existsSync(outPath)) {
        return {
          fixerId: 'FIX-SEC-01',
          applied: false,
          refusalReason: 'Fichier de sortie QPDF non généré.',
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { qpdf: '11.3.0' },
        };
      }

      const outputBytes = new Uint8Array(fs.readFileSync(outPath));
      const outputSha256 = await computeSha256(outputBytes);

      return {
        fixerId: 'FIX-SEC-01',
        applied: true,
        changes: [
          {
            itemDescription: 'Dictionnaire de sécurité /Encrypt',
            beforeValue: 'Restrictions actives',
            afterValue: 'Supprimé (document déverrouillé pour l’impression)',
            technicalDetails: 'Permissions d’impression rétablies en conformité avec la demande utilisateur.',
          },
        ],
        bytes: outputBytes,
        inputSha256,
        outputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { qpdf: '11.3.0' },
      };
    } finally {
      try {
        if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch {
        // Nettoyage silencieux
      }
    }
  },
};
