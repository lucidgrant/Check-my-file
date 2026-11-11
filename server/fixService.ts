/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Service d'orchestration de correction déterministe côté serveur
 */

import { FixApiRequest, FixApiResponse, FixAuditLog, ChangeRecord } from '../src/fixers/types';
import { getFixerById } from '../src/fixers/registry';
import { DEFAULT_PROFILES } from '../src/profiles/registry';
import { analyzePdfDocument } from '../src/services/pdfAnalyzer';
import { reverifyCorrection } from '../src/fixers/reverify';
import { computeSha256, bufferToBase64, base64ToBuffer } from '../src/fixers/cryptoUtils';

export async function processFixRequest(req: FixApiRequest): Promise<FixApiResponse> {
  const profile = DEFAULT_PROFILES.find(p => p.id === req.profileId) || DEFAULT_PROFILES[0];
  const inputBytes = base64ToBuffer(req.pdfBase64);
  const inputSha256 = await computeSha256(inputBytes);

  // 1. Audit initial du document avant toute correction
  const initialReport = await analyzePdfDocument(inputBytes.buffer as ArrayBuffer, req.fileName, profile);

  if (initialReport.overallStatus === 'ANALYSIS_FAILED') {
    // Si échec complet, seuls FIX-STRUCT-01 ou FIX-SEC-01 peuvent être tentés
    const canAttemptRepair = req.fixerIds.some(id => id === 'FIX-STRUCT-01' || id === 'FIX-SEC-01');
    if (!canAttemptRepair) {
      return {
        success: false,
        refusalReason: 'Le document est illisible ou corrompu. Seule une réparation structurelle (FIX-STRUCT-01 / FIX-SEC-01) peut être tentée.',
        beforeReport: initialReport,
      };
    }
  }

  let currentBytes = inputBytes;
  const appliedFixersLog: FixAuditLog['appliedFixers'] = [];
  const allTargetedRuleIds: string[] = [];

  // 2. Application séquentielle des correcteurs demandés
  for (const fixerId of req.fixerIds) {
    const fixer = getFixerById(fixerId);
    if (!fixer) {
      return {
        success: false,
        refusalReason: `Correcteur inconnu : ${fixerId}`,
        beforeReport: initialReport,
      };
    }

    allTargetedRuleIds.push(...fixer.ruleIds);

    // Planification
    const plan = await fixer.plan(initialReport.ruleResults, profile);

    // Options supplémentaires et confirmations utilisateur
    const extraOptions: Record<string, any> = {
      confirmLegalRights: req.confirmations?.confirmLegalRights === true,
      confirmVisualChanges: req.confirmations?.confirmVisualChanges === true,
      confirmColorConversion: req.confirmations?.confirmColorConversion === true,
    };

    // Exécution du correcteur
    const execResult = await fixer.apply(currentBytes, plan, profile, extraOptions);

    if (!execResult.applied) {
      return {
        success: false,
        refusalReason: `Correction ${fixer.id} refusée : ${execResult.refusalReason || 'Préconditions non satisfaites'}`,
        beforeReport: initialReport,
      };
    }

    // Mettre à jour le flux de travail et consigner le journal
    currentBytes = execResult.bytes;
    appliedFixersLog.push({
      fixerId: fixer.id,
      fixerName: fixer.name,
      version: fixer.version,
      riskLevel: fixer.riskLevel,
      changes: execResult.changes,
      toolsUsed: execResult.toolsUsed,
    });
  }

  if (appliedFixersLog.length === 0) {
    return {
      success: false,
      refusalReason: 'Aucun correcteur applicable n’a été exécuté.',
      beforeReport: initialReport,
    };
  }

  // 3. Porte de Re-vérification stricte
  const gateResult = await reverifyCorrection(
    inputBytes,
    currentBytes,
    req.fileName,
    profile,
    allTargetedRuleIds
  );

  if (!gateResult.passedGate) {
    return {
      success: false,
      refusalReason: gateResult.refusalReason || 'Échec de validation après correction.',
      beforeReport: gateResult.beforeReport,
      afterReport: gateResult.afterReport,
    };
  }

  // 4. Construction du journal d'audit complet
  const outputSha256 = await computeSha256(currentBytes);
  const auditLog: FixAuditLog = {
    auditId: `FIX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestampIso: new Date().toISOString(),
    originalFileName: req.fileName,
    originalSha256: inputSha256,
    correctedSha256: outputSha256,
    profileId: profile.id,
    appliedFixers: appliedFixersLog,
    reverification: {
      passedGate: true,
      gateMessage: 'Re-vérification réussie : amélioration prouvée sur les règles ciblées sans aucune régression.',
      beforeVerdict: gateResult.beforeReport.overallStatus,
      afterVerdict: gateResult.afterReport.overallStatus,
      improvedRules: gateResult.improvedRules,
      worsenedRules: gateResult.worsenedRules,
      unchangedRules: gateResult.unchangedRules,
    },
    workshopConventionNote: "Convention d'atelier, à valider par un imprimeur",
  };

  return {
    success: true,
    correctedPdfBase64: bufferToBase64(currentBytes),
    auditLog,
    beforeReport: gateResult.beforeReport,
    afterReport: gateResult.afterReport,
  };
}
