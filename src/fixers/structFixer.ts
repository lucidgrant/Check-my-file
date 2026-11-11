/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-STRUCT-01 : Réparation de la structure et de la table xref via QPDF
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FixerDefinition, FixPlan, FixExecutionResult } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

export const structFixer: FixerDefinition = {
  id: 'FIX-STRUCT-01',
  name: 'Réparation structurelle et reconstruction xref (QPDF)',
  version: '1.0.0',
  ruleIds: ['INGEST-01'],
  riskLevel: 1,
  description: 'Reconstruit la table des références croisées (xref) et normalise les indices d’objets de manière strictement déterministe.',
  businessObjective: 'Permet la récupération et la normalisation de flux PDF mal indexés ou endommagés lors de transferts FTP/HTTP.',
  preconditions: [
    'Le fichier doit posséder un en-tête %PDF identifiable ou une structure d’objets recouvrable.',
    'L’outil qpdf v11.3.0 doit être disponible sur l’environnement d’exécution.',
  ],
  limits: [
    'Ne peut pas reconstituer des flux de contenu totalement tronqués ou manquants.',
    'Ne lève pas de mot de passe utilisateur.',
  ],
  tools: [
    {
      name: 'qpdf',
      version: '11.3.0',
      license: 'Apache-2.0',
      deterministicOptions: ['--deterministic-id', '--recreate-indices'],
    },
  ],
  untouchedAspects: [
    'Aspects visuels, géométrie des pages et palettes de couleurs strictement inchangés.',
    'Polices de caractères et éléments vectoriels non modifiés.',
  ],

  plan: async (findings: RuleCheckResult[], _profile: PrintProfile): Promise<FixPlan> => {
    const ingest = findings.find(f => f.ruleId === 'INGEST-01');
    const needsFix = ingest && ingest.status === 'FAIL';

    return {
      fixerId: 'FIX-STRUCT-01',
      applicable: !!needsFix,
      riskLevel: 1,
      plannedChanges: [
        'Reconstruction déterministe de la table xref et de la numérotation des objets indirects.',
        'Normalisation syntaxique des flux selon la norme ISO 32000-1.',
      ],
      untouchedAspects: [
        'Contenu graphique, textes, polices et zones de page.',
      ],
      estimatedImpact: 'Répare les avertissements de chargement et sécurise l’ingestion par le RIP.',
      userConfirmationRequired: false,
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, _profile: PrintProfile): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-struct-'));
    const inPath = path.join(tempDir, 'input.pdf');
    const outPath = path.join(tempDir, 'output.pdf');

    try {
      fs.writeFileSync(inPath, inputBytes);

      const qpdfArgs = [
        '--deterministic-id',
        inPath,
        outPath,
      ];

      const res = spawnSync('qpdf', qpdfArgs, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

      // qpdf code 0 = success, code 3 = success with warnings corrected
      if (res.status !== 0 && res.status !== 3) {
        return {
          fixerId: 'FIX-STRUCT-01',
          applied: false,
          refusalReason: `Échec de réparation QPDF (code ${res.status}) : ${res.stderr || res.stdout || 'Erreur inconnue'}`,
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
          fixerId: 'FIX-STRUCT-01',
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
        fixerId: 'FIX-STRUCT-01',
        applied: true,
        changes: [
          {
            itemDescription: 'Table des références croisées (xref) et dictionnaire trailer',
            beforeValue: 'Non standard ou corrompue',
            afterValue: 'Reconstruite avec identifiant déterministe ISO 32000',
            technicalDetails: `QPDF status: ${res.status}. Output size: ${outputBytes.byteLength} octets.`,
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
