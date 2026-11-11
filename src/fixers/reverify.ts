/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Porte de Re-vérification Déterministe
 */

import { PrintProfile } from '../profiles/types';
import { RuleCheckResult, RuleStatus, RuleSeverity } from '../rules/types';
import { analyzePdfDocument } from '../services/pdfAnalyzer';
import { DocumentPreflightResult } from '../types/preflight';

export interface ReverificationGateResult {
  passedGate: boolean;
  refusalReason?: string;
  improvedRules: string[];
  worsenedRules: string[];
  unchangedRules: string[];
  beforeReport: DocumentPreflightResult;
  afterReport: DocumentPreflightResult;
}

function getRuleScore(status: RuleStatus, severity: RuleSeverity): number {
  if (status === 'PASS') return 4;
  if (status === 'NOT_APPLICABLE') return 3;
  if (status === 'NOT_VERIFIABLE') return 2;
  if (status === 'FAIL' && severity === 'ADVISORY') return 1;
  return 0; // FAIL BLOCKING ou ERROR
}

export async function reverifyCorrection(
  originalBytes: Uint8Array,
  correctedBytes: Uint8Array,
  fileName: string,
  profile: PrintProfile,
  targetedRuleIds: string[]
): Promise<ReverificationGateResult> {
  // 1. Exécuter le même moteur d'inspection sur les deux buffers
  const beforeReport = await analyzePdfDocument(originalBytes.buffer as ArrayBuffer, fileName, profile);
  const afterReport = await analyzePdfDocument(correctedBytes.buffer as ArrayBuffer, `corrigé_${fileName}`, profile);

  const beforeMap = new Map<string, RuleCheckResult>();
  for (const r of beforeReport.ruleResults) {
    beforeMap.set(r.ruleId, r);
  }

  const afterMap = new Map<string, RuleCheckResult>();
  for (const r of afterReport.ruleResults) {
    afterMap.set(r.ruleId, r);
  }

  const improvedRules: string[] = [];
  const worsenedRules: string[] = [];
  const unchangedRules: string[] = [];

  // 2. Comparer chaque règle
  for (const [ruleId, beforeResult] of beforeMap.entries()) {
    const afterResult = afterMap.get(ruleId);
    if (!afterResult) continue;

    const beforeScore = getRuleScore(beforeResult.status, beforeResult.severity);
    const afterScore = getRuleScore(afterResult.status, afterResult.severity);

    if (afterScore > beforeScore) {
      improvedRules.push(ruleId);
    } else if (afterScore < beforeScore) {
      worsenedRules.push(ruleId);
    } else {
      unchangedRules.push(ruleId);
    }
  }

  // 3. Critère A : Aucune règle ne doit empirer
  if (worsenedRules.length > 0) {
    const details = worsenedRules.map(id => {
      const b = beforeMap.get(id);
      const a = afterMap.get(id);
      return `${id} (${b?.status} ${b?.severity} → ${a?.status} ${a?.severity})`;
    }).join(', ');

    return {
      passedGate: false,
      refusalReason: `Correction rejetée par la porte de sécurité : régression détectée sur la règle ${details}.`,
      improvedRules,
      worsenedRules,
      unchangedRules,
      beforeReport,
      afterReport,
    };
  }

  // 4. Critère B : Au moins une règle ciblée doit obligatoirement s'améliorer
  const targetImproved = targetedRuleIds.some(tId => improvedRules.includes(tId));
  if (!targetImproved) {
    const targetsStatus = targetedRuleIds.map(tId => {
      const b = beforeMap.get(tId);
      const a = afterMap.get(tId);
      return `${tId} (${b?.status} → ${a?.status})`;
    }).join(', ');

    return {
      passedGate: false,
      refusalReason: `Correction rejetée par la porte de sécurité : aucune amélioration constatée sur la règle ciblée [${targetsStatus}]. Aucune modification superflue n’est conservée.`,
      improvedRules,
      worsenedRules,
      unchangedRules,
      beforeReport,
      afterReport,
    };
  }

  return {
    passedGate: true,
    improvedRules,
    worsenedRules,
    unchangedRules,
    beforeReport,
    afterReport,
  };
}
