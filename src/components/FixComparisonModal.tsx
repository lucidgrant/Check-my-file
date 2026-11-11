/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Modal de Correction Déterministe & Comparaison Avant / Après
 */

import React, { useState } from 'react';
import {
  X,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Download,
  CheckCircle2,
  ArrowRight,
  Info,
  FileCheck,
  Server,
  Lock,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { FixerId, FixAuditLog, FixApiResponse, RiskLevel } from '../fixers/types';
import { ALL_FIXERS } from '../fixers/registry';
import { DocumentPreflightResult } from '../types/preflight';
import { bufferToBase64, base64ToBuffer } from '../fixers/cryptoUtils';

interface FixComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalBytes: Uint8Array;
  fileName: string;
  profileId: string;
  initialReport: DocumentPreflightResult;
  targetFixerIds: FixerId[];
  onApplyCorrectedPdf: (correctedBytes: Uint8Array, newReport: DocumentPreflightResult, auditLog: FixAuditLog) => void;
}

export const FixComparisonModal: React.FC<FixComparisonModalProps> = ({
  isOpen,
  onClose,
  originalBytes,
  fileName,
  profileId,
  initialReport,
  targetFixerIds,
  onApplyCorrectedPdf,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fixResponse, setFixResponse] = useState<FixApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmations requises pour niveaux 2 et 3
  const [confirmVisual, setConfirmVisual] = useState<boolean>(false);
  const [confirmRights, setConfirmRights] = useState<boolean>(false);
  const [confirmColor, setConfirmColor] = useState<boolean>(false);

  if (!isOpen) return null;

  const fixersToApply = ALL_FIXERS.filter(f => targetFixerIds.includes(f.id));
  const maxRiskLevel = Math.max(...fixersToApply.map(f => f.riskLevel), 1) as RiskLevel;

  const handleExecuteFix = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const pdfBase64 = bufferToBase64(originalBytes);
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          fileName,
          profileId,
          fixerIds: targetFixerIds,
          confirmations: {
            confirmVisualChanges: confirmVisual,
            confirmLegalRights: confirmRights,
            confirmColorConversion: confirmColor,
          },
        }),
      });

      const data: FixApiResponse = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.refusalReason || 'Échec du traitement de correction.');
      } else {
        setFixResponse(data);
      }
    } catch (err: any) {
      setErrorMessage(`Erreur réseau ou serveur : ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCorrectedPdf = () => {
    if (!fixResponse?.correctedPdfBase64) return;
    const bytes = base64ToBuffer(fixResponse.correctedPdfBase64);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrigé_${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAuditLog = () => {
    if (!fixResponse?.auditLog) return;
    const jsonStr = JSON.stringify(fixResponse.auditLog, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_correction_${fileName.replace(/\.pdf$/i, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadCorrectedInViewer = () => {
    if (!fixResponse?.correctedPdfBase64 || !fixResponse.afterReport || !fixResponse.auditLog) return;
    const bytes = base64ToBuffer(fixResponse.correctedPdfBase64);
    onApplyCorrectedPdf(bytes, fixResponse.afterReport, fixResponse.auditLog);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              maxRiskLevel === 1 ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80' :
              maxRiskLevel === 2 ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80' :
              'bg-rose-950/80 text-rose-400 border border-rose-800/80'
            }`}>
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Correction Déterministe Assistée</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                  Niveau {maxRiskLevel}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {fixResponse ? 'Bilan de correction et re-vérification' : `${fixersToApply.length} correcteur(s) sélectionné(s)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {!fixResponse ? (
            <>
              {/* Avis de traitement serveur éphémère */}
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
                <Server className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white font-semibold">Traitement serveur éphémère : </strong>
                  L'inspection du document est effectuée localement dans votre navigateur. Pour exécuter cette correction, une copie éphémère est transmise au serveur d'outils. Aucun document n'est sauvegardé ni conservé sur disque.
                </div>
              </div>

              {/* Détail des correcteurs prévus */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Opérations prévues
                </h4>
                {fixersToApply.map((fixer) => (
                  <div key={fixer.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {fixer.id}
                        </span>
                        <span className="text-xs font-semibold text-white">{fixer.name}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        Règle{fixer.ruleIds.length > 1 ? 's' : ''} : {fixer.ruleIds.join(', ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {fixer.description}
                    </p>

                    <div className="pt-2 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ce qui va changer :
                        </span>
                        <p className="text-slate-400 pl-4">{fixer.businessObjective}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-cyan-400 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Ce qui ne sera pas touché :
                        </span>
                        <p className="text-slate-400 pl-4">{fixer.untouchedAspects[0]}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirmations explicites pour Niveaux 2 & 3 */}
              {maxRiskLevel >= 2 && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/60 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Confirmation requise pour opération de Niveau {maxRiskLevel}</span>
                  </div>

                  {targetFixerIds.includes('FIX-HAIR-01') && (
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmVisual}
                        onChange={(e) => setConfirmVisual(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>J’accepte l’épaississement automatique des filets trop fins au seuil d’atelier du profil.</span>
                    </label>
                  )}

                  {targetFixerIds.includes('FIX-SEC-01') && (
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmRights}
                        onChange={(e) => setConfirmRights(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>Je confirme détenir les droits légaux d’impression et de modification sur ce document.</span>
                    </label>
                  )}

                  {targetFixerIds.includes('FIX-COLOR-01') && (
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmColor}
                        onChange={(e) => setConfirmColor(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>J’accepte la conversion globale vers l’espace colorimétrique CMJN (risque de glissement perceptuel).</span>
                    </label>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/80 text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Correction refusée : </strong>
                    {errorMessage}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Bilan Avant / Après si la correction a réussi */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/60 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Correction appliquée et re-vérifiée avec succès</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {fixResponse.auditLog?.reverification.gateMessage}
                  </p>
                </div>
              </div>

              {/* Comparaison Avant / Après */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Comparaison des règles contrôlées
                </h5>

                <div className="divide-y divide-slate-800/80 text-xs">
                  {fixResponse.auditLog?.reverification.improvedRules.map((ruleId) => {
                    const before = fixResponse.beforeReport?.ruleResults.find(r => r.ruleId === ruleId);
                    const after = fixResponse.afterReport?.ruleResults.find(r => r.ruleId === ruleId);
                    return (
                      <div key={ruleId} className="py-2.5 flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-400">{ruleId}</span>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono text-[10px]">
                            {before?.status || 'FAIL'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px]">
                            {after?.status || 'PASS'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Empreintes cryptographiques SHA-256 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>SHA-256 Original :</span>
                  <span className="text-slate-300 truncate max-w-[280px]">{fixResponse.auditLog?.originalSha256}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>SHA-256 Copie corrigée :</span>
                  <span className="text-emerald-400 font-semibold truncate max-w-[280px]">{fixResponse.auditLog?.correctedSha256}</span>
                </div>
              </div>

              {/* Journal des modifications */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Changements effectués ({fixResponse.auditLog?.appliedFixers.reduce((acc, f) => acc + f.changes.length, 0)} modifications)
                </h5>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {fixResponse.auditLog?.appliedFixers.flatMap(f => f.changes).map((c, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-850/80 border border-slate-800 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-medium text-slate-200">
                        <span>{c.itemDescription}</span>
                        {c.pageNumber && <span className="text-slate-400">Page {c.pageNumber}</span>}
                      </div>
                      <div className="text-slate-400 flex items-center gap-2">
                        <span className="line-through text-slate-500">{c.beforeValue}</span>
                        <span>→</span>
                        <span className="text-emerald-400">{c.afterValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
          {!fixResponse ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={
                  isProcessing ||
                  (targetFixerIds.includes('FIX-HAIR-01') && !confirmVisual) ||
                  (targetFixerIds.includes('FIX-SEC-01') && !confirmRights) ||
                  (targetFixerIds.includes('FIX-COLOR-01') && !confirmColor)
                }
                onClick={handleExecuteFix}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Application & Re-vérification...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>Lancer la correction déterministe</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCorrectedPdf}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Télécharger la copie</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAuditLog}
                  className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Journal (.json)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadCorrectedInViewer}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Inspecter la copie corrigée</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
