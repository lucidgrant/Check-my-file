import React, { useState } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { AnalyzingOverlay } from './components/AnalyzingOverlay';
import { PdfViewer } from './components/PdfViewer';
import { InspectionSidebar } from './components/InspectionSidebar';
import { DocumentPreflightResult, PrintProfile, Anomaly } from './types/preflight';
import { DEFAULT_PROFILES, analyzePdfDocument } from './services/pdfAnalyzer';
import { generatePreflightReportPdf } from './services/reportGenerator';
import { RuleDetailModal } from './components/RuleDetailModal';
import { AlertOctagon, RefreshCw, Lock, FileWarning } from 'lucide-react';

export default function App() {
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PrintProfile>(DEFAULT_PROFILES[0]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);

  const [result, setResult] = useState<DocumentPreflightResult | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [modalInitialRuleId, setModalInitialRuleId] = useState<string | undefined>(undefined);

  const handleOpenRuleDetail = (ruleId?: string) => {
    setModalInitialRuleId(ruleId);
    setIsRuleModalOpen(true);
  };

  const handleFileSelected = async (buffer: ArrayBuffer, name: string, profile: PrintProfile) => {
    setFileBuffer(buffer);
    setFileName(name);
    setSelectedProfile(profile);
    setIsAnalyzing(true);
    setProgressPercentage(10);
    setProgressStep('Démarrage de l’analyse prévol...');

    try {
      const res = await analyzePdfDocument(buffer, name, profile, (step, pct) => {
        setProgressStep(step);
        setProgressPercentage(pct);
      });

      setTimeout(() => {
        setResult(res);
        setIsAnalyzing(false);
        setSelectedPage(1);

        // Auto-sélection de la première anomalie si présente
        const firstAnomaly = res.anomalies[0];
        if (firstAnomaly) {
          setSelectedAnomalyId(firstAnomaly.id);
          if (firstAnomaly.page) setSelectedPage(firstAnomaly.page);
        } else {
          setSelectedAnomalyId(null);
        }
      }, 350);
    } catch (err: any) {
      console.error('Preflight error:', err);
      setIsAnalyzing(false);
      setResult({
        fileName: name,
        fileSizeBytes: buffer.byteLength,
        pageCount: 0,
        profile,
        overallStatus: 'ANALYSIS_FAILED',
        statusLabel: 'Analyse impossible',
        statusDescription: `Erreur imprévue lors de l'ouverture du fichier (${String(err?.message || err).slice(0, 80)})`,
        analyzedAt: new Date().toLocaleTimeString('fr-FR'),
        engineVersion: '2.2.0',
        catalogVersion: '2.2.0',
        profileVersion: profile.version || '2.0.0',
        counters: {
          blockingIssuesCount: 1,
          advisoryIssuesCount: 0,
          notVerifiableCount: 0,
          notApplicableCount: 0,
          errorCount: 1,
          passedRulesCount: 0,
          totalRulesEvaluated: 1,
        },
        pages: [],
        checks: [],
        ruleResults: [],
        anomalyGroups: [],
        anomalies: [],
        fonts: [],
        coveredChecks: [],
        uncoveredChecks: ['L’analyse a été interrompue suite à une erreur technique.'],
        hasTransparencies: false,
        hasMissingBleed: false,
        hasMarginViolations: false,
        hasTextSizeViolations: false,
        hasFontIssues: false,
        hasStrokeIssues: false,
        hasImageIssues: false,
        hasColorIssues: false,
        hasMultiFormatPages: false,
        hasRotatedPages: false,
        analysisError: {
          code: 'UNKNOWN',
          message: String(err?.message || err),
        },
      });
    }
  };

  const handleReset = () => {
    setFileBuffer(null);
    setFileName(null);
    setResult(null);
    setSelectedPage(1);
    setSelectedAnomalyId(null);
  };

  const handleDownloadReport = async () => {
    if (!result || result.overallStatus === 'ANALYSIS_FAILED' || (result.overallStatus as any) === 'analysis_failed') return;
    try {
      setIsDownloadingReport(true);
      const reportBytes = await generatePreflightReportPdf(result);
      const blob = new Blob([reportBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CheckMyFile_Rapport_${result.fileName.replace(/\.pdf$/i, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate report:', err);
      alert('Impossible de générer le rapport PDF.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleSelectAnomaly = (anomaly: Anomaly) => {
    setSelectedAnomalyId(anomaly.id);
    if (anomaly.page) {
      setSelectedPage(anomaly.page);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Zone A: Minimal Header */}
      <Header
        result={result}
        onReset={handleReset}
        onDownloadReport={handleDownloadReport}
        onOpenRuleCatalog={() => handleOpenRuleDetail()}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {!result || !fileBuffer ? (
          /* Intake / Upload View when no document is active */
          <div className="flex-1 overflow-y-auto">
            <UploadSection
              onFileSelected={handleFileSelected}
              selectedProfile={selectedProfile}
              setSelectedProfile={setSelectedProfile}
              isAnalyzing={isAnalyzing}
            />
          </div>
        ) : result.overallStatus === 'ANALYSIS_FAILED' || (result.overallStatus as any) === 'analysis_failed' ? (
          /* Écran d'échec d'analyse propre (PDF protégé / corrompu / trop volumineux) */
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                {result.analysisError?.code === 'PASSWORD_PROTECTED' ? (
                  <Lock className="w-6 h-6" />
                ) : (
                  <FileWarning className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Analyse impossible
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.statusDescription}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sélectionner un autre fichier</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Document-Centric Workspace */
          <div className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden">
            {/* Zone B: Main Document Viewport */}
            <PdfViewer
              fileBuffer={fileBuffer}
              result={result}
              selectedPage={selectedPage}
              setSelectedPage={setSelectedPage}
              selectedAnomalyId={selectedAnomalyId}
              onSelectAnomaly={handleSelectAnomaly}
            />

            {/* Zone C: Inspection Panel ("Points à examiner") */}
            <InspectionSidebar
              result={result}
              selectedPage={selectedPage}
              setSelectedPage={setSelectedPage}
              selectedAnomalyId={selectedAnomalyId}
              onSelectAnomaly={handleSelectAnomaly}
              onOpenRuleDetail={handleOpenRuleDetail}
            />
          </div>
        )}
      </div>

      {/* Stepped Analysis Progress Indicator */}
      {isAnalyzing && (
        <AnalyzingOverlay
          progressStep={progressStep}
          progressPercentage={progressPercentage}
        />
      )}

      {/* Fiche Technique & Référentiel des Règles Modal */}
      <RuleDetailModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        initialRuleId={modalInitialRuleId}
        activeProfile={selectedProfile}
      />
    </div>
  );
}
