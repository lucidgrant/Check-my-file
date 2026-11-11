/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, BookOpen, ShieldCheck, ExternalLink, AlertTriangle, CheckCircle, Info, ChevronRight, Layers } from 'lucide-react';
import { PREFLIGHT_RULES, RULE_CATALOG_VERSION, getRuleById } from '../rules/catalog';
import { PreflightRule } from '../rules/types';
import { PrintProfile } from '../types/preflight';

interface RuleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRuleId?: string;
  activeProfile?: PrintProfile;
}

export const RuleDetailModal: React.FC<RuleDetailModalProps> = ({
  isOpen,
  onClose,
  initialRuleId,
  activeProfile,
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId || PREFLIGHT_RULES[0].id);

  if (!isOpen) return null;

  const currentRule: PreflightRule = getRuleById(selectedRuleId) || PREFLIGHT_RULES[0];

  const getCategoryBadge = (category: PreflightRule['category']) => {
    switch (category) {
      case 'geometry':
        return { label: 'Géométrie & Coupe', color: 'bg-cyan-950 text-cyan-400 border-cyan-800' };
      case 'margins':
        return { label: 'Zone de sécurité', color: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
      case 'typography':
        return { label: 'Typographie & Polices', color: 'bg-purple-950 text-purple-400 border-purple-800' };
      case 'vector':
        return { label: 'Filets vectoriels', color: 'bg-amber-950 text-amber-400 border-amber-800' };
      case 'images':
        return { label: 'Images & Résolution', color: 'bg-blue-950 text-blue-400 border-blue-800' };
      case 'color':
        return { label: 'Colorimétrie & Séparation', color: 'bg-rose-950 text-rose-400 border-rose-800' };
      case 'standards':
        return { label: 'Normes & OutputIntent', color: 'bg-teal-950 text-teal-400 border-teal-800' };
      case 'transparency':
        return { label: 'Transparences', color: 'bg-indigo-950 text-indigo-400 border-indigo-800' };
      case 'overprint':
        return { label: 'Surimpression', color: 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-800' };
      case 'integrity':
        return { label: 'Intégrité & Accès', color: 'bg-slate-800 text-slate-300 border-slate-700' };
      case 'structure':
      default:
        return { label: 'Structure & Pages', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const catBadge = getCategoryBadge(currentRule.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Référentiel & Fiches Règles Prépresse
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                  Catalogue v{RULE_CATALOG_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Spécifications normatives et gouvernance des contrôles déterministes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Sidebar Selector + Detail View */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Rules List (Left Sidebar) */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 overflow-y-auto shrink-0 p-2 space-y-1">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Règles métier ({PREFLIGHT_RULES.length})
            </div>
            {PREFLIGHT_RULES.map((rule) => {
              const isSelected = rule.id === currentRule.id;
              return (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-cyan-950/60 text-cyan-300 font-semibold border border-cyan-800/80'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-cyan-400">{rule.id}</span>
                      <span className="text-[10px] text-slate-500">v{rule.version}</span>
                    </div>
                    <div className="text-xs truncate text-slate-300">{rule.name}</div>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>

          {/* Rule Detail Sheet (Right Pane) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Header info */}
            <div className="space-y-3 pb-4 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {currentRule.id}
                </span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${catBadge.color}`}>
                  {catBadge.label}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Version de la règle : v{currentRule.version}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white">
                {currentRule.name}
              </h3>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Objectif atelier : </span>
                  {currentRule.objective}
                </div>
              </div>
            </div>

            {/* Profile Context Banner (if activeProfile provided) */}
            {activeProfile && (
              <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/50 text-xs text-cyan-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Profil d'impression actif :</span> {activeProfile.name}
                </div>
                <div className="text-right font-mono text-[11px]">
                  {currentRule.id === 'BLEED-01' && `Exigence : ${activeProfile.requiredBleedMm} mm`}
                  {currentRule.id === 'MARGIN-01' && `Exigence : ${activeProfile.requiredSafetyMarginMm} mm`}
                  {currentRule.id === 'TEXT-01' && `Exigence : ≥ ${activeProfile.minTextSizePt} pt`}
                  {currentRule.id === 'STROKE-01' && `Exigence : ≥ ${activeProfile.minStrokeWidthPt} pt`}
                  {currentRule.id === 'TRANSP-01' && `Standard : ${activeProfile.pdfxStandard || 'PDF/X-4'}`}
                </div>
              </div>
            )}

            {/* Technical Specifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Définition technique exacte
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {currentRule.technicalDefinition}
                </p>
              </div>

              <div className="space-y-1.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Méthode de détection
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {currentRule.detectionMethodDescription}
                </p>
                <div className="text-[11px] font-mono text-cyan-400/80 pt-1">
                  Type : {currentRule.detectionMethod}
                </div>
              </div>
            </div>

            {/* Impresario phrasing */}
            <div className="space-y-1.5 text-xs p-3.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="font-bold text-white">Formulation professionnelle (vocabulaire imprimeur)</div>
              <p className="text-slate-300 italic">
                « {currentRule.professionalPhrasing} »
              </p>
            </div>

            {/* Normative References */}
            {currentRule.technicalReferences.length > 0 && (
              <div className="space-y-2 text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  Références normatives & Standards industriels
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentRule.technicalReferences.map((ref, i) => (
                    <div key={i} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px]">
                      <div className="font-semibold text-cyan-300">{ref.name}</div>
                      <div className="text-slate-400 font-mono">{ref.standard}</div>
                      {ref.section && <div className="text-slate-500 text-[10px] mt-0.5">{ref.section}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations connues */}
            {currentRule.knownLimitations.length > 0 && (
              <div className="space-y-1.5 text-xs p-3.5 bg-amber-950/20 rounded-xl border border-amber-900/40 text-amber-200/90">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Limitations techniques connues
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-200/80 text-[11px]">
                  {currentRule.knownLimitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Atelier Recommendation */}
            <div className="p-3.5 bg-emerald-950/20 rounded-xl border border-emerald-900/40 text-emerald-200/90 text-xs space-y-1">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Recommandation atelier
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                {currentRule.userMessages.atelierRecommendation}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Check MyFile Rule Governance Engine • Moteur déterministe prépresse
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
