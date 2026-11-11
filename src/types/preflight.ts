/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Typologie d'évaluation prépresse et résultats de contrôle
 */

import type { PrintProfile } from '../profiles/types';
import type { 
  RuleCheckResult, 
  RuleStatus, 
  RuleSeverity, 
  OverallVerdict, 
  PreflightCounters,
  ConfidenceLevel 
} from '../rules/types';

export type Severity = 'error' | 'warning' | 'success' | 'unverifiable'; // Compatibilité UI

export type OverallStatus = 
  | 'ANALYSIS_FAILED'             // Priorité 1 : Erreur technique, mot de passe, corruption
  | 'PROBLEMS_DETECTED'           // Priorité 2 : Au moins une non-conformité bloquante (BLOCKING)
  | 'ATTENTION_REQUIRED'          // Priorité 3 : Points d'attention d'atelier (ADVISORY)
  | 'PARTIAL_VERIFICATION'        // Priorité 4 : Certains contrôles impossibles à attester (NOT_VERIFIABLE)
  | 'NO_ISSUE_ON_CHECKED_RULES';  // Priorité 5 : « Aucun problème détecté sur les contrôles effectués »

// Alias lowercase pour rétro-compatibilité
export type OverallStatusLegacy = 
  | 'analysis_failed' 
  | 'issues_detected' 
  | 'attention_required' 
  | 'partial_verification' 
  | 'no_issues_detected';

export type { PrintProfile, ProductType, AllowedColorSpace, TransparencyPolicy } from '../profiles/types';
export type { RuleCheckResult, RuleStatus, RuleSeverity, OverallVerdict, PreflightCounters } from '../rules/types';

export interface BoxDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
}

export interface PageBoxes {
  pageNumber: number;
  rotationDegrees: number; // 0, 90, 180, 270
  mediaBox: BoxDimensions;
  trimBox?: BoxDimensions;
  bleedBox?: BoxDimensions;
  cropBox?: BoxDimensions;
  hasExplicitTrimBox: boolean;
  hasExplicitBleedBox: boolean;
}

export interface FontInfo {
  name: string;
  isEmbedded: boolean | null; // null = non vérifiable
  subtype?: string;
  pagesUsed: number[];
  detectionMethod: 'stream' | 'descriptor' | 'subset_prefix' | 'cid_descendant' | 'standard14' | 'unverifiable';
}

export type CheckItemId = 
  | 'bleed'           // BLEED-01
  | 'trim_box'        // BLEED-02
  | 'bleed_content'   // BLEED-03
  | 'safety_margin'   // MARGIN-01
  | 'text_size'       // TEXT-01
  | 'fonts'           // FONT-01
  | 'strokes'         // STROKE-01
  | 'images'          // IMAGE-01
  | 'colorspace'      // COLOR-01
  | 'output_intent'   // COLOR-02
  | 'transparency'    // TRANSP-01
  | 'overprint'       // OVERPRINT-01
  | 'box_orientation' // BOX-01
  | 'ingest'          // INGEST-01
  | 'annotations';    // ANNOT-01

export interface CheckItem {
  id: CheckItemId;
  ruleId: string; // Ex: 'BLEED-01', 'IMAGE-01', etc.
  category: string;
  title: string;
  status: Severity;
  ruleStatus: RuleStatus;
  ruleSeverity: RuleSeverity;
  detectedSummary: string;
  expectedSummary: string;
  recommendation: string;
  technicalScope: string;
  canAutoFix: boolean;
  anomalyCount: number;
  confidenceLevel: ConfidenceLevel;
  detectionMethod?: string;
}

export interface AnomalyOccurrence {
  id: string;
  page: number;
  detectedValue?: string;
  highlightBox?: {
    xPt: number;
    yPt: number;
    widthPt: number;
    heightPt: number;
    page: number;
  };
  contextSnippet?: string;
}

export interface AnomalyGroup {
  id: string;
  checkId: CheckItemId;
  ruleId: string;
  severity: Severity;
  ruleSeverity: RuleSeverity;
  title: string;
  explanation: string;
  expectedValue: string;
  recommendation: string;
  pagesAffected: number[];
  occurrences: AnomalyOccurrence[];
}

export interface Anomaly {
  id: string;
  checkId: CheckItemId;
  ruleId?: string;
  severity: Severity;
  ruleSeverity?: RuleSeverity;
  title: string;
  explanation: string;
  page?: number;
  detectedValue?: string;
  expectedValue?: string;
  recommendation: string;
  canAutoFix: boolean;
  autoFixNote?: string;
  highlightBox?: {
    xPt: number;
    yPt: number;
    widthPt: number;
    heightPt: number;
    page: number;
  };
}

export interface DocumentPreflightResult {
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  profile: PrintProfile;
  overallStatus: OverallStatus;
  statusLabel: string;
  statusDescription: string;
  analyzedAt: string;
  
  // Versions de gouvernance
  engineVersion: string;
  catalogVersion: string;
  profileVersion: string;

  // Compteurs indépendants
  counters: PreflightCounters;
  
  pages: PageBoxes[];
  checks: CheckItem[];
  ruleResults: RuleCheckResult[];
  anomalyGroups: AnomalyGroup[];
  anomalies: Anomaly[];
  fonts: FontInfo[];
  
  // Périmètre de couverture explicite
  coveredChecks: string[];
  uncoveredChecks: string[];
  
  // Indicateurs de diagnostic
  hasTransparencies: boolean;
  hasMissingBleed: boolean;
  hasMarginViolations: boolean;
  hasTextSizeViolations: boolean;
  hasFontIssues: boolean;
  hasStrokeIssues: boolean;
  hasImageIssues: boolean;
  hasColorIssues: boolean;
  hasMultiFormatPages: boolean;
  hasRotatedPages: boolean;
  
  // En cas d'échec d'analyse
  analysisError?: {
    code: 'CORRUPTED' | 'PASSWORD_PROTECTED' | 'UNSUPPORTED' | 'FILE_TOO_LARGE' | 'UNKNOWN';
    message: string;
  };
}
