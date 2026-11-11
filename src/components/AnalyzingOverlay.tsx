import React from 'react';
import { Loader2, CheckCircle2, Shield, Scan, FileSearch, Layers } from 'lucide-react';

interface AnalyzingOverlayProps {
  progressStep: string;
  progressPercentage: number;
}

export const AnalyzingOverlay: React.FC<AnalyzingOverlayProps> = ({
  progressStep,
  progressPercentage,
}) => {
  const steps = [
    { title: 'Zones géométriques (MediaBox & TrimBox)', targetPct: 20 },
    { title: 'Calcul des fonds perdus (5 mm)', targetPct: 40 },
    { title: 'Marges de sécurité & Zone tranquille (10 mm)', targetPct: 60 },
    { title: 'Typographie & Corps de texte (< 8 pt)', targetPct: 75 },
    { title: 'Incorporation des polices & Transparences', targetPct: 90 },
    { title: 'Synthèse du diagnostic d’impression', targetPct: 100 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 animate-ping opacity-25" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/50">
              <Scan className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Analyse prévol en cours
            </h3>
            <p className="text-xs text-slate-400 mt-1 min-h-[1.25rem] truncate">
              {progressStep || 'Vérification des normes d’impression...'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
            <span>Progression du scan</span>
            <span className="text-cyan-400 font-semibold">{progressPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Steps breakdown list */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          {steps.map((st, index) => {
            const isCompleted = progressPercentage >= st.targetPct;
            const isCurrent = progressPercentage < st.targetPct && (index === 0 || progressPercentage >= steps[index - 1].targetPct);

            return (
              <div
                key={index}
                className={`flex items-center gap-2.5 text-xs transition-colors ${
                  isCompleted
                    ? 'text-emerald-400 font-medium'
                    : isCurrent
                    ? 'text-cyan-300 font-semibold'
                    : 'text-slate-600'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-cyan-400" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                )}
                <span className="truncate">{st.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
