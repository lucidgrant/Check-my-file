/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — FIX-HAIR-01 : Épaississement déterministe des filets trop fins (Hairlines)
 */

import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { FixerDefinition, FixPlan, FixExecutionResult, ChangeRecord } from './types';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';
import { computeSha256 } from './cryptoUtils';

export const hairlineFixer: FixerDefinition = {
  id: 'FIX-HAIR-01',
  name: 'Épaississement préventif des filets ultra-fins (Hairlines)',
  version: '1.0.0',
  ruleIds: ['STROKE-01'],
  riskLevel: 2,
  description: 'Porte l’épaisseur des contours vectoriels sous le seuil d’atelier au seuil minimum du profil pour éviter leur disparition au tirage.',
  businessObjective: 'Garantir la visibilité physique des traits fins lors de la gravure des plaques offset et de l’impression numérique.',
  preconditions: [
    'Le document doit comporter des filets vectoriels tracés d’épaisseur strictement inférieure au seuil du profil.',
    'L’utilisateur doit confirmer la modification visuelle des épaisseurs de contour.',
  ],
  limits: [
    'Modifie uniquement les opérateurs d’épaisseur de trait (w) associés à un tracé (S, s, B, B*).',
    'N’altère pas les aplats de remplissage (f, F, f*).',
    'Ne modifie pas les filets rasterisés à l’intérieur des images matricielles.',
  ],
  tools: [
    {
      name: 'pdf-lib',
      version: '1.17.1',
      deterministicOptions: ['useObjectStreams: false', 'fixedModificationDate'],
    },
  ],
  untouchedAspects: [
    'Couleurs des traits (CMJN/RVB) conservées à l’identique.',
    'Trajectoires géométriques, courbes de Bézier et coordonnées des points inchangées.',
    'Textes et images matricielles non modifiés.',
  ],

  plan: async (findings: RuleCheckResult[], profile: PrintProfile): Promise<FixPlan> => {
    const strokeCheck = findings.find(f => f.ruleId === 'STROKE-01');
    const needsFix = strokeCheck && strokeCheck.status === 'FAIL';

    return {
      fixerId: 'FIX-HAIR-01',
      applicable: !!needsFix,
      riskLevel: 2,
      plannedChanges: [
        `Rehaussement des épaisseurs de trait inférieures à ${profile.advisoryStrokeWidthPt} pt jusqu’au seuil de ${profile.advisoryStrokeWidthPt} pt.`,
        'Mise à jour directe des opérateurs "w" dans les flux de contenu des pages concernées.',
      ],
      untouchedAspects: [
        'Formes des tracés, couleurs et remplissages.',
        'Mise en page et typographie.',
      ],
      estimatedImpact: 'Évite la disparition physique des filets lors du tramage RIP tout en épaississant légèrement les traits concernés.',
      userConfirmationRequired: true,
      confirmationPrompt: `Confirmez-vous l’épaississement des filets trop fins au seuil d’atelier de ${profile.advisoryStrokeWidthPt} pt ?`,
    };
  },

  apply: async (inputBytes: Uint8Array, _plan: FixPlan, profile: PrintProfile, extraOptions?: Record<string, any>): Promise<FixExecutionResult> => {
    const startTime = Date.now();
    const inputSha256 = await computeSha256(inputBytes);

    if (extraOptions?.confirmVisualChanges !== true) {
      return {
        fixerId: 'FIX-HAIR-01',
        applied: false,
        refusalReason: 'Confirmation requise : Vous devez accepter la modification visuelle de l’épaisseur des contours.',
        changes: [],
        bytes: inputBytes,
        inputSha256,
        outputSha256: inputSha256,
        executionTimeMs: Date.now() - startTime,
        toolsUsed: { 'pdf-lib': '1.17.1' },
      };
    }

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(inputBytes, { updateMetadata: false });
    } catch (err: any) {
      return {
        fixerId: 'FIX-HAIR-01',
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

    const targetWidthPt = profile.advisoryStrokeWidthPt || 0.5;
    const pageCount = doc.getPageCount();
    const changes: ChangeRecord[] = [];
    let totalModifiedStrokes = 0;

    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i);
      const contentsRef = page.node.get(PDFName.of('Contents'));
      if (!contentsRef) continue;

      const contents = doc.context.lookup(contentsRef);
      const streamRefs = contents instanceof PDFArray ? contents.asArray() : [contentsRef];

      for (const sRef of streamRefs) {
        const stream = doc.context.lookup(sRef);
        if (!(stream instanceof PDFRawStream)) continue;

        let streamText = '';
        try {
          const decoded = decodePDFRawStream(stream);
          streamText = new TextDecoder('latin1').decode(decoded.decode());
        } catch {
          streamText = new TextDecoder('latin1').decode(stream.contents);
        }

        let streamHasChanges = false;
        // Remplacer les opérateurs "w" dont la valeur est inférieure au seuil
        const modifiedText = streamText.replace(/([\d.]+)\s+w\b/g, (match, valStr) => {
          const widthVal = parseFloat(valStr);
          if (!isNaN(widthVal) && widthVal > 0 && widthVal < targetWidthPt) {
            streamHasChanges = true;
            totalModifiedStrokes++;
            changes.push({
              pageNumber: i + 1,
              itemDescription: `Filet trop fin rehaussé à l’épaisseur minimale d’atelier`,
              beforeValue: `${widthVal.toFixed(2)} pt`,
              afterValue: `${targetWidthPt.toFixed(2)} pt`,
              technicalDetails: `Opérateur "w" mis à jour : "${match}" remplacé par "${targetWidthPt.toFixed(2)} w"`,
            });
            return `${targetWidthPt.toFixed(2)} w`;
          }
          return match;
        });

        if (streamHasChanges) {
          const newFlateStream = doc.context.flateStream(new TextEncoder().encode(modifiedText));
          doc.context.assign(sRef, newFlateStream);
        }
      }
    }

    if (totalModifiedStrokes === 0) {
      return {
        fixerId: 'FIX-HAIR-01',
        applied: false,
        refusalReason: `Aucun filet d’épaisseur inférieure au seuil (${targetWidthPt} pt) n’a été identifié dans les flux vectoriels.`,
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
      fixerId: 'FIX-HAIR-01',
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
