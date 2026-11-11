/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Contrat normalisé des correcteurs prépresse déterministes
 */

import type { PrintProfile } from '../profiles/types';
import type { RuleCheckResult, OverallVerdict } from '../rules/types';
import type { PreflightReport } from '../types/preflight';

export type FixerId = 
  | 'FIX-BOX-01'
  | 'FIX-STRUCT-01'
  | 'FIX-SEC-01'
  | 'FIX-ANNOT-01'
  | 'FIX-HAIR-01'
  | 'FIX-COLOR-01';

/**
 * Niveaux de risque :
 * 1 = structure, sans toucher au visuel (un clic)
 * 2 = modifie le contenu (confirmation explicite requise)
 * 3 = rendu ou couleur (confirmation explicite requise)
 */
export type RiskLevel = 1 | 2 | 3;

export type FixerToolName = 'pdf-lib' | 'qpdf' | 'ghostscript';

export interface ToolVersionInfo {
  name: FixerToolName;
  version: string;
  license?: string;
  deterministicOptions: string[];
}

export interface ChangeRecord {
  pageNumber?: number;
  itemDescription: string;
  beforeValue: string;
  afterValue: string;
  technicalDetails?: string;
}

export interface FixPlan {
  fixerId: FixerId;
  applicable: boolean;
  refusalReason?: string;
  riskLevel: RiskLevel;
  plannedChanges: string[];
  untouchedAspects: string[];
  estimatedImpact: string;
  userConfirmationRequired: boolean;
  confirmationPrompt?: string;
}

export interface FixExecutionResult {
  fixerId: FixerId;
  applied: boolean;
  refusalReason?: string;
  changes: ChangeRecord[];
  bytes: Uint8Array;
  inputSha256: string;
  outputSha256: string;
  executionTimeMs: number;
  toolsUsed: Record<string, string>;
}

export interface FixerDefinition {
  id: FixerId;
  name: string;
  version: string;
  ruleIds: string[]; // Règles ciblées (ex: ['BLEED-02'], ['STROKE-01'])
  riskLevel: RiskLevel;
  description: string;
  businessObjective: string;
  preconditions: string[];
  limits: string[];
  tools: ToolVersionInfo[];
  untouchedAspects: string[];
  isExperimental?: boolean;
  plan: (findings: RuleCheckResult[], profile: PrintProfile, extraOptions?: Record<string, any>) => Promise<FixPlan> | FixPlan;
  apply: (inputBytes: Uint8Array, plan: FixPlan, profile: PrintProfile, extraOptions?: Record<string, any>) => Promise<FixExecutionResult>;
}

export interface FixAuditLog {
  auditId: string;
  timestampIso: string;
  originalFileName: string;
  originalSha256: string;
  correctedSha256: string;
  profileId: string;
  appliedFixers: {
    fixerId: FixerId;
    fixerName: string;
    version: string;
    riskLevel: RiskLevel;
    changes: ChangeRecord[];
    toolsUsed: Record<string, string>;
  }[];
  reverification: {
    passedGate: boolean;
    gateMessage: string;
    beforeVerdict: OverallVerdict | string;
    afterVerdict: OverallVerdict | string;
    improvedRules: string[];
    worsenedRules: string[];
    unchangedRules: string[];
  };
  workshopConventionNote: string;
}

export interface FixApiRequest {
  pdfBase64: string;
  fileName: string;
  profileId: string;
  fixerIds: FixerId[];
  confirmations?: Record<string, boolean>;
}

export interface FixApiResponse {
  success: boolean;
  refusalReason?: string;
  correctedPdfBase64?: string;
  auditLog?: FixAuditLog;
  beforeReport?: PreflightReport;
  afterReport?: PreflightReport;
}
