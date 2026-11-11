/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-COLOR-01 : Étude de faisabilité & Conversion CMJN déterministe via Ghostscript
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { FixerDefinition, FixPlan, FixExecutionResult } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

export const colorFeasibilityFixer: FixerDefinition = {
  id: 'FIX-COLOR-01',
  name: 'Conversion CMJN déterministe avec normalisation métadonnées (Ghostscript)',
  version: '1.0.0',
  ruleIds: ['COLOR-01', 'COLOR-02'],
  riskLevel: 3,
  description: 'Convertit les espaces colorimétriques RVB vers DeviceCMYK via Ghostscript avec pipeline de normalisation pour garantir un hash SHA-256 reproductible au bit près.',
  businessObjective: 'Fournir un flux de séparation quadri conforme aux presses offset sans dérive chromatique non maîtrisée.',
  isExperimental: true, // Étude de faisabilité / Expérimental
  preconditions: [
    'Le document doit comporter des objets ou images encodés en RVB.',
    'Ghostscript (gs v9.55+) et QPDF (v11.3+) doivent être installés dans l’environnement.',
    'L’utilisateur doit accepter la modification chromatique (Niveau 3).',
  ],
  limits: [
    'Peut modifier l’apparence perceptuelle des couleurs hors gamut CMJN.',
    'Ghostscript est sous licence AGPLv3 (ou licence commerciale Artifex) : statut juridique à trancher avant mise en production industrielle.',
    'Non exposé par défaut dans le bouton de correction rapide de l’UI.',
  ],
  tools: [
    {
      name: 'ghostscript',
      version: '9.55.0',
      license: 'AGPLv3 / Commerciale',
      deterministicOptions: ['-sDEVICE=pdfwrite', '-sColorConversionStrategy=CMYK', '-dProcessColorModel=/DeviceCMYK', '-dAutoRotatePages=/None'],
    },
    {
      name: 'qpdf',
      version: '11.3.0',
      license: 'Apache-2.0',
      deterministicOptions: ['--deterministic-id'],
    },
    {
      name: 'pdf-lib',
      version: '1.17.1',
      deterministicOptions: ['fixedTrailerID', 'fixedDates'],
    },
  ],
  untouchedAspects: [
    'Mise en page, boîtes de coupe et hiérarchie géométrique préservées.',
    'Résolution native des images conservée.',
  ],

  plan: async (findings: RuleCheckResult[], profile: PrintProfile): Promise<FixPlan> => {
    const colorCheck = findings.find(f => f.ruleId === 'COLOR-01');
    const needsFix = colorCheck && colorCheck.status === 'FAIL' && !profile.rgbAllowed;

    return {
      fixerId: 'FIX-COLOR-01',
      applicable: !!needsFix,
      riskLevel: 3,
      plannedChanges: [
        'Conversion des espaces colorimétriques DeviceRGB et ICCBased vers DeviceCMYK.',
        'Ajout d’une déclaration OutputIntent GTS_PDFX pour stabiliser la condition de tirage.',
        'Normalisation stricte de l’identifiant /ID et des horodatages pour reproductibilité bit-à-bit.',
      ],
      untouchedAspects: [
        'Positions des textes et coordonnées géométriques.',
      ],
      estimatedImpact: 'Résout la non-conformité COLOR-01 en basculant tous les flux en séparation quadri.',
      userConfirmationRequired: true,
      confirmationPrompt: 'Confirmez-vous la conversion globale des couleurs vers CMJN (risque de glissement chromatique sur les teintes vives) ?',
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, profile: PrintProfile, extraOptions?: Record<string, any>): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    if (extraOptions?.confirmColorConversion !== true) {
      return {
        fixerId: 'FIX-COLOR-01',
        applied: false,
        refusalReason: 'Confirmation requise : Vous devez accepter la conversion colorimétrique CMJN (Niveau 3).',
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { ghostscript: '9.55.0', qpdf: '11.3.0', 'pdf-lib': '1.17.1' },
      };
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmf-color-'));
    const inPath = path.join(tempDir, 'input.pdf');
    const gsOutPath = path.join(tempDir, 'gs_out.pdf');
    const normTempPath = path.join(tempDir, 'norm_temp.pdf');
    const finalOutPath = path.join(tempDir, 'final.pdf');

    try {
      fs.writeFileSync(inPath, inputBytes);

      // Étape 1 : Conversion CMJN via Ghostscript
      const gsArgs = [
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',
        '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=CMYK',
        '-dProcessColorModel=/DeviceCMYK',
        '-dAutoRotatePages=/None',
        `-sOutputFile=${gsOutPath}`,
        inPath,
      ];

      const gsRes = spawnSync('gs', gsArgs, { encoding: 'utf-8' });
      if (gsRes.status !== 0 || !fs.existsSync(gsOutPath)) {
        return {
          fixerId: 'FIX-COLOR-01',
          applied: false,
          refusalReason: `Échec de conversion Ghostscript (code ${gsRes.status}) : ${gsRes.stderr || 'Erreur inconnue'}`,
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { ghostscript: '9.55.0' },
        };
      }

      // Étape 2 : Normalisation métadonnées et injection OutputIntent via pdf-lib
      const gsBytes = fs.readFileSync(gsOutPath);
      const doc = await PDFDocument.load(gsBytes, { updateMetadata: false });

      doc.setTitle('CheckMyFile_CMYK');
      doc.setCreationDate(new Date(0));
      doc.setModificationDate(new Date(0));
      doc.setProducer('CheckMyFile Deterministic Engine v2.0 (GS+QPDF)');

      // Fixer le trailer /ID de manière déterministe
      const fixedId = PDFHexString.of('436865636b4d7946696c65434d594b31');
      const idArray = doc.context.obj([fixedId, fixedId]);
      (doc.context as any).trailerInfo.ID = idArray;

      // Ajouter OutputIntent si le profil l'attend
      if (profile.pdfxStandard !== 'none') {
        const outputIntent = doc.context.obj({
          Type: 'OutputIntent',
          S: 'GTS_PDFX',
          OutputConditionIdentifier: 'FOGRA39',
          RegistryName: 'http://www.color.org',
        });
        const outputIntentRef = doc.context.register(outputIntent);
        const intentsArray = doc.context.obj([outputIntentRef]);
        doc.catalog.set(PDFName.of('OutputIntents'), intentsArray);
      }

      const normBytes = await doc.save({ useObjectStreams: false });
      fs.writeFileSync(normTempPath, normBytes);

      // Étape 3 : Normalisation syntaxique finale via QPDF pour garantir l'id déterministe
      const qpdfRes = spawnSync('qpdf', ['--deterministic-id', normTempPath, finalOutPath], { encoding: 'utf-8' });
      if (qpdfRes.status !== 0 && qpdfRes.status !== 3) {
        return {
          fixerId: 'FIX-COLOR-01',
          applied: false,
          refusalReason: `Échec de normalisation finale QPDF : ${qpdfRes.stderr || 'Erreur'}`,
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { ghostscript: '9.55.0', qpdf: '11.3.0' },
        };
      }

      const outputBytes = new Uint8Array(fs.readFileSync(finalOutPath));
      const outputSha256 = await computeSha256(outputBytes);

      return {
        fixerId: 'FIX-COLOR-01',
        applied: true,
        changes: [
          {
            itemDescription: 'Conversion des espaces RVB vers DeviceCMYK',
            beforeValue: 'DeviceRGB / Éléments RVB détectés',
            afterValue: 'DeviceCMYK unifié avec OutputIntent FOGRA39',
            technicalDetails: 'Pipeline Ghostscript 9.55 + Normalisation pdf-lib + ID QPDF déterministe.',
          },
        ],
        bytes: outputBytes,
        inputSha256,
        outputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { ghostscript: '9.55.0', qpdf: '11.3.0', 'pdf-lib': '1.17.1' },
      };
    } finally {
      try {
        if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
        if (fs.existsSync(gsOutPath)) fs.unlinkSync(gsOutPath);
        if (fs.existsSync(normTempPath)) fs.unlinkSync(normTempPath);
        if (fs.existsSync(finalOutPath)) fs.unlinkSync(finalOutPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch {
        // Nettoyage silencieux
      }
    }
  },
};
