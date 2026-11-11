/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileText,
  Sliders,
  Type,
  Layers,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Image as ImageIcon,
  Palette,
  RotateCw,
  ExternalLink,
  Sparkles,
  FileCheck,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { DocumentPreflightResult, Anomaly, Severity, CheckItem } from '../types/preflight';
import { UNCOVERED_CHECKS_CATALOG } from '../rules/catalog';
import { FixerId } from '../fixers/types';

interface InspectionSidebarProps {
  result: DocumentPreflightResult;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  selectedAnomalyId: string | null;
  onSelectAnomaly: (anomaly: Anomaly) => void;
  onOpenRuleDetail?: (ruleId: string) => void;
  onTriggerFix?: (fixerIds: FixerId[]) => void;
}

export const InspectionSidebar: React.FC<InspectionSidebarProps> = ({
  result,
  selectedPage,
  setSelectedPage,
  selectedAnomalyId,
  onSelectAnomaly,
  onOpenRuleDetail,
  onTriggerFix,
}) => {
  const firstProblematicCategory = result.checks.find(
    (c) => c.status === 'error' || c.status === 'warning'
  )?.id || result.checks[0]?.id;

  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(firstProblematicCategory);
  const [showFileInfo, setShowFileInfo] = useState<boolean>(false);
  const [showScopeInfo, setShowScopeInfo] = useState<boolean>(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

  const toggleCategory = (id: string) => {
    setExpandedCheckId((current) => (current === id ? null : id));
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const getSeverityDot = (severity: Severity) => {
    switch (severity) {
      case 'error':
        return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" title="Non-conformité bloquante (BLOCKING)" />;
      case 'warning':
        return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" title="Point d’attention (ADVISORY)" />;
      case 'success':
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Conforme (PASS)" />;
      case 'unverifiable':
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" title="Non vérifiable ou non applicable" />;
    }
  };

  const getCategoryIcon = (checkId: CheckItem['id']) => {
    switch (checkId) {
      case 'bleed':
      case 'trim_box':
      case 'bleed_content':
        return <Scissors className="w-4 h-4 text-slate-400" />;
      case 'safety_margin':
        return <ShieldAlert className="w-4 h-4 text-slate-400" />;
      case 'text_size':
        return <Type className="w-4 h-4 text-slate-400" />;
      case 'fonts':
        return <FileText className="w-4 h-4 text-slate-400" />;
      case 'strokes':
        return <Sliders className="w-4 h-4 text-slate-400" />;
      case 'images':
        return <ImageIcon className="w-4 h-4 text-slate-400" />;
      case 'colorspace':
      case 'output_intent':
        return <Palette className="w-4 h-4 text-slate-400" />;
      case 'transparency':
        return <Layers className="w-4 h-4 text-slate-400" />;
      case 'overprint':
        return <Sparkles className="w-4 h-4 text-slate-400" />;
      case 'box_orientation':
        return <RotateCw className="w-4 h-4 text-slate-400" />;
      case 'annotations':
        return <MessageSquare className="w-4 h-4 text-slate-400" />;
      case 'ingest':
      default:
        return <FileCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  const availableSafeFixerIds: FixerId[] = [];
  if (result.checks.some(c => c.id === 'trim_box' && c.status !== 'success')) {
    availableSafeFixerIds.push('FIX-BOX-01');
  }
  if (result.checks.some(c => c.id === 'annotations' && c.status !== 'success')) {
    availableSafeFixerIds.push('FIX-ANNOT-01');
  }

  const firstPage = result.pages[0];
  const blockingCount = result.counters?.blockingIssuesCount ?? result.anomalies.filter((a) => a.severity === 'error').length;
  const advisoryCount = result.counters?.advisoryIssuesCount ?? result.anomalies.filter((a) => a.severity === 'warning').length;
  const notVerifiableCount = result.counters?.notVerifiableCount ?? result.checks.filter((c) => c.status === 'unverifiable').length;

  return (
    <aside className="w-full lg:w-96 xl:w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Points à examiner
          </h2>
          <p className="text-xs text-slate-400">
            {blockingCount > 0 ? (
              <span>
                <strong className="text-rose-400 font-semibold">{blockingCount} problème{blockingCount > 1 ? 's' : ''} bloquant{blockingCount > 1 ? 's' : ''}</strong>
                {advisoryCount > 0 && (
                  <span> · <strong className="text-amber-400 font-medium">{advisoryCount} point{advisoryCount > 1 ? 's' : ''} d’attention</strong></span>
                )}
              </span>
            ) : advisoryCount > 0 ? (
              <span className="text-amber-400 font-medium">
                {advisoryCount} point{advisoryCount > 1 ? 's' : ''} d’attention d’atelier
              </span>
            ) : notVerifiableCount > 0 ? (
              <span className="text-slate-400 font-medium">
                {notVerifiableCount} contrôle{notVerifiableCount > 1 ? 's' : ''} non vérifiable{notVerifiableCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-emerald-400 font-medium">
                Aucun problème détecté sur les contrôles effectués
              </span>
            )}
          </p>
        </div>

        <span className="text-[11px] font-mono tabular-nums text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          {result.checks.length} contrôles
        </span>
      </div>

      {/* Bouton global : Appliquer les corrections sûres (Niveau 1) */}
      {availableSafeFixerIds.length > 0 && onTriggerFix && (
        <div className="p-3 bg-cyan-950/40 border-b border-cyan-900/60 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-cyan-300 text-xs">
            <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold">{availableSafeFixerIds.length} correction{availableSafeFixerIds.length > 1 ? 's' : ''} sûre{availableSafeFixerIds.length > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => onTriggerFix(availableSafeFixerIds)}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Appliquer les corrections sûres</span>
          </button>
        </div>
      )}

      {/* Main Inspection List (Progressive Disclosure) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {result.checks.map((check) => {
          const isExpanded = expandedCheckId === check.id;
          const categoryGroups = result.anomalyGroups.filter((g) => g.checkId === check.id);
          const categoryAnomaliesCount = result.anomalies.filter((a) => a.checkId === check.id).length;
          const isConforming = check.status === 'success';

          return (
            <div key={check.id} className="transition-colors">
              {/* Category Row */}
              <button
                onClick={() => toggleCategory(check.id)}
                className={`w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-850 transition-colors ${
                  isExpanded ? 'bg-slate-850/80' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  {getSeverityDot(check.status)}
                  <div className="flex items-center gap-2 min-w-0">
                    {getCategoryIcon(check.id)}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shrink-0 font-bold">
                      {check.ruleId}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {check.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isConforming ? (
                    <span className="text-[11px] font-medium text-emerald-400">
                      Conforme
                    </span>
                  ) : check.status === 'unverifiable' ? (
                    <span className="text-[11px] text-slate-400">
                      Non vérifiable
                    </span>
                  ) : (
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      check.ruleSeverity === 'BLOCKING' ? 'bg-rose-950/80 text-rose-300 border border-rose-800' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                    }`}>
                      {categoryAnomaliesCount > 0 ? `${categoryAnomaliesCount} point${categoryAnomaliesCount > 1 ? 's' : ''}` : '1 point'}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Progressive Disclosure: Category Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 bg-slate-950/70 border-t border-slate-850 space-y-3 text-xs">
                  {/* Category Summary */}
                  <div className="pt-2 space-y-1.5 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] font-mono font-bold text-cyan-400">
                        Règle : {check.ruleId}
                      </span>
                      {onOpenRuleDetail && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRuleDetail(check.ruleId);
                          }}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <span>Fiche technique</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Constat :</span>
                      <span className="text-[11px] font-mono text-slate-200 text-right">
                        {check.detectedSummary}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Exigence :</span>
                      <span className="text-[11px] text-slate-300 text-right">
                        {check.expectedSummary}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                      {check.recommendation}
                    </p>
                    {/* Périmètre technique explicite */}
                    <div className="mt-2 bg-slate-900/60 p-2 rounded border border-slate-850 text-[10px] text-slate-400 leading-snug">
                      <span className="font-semibold text-slate-300">Périmètre vérifié : </span>
                      {check.technicalScope}
                    </div>

                    {/* Action de correction déterministe unitaire */}
                    {onTriggerFix && check.canAutoFix && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Correction assistée disponible</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                            Niveau {check.id === 'strokes' ? '2 (Contenu)' : check.id === 'colorspace' ? '3 (Couleur)' : '1 (Structure)'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 space-y-1">
                          <div>
                            <strong className="text-emerald-400">Ce qui va changer : </strong>
                            {check.id === 'trim_box'
                              ? 'Pose la TrimBox/BleedBox selon le format fini du profil'
                              : check.id === 'annotations'
                              ? 'Supprime les commentaires, notes et tampons résiduels'
                              : check.id === 'strokes'
                              ? 'Rehausse les filets ultra-fins au seuil d’atelier'
                              : 'Conversion des couleurs RVB vers CMJN (expérimental)'}
                          </div>
                          <div>
                            <strong className="text-cyan-400">Ce qui ne sera pas touché : </strong>
                            {check.id === 'trim_box'
                              ? 'Graphismes, textes et coordonnées inchangés'
                              : check.id === 'annotations'
                              ? 'Hyperliens (/Link) conservés à l’identique'
                              : check.id === 'strokes'
                              ? 'Remplissages et typographie intouchés'
                              : 'Mise en page et géométrie préservées'}
                          </div>
                        </div>
                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const fixerId: FixerId =
                                check.id === 'trim_box'
                                  ? 'FIX-BOX-01'
                                  : check.id === 'annotations'
                                  ? 'FIX-ANNOT-01'
                                  : check.id === 'strokes'
                                  ? 'FIX-HAIR-01'
                                  : 'FIX-COLOR-01';
                              onTriggerFix([fixerId]);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Corriger cette anomalie</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Grouped Anomalies */}
                  {categoryGroups.length > 0 ? (
                    <div className="space-y-2.5">
                      {categoryGroups.map((group) => {
                        const isGroupExpanded = expandedGroupIds[group.id] ?? (group.occurrences.length <= 3);
                        const isCritical = group.ruleSeverity === 'BLOCKING' || group.severity === 'error';

                        return (
                          <div
                            key={group.id}
                            className={`rounded-xl border transition-all overflow-hidden ${
                              isCritical
                                ? 'border-rose-900/60 bg-rose-950/20'
                                : group.severity === 'unverifiable'
                                ? 'border-slate-800 bg-slate-900/40'
                                : 'border-amber-900/60 bg-amber-950/20'
                            }`}
                          >
                            {/* Group Header */}
                            <div className="p-3 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-white">
                                  {group.title}
                                </span>
                                {group.pagesAffected.length > 0 && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded shrink-0">
                                    Page{group.pagesAffected.length > 1 ? 's' : ''} {group.pagesAffected.join(', ')}
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {group.explanation}
                              </p>

                              {group.expectedValue && (
                                <div className="text-[10px] font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800/80 text-slate-300">
                                  <span>Attendu : <strong className="text-emerald-400">{group.expectedValue}</strong></span>
                                </div>
                              )}
                            </div>

                            {/* Sub-occurrences */}
                            {group.occurrences.length > 1 && (
                              <div className="border-t border-slate-800/80 bg-slate-900/40">
                                <button
                                  onClick={() => toggleGroupExpand(group.id)}
                                  className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                                >
                                  <span>Détail des {group.occurrences.length} occurrences</span>
                                  {isGroupExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>

                                {isGroupExpanded && (
                                  <div className="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto divide-y divide-slate-800/40">
                                    {group.occurrences.map((occ, idx) => {
                                      const isSelected = selectedAnomalyId === occ.id;
                                      return (
                                        <div
                                          key={occ.id}
                                          onClick={() => {
                                            onSelectAnomaly({
                                              id: occ.id,
                                              checkId: group.checkId,
                                              severity: group.severity,
                                              ruleSeverity: group.ruleSeverity,
                                              title: group.title,
                                              explanation: occ.contextSnippet || group.explanation,
                                              page: occ.page,
                                              detectedValue: occ.detectedValue,
                                              expectedValue: group.expectedValue,
                                              recommendation: group.recommendation,
                                              canAutoFix: false,
                                              highlightBox: occ.highlightBox,
                                            });
                                          }}
                                          className={`py-1.5 px-2 rounded cursor-pointer transition-colors flex items-center justify-between text-[10px] ${
                                            isSelected ? 'bg-cyan-950/80 text-cyan-300 ring-1 ring-cyan-500' : 'hover:bg-slate-800/60 text-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className="font-mono text-slate-500">#{idx + 1}</span>
                                            <span className="truncate">Page {occ.page} {occ.detectedValue ? `— ${occ.detectedValue}` : ''}</span>
                                          </div>
                                          <span className="text-cyan-400 flex items-center gap-1 shrink-0 ml-2">
                                            <Eye className="w-2.5 h-2.5" />
                                            <span>Localiser</span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {group.occurrences.length === 1 && group.occurrences[0].highlightBox && (
                              <div className="px-3 pb-2 pt-1 border-t border-slate-800/60 flex justify-end">
                                <button
                                  onClick={() => {
                                    const occ = group.occurrences[0];
                                    onSelectAnomaly({
                                      id: occ.id,
                                      checkId: group.checkId,
                                      severity: group.severity,
                                      ruleSeverity: group.ruleSeverity,
                                      title: group.title,
                                      explanation: occ.contextSnippet || group.explanation,
                                      page: occ.page,
                                      detectedValue: occ.detectedValue,
                                      expectedValue: group.expectedValue,
                                      recommendation: group.recommendation,
                                      canAutoFix: false,
                                      highlightBox: occ.highlightBox,
                                    });
                                  }}
                                  className="text-[10px] text-cyan-400 font-medium inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Localiser sur le document</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : isConforming ? (
                    <div className="flex items-center gap-2 text-emerald-400 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Contrôle exécuté avec succès : aucun défaut détecté.</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Périmètre Technique Couvert vs Non Couvert (issu de UNCOVERED_CHECKS_CATALOG) */}
      <div className="border-t border-slate-800 bg-slate-950/90">
        <button
          onClick={() => setShowScopeInfo(!showScopeInfo)}
          className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Périmètre des contrôles prépresse</span>
          </div>
          {showScopeInfo ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {showScopeInfo && (
          <div className="px-4 pb-4 pt-1 space-y-3 text-[11px] border-t border-slate-850">
            <div>
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Contrôles exécutés et vérifiables (14 règles) :</span>
              </p>
              <ul className="space-y-1 text-slate-300 pl-4 list-disc marker:text-emerald-500">
                {result.coveredChecks.slice(0, 7).map((cov, i) => (
                  <li key={i}>{cov}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-850">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3" />
                <span>Contrôles non couverts dans cette version :</span>
              </p>
              <ul className="space-y-1 text-slate-400 pl-4 list-disc marker:text-amber-500">
                {UNCOVERED_CHECKS_CATALOG.map((uncov, i) => (
                  <li key={i}>{uncov}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Informations géométriques du fichier (Collapsible) */}
      <div className="border-t border-slate-800 bg-slate-950/80">
        <button
          onClick={() => setShowFileInfo(!showFileInfo)}
          className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Informations géométriques du fichier</span>
          </div>
          {showFileInfo ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {showFileInfo && (
          <div className="px-4 pb-4 pt-1 space-y-2 text-xs border-t border-slate-850">
            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Dimensions feuille (MediaBox) :</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {firstPage?.mediaBox.widthMm} × {firstPage?.mediaBox.heightMm} mm
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Ligne de coupe (TrimBox) :</span>
              <span className="font-mono text-cyan-300 tabular-nums">
                {firstPage?.hasExplicitTrimBox
                  ? `${firstPage.trimBox!.widthMm} × ${firstPage.trimBox!.heightMm} mm (balisée)`
                  : 'Absente du PDF'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Profil sélectionné :</span>
              <span className="text-slate-200 font-medium">
                {result.profile.name}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Nombre de pages :</span>
              <span className="font-mono text-slate-200">
                {result.pageCount} {result.hasMultiFormatPages ? '(multiformat)' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Poids du fichier :</span>
              <span className="font-mono text-slate-200">
                {(result.fileSizeBytes / 1024).toFixed(1)} Ko
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span>Polices vectorielles :</span>
              <span className="font-mono text-slate-200">
                {result.fonts.length} inspectée(s)
              </span>
            </div>

            {result.fonts.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
                {result.fonts.map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="truncate max-w-[220px]">{f.name}</span>
                    <span className={f.isEmbedded === true ? 'text-emerald-400' : f.isEmbedded === false ? 'text-rose-400' : 'text-slate-500'}>
                      {f.isEmbedded === true ? 'Incorporée' : f.isEmbedded === false ? 'Non incorporée' : 'Non vérifiable'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
