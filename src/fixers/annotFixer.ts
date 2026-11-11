/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-ANNOT-01 : Suppression des annotations non imprimables
 */

import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib';
import { FixerDefinition, FixPlan, FixExecutionResult, ChangeRecord } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

export const annotFixer: FixerDefinition = {
  id: 'FIX-ANNOT-01',
  name: 'Suppression des annotations et commentaires de relecture',
  version: '1.0.0',
  ruleIds: ['ANNOT-01'],
  riskLevel: 1,
  description: 'Supprime les annotations résiduelles (notes, commentaires, tampons, champs de formulaires) tout en préservant intacts les hyperliens (/Link).',
  businessObjective: 'Nettoie le document des balisages de relecture éditoriale avant le flashage des plaques d’impression.',
  preconditions: [
    'Le document doit comporter un dictionnaire /Annots contenant au moins une annotation non imprimable.',
  ],
  limits: [
    'Conserve rigoureusement les liens interactifs (/Link).',
    'Ne tente pas d’aplatir les annotations sous forme de pixels : elles sont supprimées du flux.',
  ],
  tools: [
    {
      name: 'pdf-lib',
      version: '1.17.1',
      deterministicOptions: ['useObjectStreams: false', 'fixedModificationDate'],
    },
  ],
  untouchedAspects: [
    'Hyperliens (/Link) conservés intacts.',
    'Graphismes vectoriels, textes éditoriaux et images inchangés.',
  ],

  plan: async (findings: RuleCheckResult[], _profile: PrintProfile): Promise<FixPlan> => {
    const annotCheck = findings.find(f => f.ruleId === 'ANNOT-01');
    const needsFix = annotCheck && annotCheck.status === 'FAIL';

    return {
      fixerId: 'FIX-ANNOT-01',
      applicable: !!needsFix,
      riskLevel: 1,
      plannedChanges: [
        'Suppression de toutes les annotations de type /Text, /FreeText, /Stamp, /Highlight, /Widget dans les tableaux /Annots des pages.',
        'Conservation intégrale des annotations de type /Link (hyperliens).',
      ],
      untouchedAspects: [
        'Hyperliens (/Link).',
        'Contenu typographique et vectoriel.',
      ],
      estimatedImpact: 'Résout la règle ANNOT-01 sans aucun impact visuel sur la mise en page.',
      userConfirmationRequired: false,
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, _profile: PrintProfile): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(inputBytes, { updateMetadata: false });
    } catch (err: any) {
      return {
        fixerId: 'FIX-ANNOT-01',
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
    const changes: ChangeRecord[] = [];
    let totalRemoved = 0;

    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i);
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;

      const annots = doc.context.lookup(annotsRef);
      if (!(annots instanceof PDFArray)) continue;

      const keptAnnots: any[] = [];
      const removedTypesOnPage: string[] = [];

      for (const aRef of annots.asArray()) {
        const annotObj = doc.context.lookup(aRef);
        if (annotObj instanceof PDFDict) {
          const subtype = annotObj.get(PDFName.of('Subtype'))?.toString();
          if (subtype === '/Link') {
            keptAnnots.push(aRef);
          } else {
            totalRemoved++;
            const cleanSubtype = subtype ? subtype.replace(/^\//, '') : 'Unknown';
            removedTypesOnPage.push(cleanSubtype);
          }
        } else {
          keptAnnots.push(aRef);
        }
      }

      if (removedTypesOnPage.length > 0) {
        if (keptAnnots.length > 0) {
          // Créer un nouveau tableau contenant seulement les liens
          page.node.set(PDFName.of('Annots'), doc.context.obj(keptAnnots));
        } else {
          // Supprimer complètement l'entrée /Annots de la page
          page.node.delete(PDFName.of('Annots'));
        }

        changes.push({
          pageNumber: i + 1,
          itemDescription: `Suppression de ${removedTypesOnPage.length} annotation(s) non imprimable(s)`,
          beforeValue: removedTypesOnPage.join(', '),
          afterValue: keptAnnots.length > 0 ? `${keptAnnots.length} lien(s) /Link conservé(s)` : '0 annotation résiduelle',
          technicalDetails: `Sous-types purgés: ${removedTypesOnPage.join(', ')}`,
        });
      }
    }

    if (totalRemoved === 0) {
      return {
        fixerId: 'FIX-ANNOT-01',
        applied: false,
        refusalReason: 'Aucune annotation non imprimable trouvée à supprimer (seuls des liens /Link ou aucune annotation sont présents).',
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { 'pdf-lib': '1.17.1' },
      };
    }

    // Normalisation déterministe
    doc.setModificationDate(new Date(0));
    doc.setProducer('CheckMyFile Deterministic Engine v2.0');

    const outputBytes = await doc.save({ useObjectStreams: false });
    const outputSha256 = await computeSha256(outputBytes);

    return {
      fixerId: 'FIX-ANNOT-01',
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
