/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Typologie normalisée du référentiel des règles métier
 */

export type RuleStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIABLE' | 'NOT_APPLICABLE' | 'ERROR';

export type RuleSeverity = 'BLOCKING' | 'ADVISORY';

export type RuleCategory = 
  | 'geometry'        // Fond perdu, boîtes de coupe, format fini (BLEED-01, BLEED-02, BLEED-03)
  | 'margins'         // Zone tranquille, marges intérieures (MARGIN-01)
  | 'typography'      // Polices vectorielles, sous-ensembles (FONT-01, TEXT-01)
  | 'vector'          // Filets maigres, contours (STROKE-01)
  | 'images'          // Résolution matricielle, DPI (IMAGE-01)
  | 'color'           // Espaces colorimétriques, noir 100% K (COLOR-01)
  | 'standards'       // OutputIntent, PDF/X (COLOR-02)
  | 'transparency'    // Opacité, masques, modes de fusion (TRANSP-01)
  | 'overprint'       // Surimpression /OP, défonce (OVERPRINT-01)
  | 'structure'       // Rotation, multiformat (BOX-01)
  | 'integrity'       // Chiffrement, corruption, pages exploitables (INGEST-01)
  | 'annotations';    // Annotations non imprimables, notes, tampons, formulaires (ANNOT-01)

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ImplementationStatus = 'complete' | 'approximate' | 'partial' | 'stub';

export type OverallVerdict = 
  | 'ANALYSIS_FAILED'             // Priorité 1 : Erreur technique, mot de passe, fichier corrompu
  | 'PROBLEMS_DETECTED'           // Priorité 2 : Au moins une non-conformité BLOCKING
  | 'ATTENTION_REQUIRED'          // Priorité 3 : Aucune non-conformité bloquante mais au moins un point d'attention ADVISORY
  | 'PARTIAL_VERIFICATION'        // Priorité 4 : Aucun FAIL mais au moins un contrôle NOT_VERIFIABLE
  | 'NO_ISSUE_ON_CHECKED_RULES';  // Priorité 5 : 100% PASS ou NOT_APPLICABLE sur tous les contrôles effectués

export interface PreflightCounters {
  blockingIssuesCount: number;
  advisoryIssuesCount: number;
  notVerifiableCount: number;
  notApplicableCount: number;
  errorCount: number;
  totalRulesEvaluated: number;
  passedRulesCount: number;
}

export interface RuleParameterDef {
  key: string;
  name: string;
  unit: string;
  description: string;
  defaultValue?: string | number | boolean;
}

export interface TechnicalReference {
  name: string;
  standard: string;
  section?: string;
  url?: string;
  verified: boolean; // Marqué "false" (non vérifié) si la clause exacte n'a pas été formellement auditée
}

export interface RuleUserMessages {
  title: string;
  passSummary: string;
  failBlockingSummary: string;
  failAdvisorySummary: string;
  notVerifiableSummary: string;
  notApplicableSummary: string;
  atelierRecommendation: string;
}

export interface PreflightRule {
  id: string; // Ex: 'BLEED-01', 'IMAGE-01', 'COLOR-01'
  name: string;
  version: string;
  category: RuleCategory;
  objective: string;
  businessDescription: string;
  technicalDefinition: string;
  parameters: RuleParameterDef[];
  primaryUnit: string;
  detectionMethod: 
    | 'pdf_box_math' 
    | 'glyph_bbox' 
    | 'font_stream' 
    | 'operator_stream' 
    | 'extgstate' 
    | 'image_ctm' 
    | 'colorspace_audit' 
    | 'output_intent' 
    | 'bleed_raster_edge' 
    | 'structure_meta'
    | 'annotations_audit';
  detectionMethodDescription: string;
  applicationConditions: string;
  defaultSeverity: RuleSeverity;
  knownLimitations: string[];
  implementationStatus: ImplementationStatus;
  confidenceLevel: ConfidenceLevel;
  userMessages: RuleUserMessages;
  professionalPhrasing: string;
  technicalReferences: TechnicalReference[];
  associatedTestIds: string[];
}

export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  category: RuleCategory;
  status: RuleStatus;
  severity: RuleSeverity;
  observedValue: string;
  expectedValue: string;
  primaryUnit: string;
  affectedPages: number[];
  coordinates?: { xPt: number; yPt: number; widthPt: number; heightPt: number };
  detectionMethod: string;
  confidenceLevel: ConfidenceLevel;
  notVerifiableReason?: string;
  failureReason?: string;
  recommendation: string;
  explanation: string;
  anomaliesCount: number;
}

export interface RuleCatalogMetadata {
  catalogVersion: string;
  engineVersion: string;
  lastUpdated: string;
  rulesCount: number;
  rules: PreflightRule[];
}
