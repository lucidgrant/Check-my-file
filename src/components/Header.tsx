/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, RefreshCw, CheckCircle2, AlertOctagon, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { DocumentPreflightResult } from '../types/preflight';

interface HeaderProps {
  result: DocumentPreflightResult | null;
  onReset: () => void;
  onDownloadReport: () => void;
  onOpenRuleCatalog?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  result,
  onReset,
  onDownloadReport,
  onOpenRuleCatalog,
}) => {
  const getStatusBadge = () => {
    if (!result) return null;

    switch (result.overallStatus) {
      case 'NO_ISSUE_ON_CHECKED_RULES':
      case 'no_issues_detected' as any:
        return {
          label: 'Aucun problème détecté sur les contrôles effectués',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        };
      case 'PROBLEMS_DETECTED':
      case 'issues_detected' as any:
        return {
          label: 'Problèmes détectés',
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />,
          classes: 'bg-rose-950/80 text-rose-300 border-rose-800',
        };
      case 'ATTENTION_REQUIRED':
      case 'attention_required' as any:
        return {
          label: 'Points d’attention',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
          classes: 'bg-amber-950/80 text-amber-300 border-amber-800',
        };
      case 'PARTIAL_VERIFICATION':
      case 'partial_verification' as any:
        return {
          label: 'Vérification partielle',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />,
          classes: 'bg-sky-950/80 text-sky-300 border-sky-800',
        };
      case 'ANALYSIS_FAILED':
      case 'analysis_failed' as any:
      default:
        return {
          label: 'Analyse impossible',
          icon: <XCircle className="w-3.5 h-3.5 text-slate-400" />,
          classes: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <header className="h-14 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Left: Logo & File Identity & Version Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/assets/aistudio/Blue_Minimalist_Digital_Print_Center_Logo_c71ad065.png"
          alt="Check MyFile"
          className="w-7 h-7 object-contain rounded-md shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-white tracking-tight shrink-0">
            Check MyFile
          </span>

          {result ? (
            <>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="text-xs font-mono text-slate-300 truncate max-w-[160px] sm:max-w-xs md:max-w-md" title={result.fileName}>
                {result.fileName}
              </span>
              <span className="hidden lg:inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                v{result.engineVersion || '2.2.0'}
              </span>
            </>
          ) : (
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Moteur v2.2.0
            </span>
          )}
        </div>
      </div>

      {/* Center / Right: General Status Badge + Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Bouton Référentiel des règles */}
        {onOpenRuleCatalog && (
          <button
            onClick={onOpenRuleCatalog}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Consulter le catalogue des 14 règles prépresse et leurs fiches techniques"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Règles & Normes (14)</span>
          </button>
        )}

        {result && (
          <>
            {/* Statut d'évaluation normatif */}
            {statusBadge && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${statusBadge.classes}`}
              >
                {statusBadge.icon}
                <span className="truncate max-w-[280px] sm:max-w-none">{statusBadge.label}</span>
              </div>
            )}

            {/* Bouton Remplacer le fichier */}
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Remplacer le fichier</span>
              <span className="sm:hidden">Remplacer</span>
            </button>

            {/* Bouton Télécharger le rapport */}
            {result.overallStatus !== 'ANALYSIS_FAILED' && (result.overallStatus as any) !== 'analysis_failed' && (
              <button
                onClick={onDownloadReport}
                className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le rapport</span>
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
};
