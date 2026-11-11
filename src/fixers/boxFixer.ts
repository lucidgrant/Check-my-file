/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-BOX-01 : Pose déterministe de la TrimBox et de la BleedBox
 */

import { PDFDocument } from 'pdf-lib';
import { FixerDefinition, FixPlan, FixExecutionResult, ChangeRecord } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

const MM_TO_PT = 72 / 25.4;
const PT_TO_MM = 25.4 / 72;

export const boxFixer: FixerDefinition = {
  id: 'FIX-BOX-01',
  name: 'Pose déterministe de la boîte de coupe (TrimBox)',
  version: '1.0.0',
  ruleIds: ['BLEED-02', 'BLEED-01'],
  riskLevel: 1,
  description: 'Pose la TrimBox (et la BleedBox si requise) à partir du format fini du profil d’impression sélectionné.',
  businessObjective: 'Balisage officiel de la zone de coupe nette sans déplacer aucun élément graphique ni inventer de débord.',
  preconditions: [
    'Les dimensions de la MediaBox doivent correspondre au format fini du profil OU au format fini augmenté du fond perdu requis (tolérance d’atelier).',
    'Le document doit comporter au moins une page exploitable.',
  ],
  limits: [
    'Ne déplace aucun contenu ni aucun texte.',
    'Ne crée pas de fond perdu si la MediaBox est exactement égale au format fini (la TrimBox couvrira toute la feuille, le fond perdu restera à 0 mm).',
    'Refuse l’application si la MediaBox ne correspond à aucun format attendu par le profil.',
  ],
  tools: [
    {
      name: 'pdf-lib',
      version: '1.17.1',
      deterministicOptions: ['useObjectStreams: false', 'fixedModificationDate'],
    },
  ],
  untouchedAspects: [
    'Graphismes vectoriels, images et textes inchangés.',
    'Espaces colorimétriques et polices intacts.',
    'Aucune translation ni déformation des coordonnées d’objets.',
  ],

  plan: async (findings: RuleCheckResult[], profile: PrintProfile): Promise<FixPlan> => {
    // Vérifier si BLEED-02 ou BLEED-01 est en défaut
    const b02 = findings.find(f => f.ruleId === 'BLEED-02');
    const b01 = findings.find(f => f.ruleId === 'BLEED-01');

    const needsFix = (b02 && b02.status !== 'PASS') || (b01 && b01.status === 'NOT_VERIFIABLE');

    return {
      fixerId: 'FIX-BOX-01',
      applicable: !!needsFix,
      riskLevel: 1,
      plannedChanges: [
        `Déclaration explicite de /TrimBox aux cotes du profil ${profile.name} (${profile.widthMm} × ${profile.heightMm} mm).`,
        profile.requiredBleedMm > 0
          ? `Déclaration de /BleedBox alignée sur le fond perdu attendu (${profile.requiredBleedMm} mm).`
          : 'Déclaration de /BleedBox alignée sur la TrimBox.',
      ],
      untouchedAspects: [
        'Position absolue des éléments graphiques et textes.',
        'Flux de contenu et dictionnaires de polices.',
      ],
      estimatedImpact: 'Permet au RIP d’identifier la ligne de coupe exacte et résout la règle BLEED-02.',
      userConfirmationRequired: false,
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, profile: PrintProfile): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(inputBytes, { updateMetadata: false });
    } catch (err: any) {
      return {
        fixerId: 'FIX-BOX-01',
        applied: false,
        refusalReason: `Échec de chargement PDF : ${err.message}`,
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { 'pdf-lib': '1.17.1' },
      };
    }

    const pageCount = doc.getPageCount();
    if (pageCount === 0) {
      return {
        fixerId: 'FIX-BOX-01',
        applied: false,
        refusalReason: 'Le document ne contient aucune page.',
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { 'pdf-lib': '1.17.1' },
      };
    }

    const expectedFinishedW_pt = profile.widthMm * MM_TO_PT;
    const expectedFinishedH_pt = profile.heightMm * MM_TO_PT;
    const bleedPt = profile.requiredBleedMm * MM_TO_PT;
    const expectedGrossW_pt = (profile.widthMm + profile.requiredBleedMm * 2) * MM_TO_PT;
    const expectedGrossH_pt = (profile.heightMm + profile.requiredBleedMm * 2) * MM_TO_PT;

    const tolPt = (profile.dimensionToleranceMm || 0.5) * MM_TO_PT;

    const changes: ChangeRecord[] = [];

    // Vérifier chaque page
    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i);
      const mediaBox = page.getMediaBox();
      const mW = mediaBox.width;
      const mH = mediaBox.height;

      // Tester l'orientation directe ou inversée (portrait / paysage)
      const matchesFinishedDirect = 
        Math.abs(mW - expectedFinishedW_pt) <= tolPt && Math.abs(mH - expectedFinishedH_pt) <= tolPt;
      const matchesFinishedRotated = 
        Math.abs(mW - expectedFinishedH_pt) <= tolPt && Math.abs(mH - expectedFinishedW_pt) <= tolPt;

      const matchesGrossDirect = 
        Math.abs(mW - expectedGrossW_pt) <= tolPt && Math.abs(mH - expectedGrossH_pt) <= tolPt;
      const matchesGrossRotated = 
        Math.abs(mW - expectedGrossH_pt) <= tolPt && Math.abs(mH - expectedGrossW_pt) <= tolPt;

      if (!matchesFinishedDirect && !matchesFinishedRotated && !matchesGrossDirect && !matchesGrossRotated) {
        const obsWMm = (mW * PT_TO_MM).toFixed(1);
        const obsHMm = (mH * PT_TO_MM).toFixed(1);
        return {
          fixerId: 'FIX-BOX-01',
          applied: false,
          refusalReason: `Page ${i + 1} : MediaBox (${obsWMm} × ${obsHMm} mm) ne correspond ni au format fini (${profile.widthMm} × ${profile.heightMm} mm) ni au format brut avec fond perdu (${(profile.widthMm + profile.requiredBleedMm * 2).toFixed(1)} × ${(profile.heightMm + profile.requiredBleedMm * 2).toFixed(1)} mm). Pose refusée pour éviter un rognage arbitraire.`,
          changes: [],
          bytes: inputBytes,
          inputSha256,
          outputSha256: inputSha256,
          executionTimeMs: Date.now() - startTime,
          toolsUsed: { 'pdf-lib': '1.17.1' },
        };
      }

      const isRotated = matchesFinishedRotated || matchesGrossRotated;
      const targetFinishedW = isRotated ? expectedFinishedH_pt : expectedFinishedW_pt;
      const targetFinishedH = isRotated ? expectedFinishedW_pt : expectedFinishedH_pt;

      if (matchesFinishedDirect || matchesFinishedRotated) {
        // La MediaBox est exactement au format fini -> TrimBox couvre toute la MediaBox
        const oldTrim = page.node.getTrimBox();
        page.setTrimBox(mediaBox.x, mediaBox.y, targetFinishedW, targetFinishedH);
        page.setBleedBox(mediaBox.x, mediaBox.y, targetFinishedW, targetFinishedH);

        changes.push({
          pageNumber: i + 1,
          itemDescription: 'TrimBox et BleedBox calées sur MediaBox (format net sans fond perdu)',
          beforeValue: oldTrim ? 'Invalide ou absente' : 'Absente',
          afterValue: `TrimBox [${mediaBox.x.toFixed(1)}, ${mediaBox.y.toFixed(1)}, ${targetFinishedW.toFixed(1)}, ${targetFinishedH.toFixed(1)}]`,
          technicalDetails: `Format fini : ${(targetFinishedW * PT_TO_MM).toFixed(1)} × ${(targetFinishedH * PT_TO_MM).toFixed(1)} mm.`,
        });
      } else {
        // La MediaBox est au format brut avec débord -> TrimBox centrée avec retrait bleedPt
        const oldTrim = page.node.getTrimBox();
        const trimX = mediaBox.x + bleedPt;
        const trimY = mediaBox.y + bleedPt;
        page.setTrimBox(trimX, trimY, targetFinishedW, targetFinishedH);
        page.setBleedBox(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height);

        changes.push({
          pageNumber: i + 1,
          itemDescription: 'TrimBox centrée avec marge de débord et BleedBox étendue',
          beforeValue: oldTrim ? 'Invalide ou absente' : 'Absente',
          afterValue: `TrimBox [${trimX.toFixed(1)}, ${trimY.toFixed(1)}, ${targetFinishedW.toFixed(1)}, ${targetFinishedH.toFixed(1)}]`,
          technicalDetails: `Format fini : ${(targetFinishedW * PT_TO_MM).toFixed(1)} × ${(targetFinishedH * PT_TO_MM).toFixed(1)} mm avec fond perdu de ${profile.requiredBleedMm} mm.`,
        });
      }
    }

    // Normalisation déterministe des métadonnées
    doc.setModificationDate(new Date(0));
    doc.setProducer('CheckMyFile Deterministic Engine v2.0');

    const outputBytes = await doc.save({ useObjectStreams: false });
    const outputSha256 = await computeSha256(outputBytes);

    return {
      fixerId: 'FIX-BOX-01',
      applied: true,
      changes,
      bytes: outputBytes,
      inputSha256,
      outputSha256,
      executionTimeMs: Date.now() - startTime,
      toolsUsed: { 'pdf-lib': '1.17.1' },
    };
  },
};
