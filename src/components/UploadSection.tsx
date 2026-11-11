import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileType,
} from 'lucide-react';
import { PrintProfile } from '../types/preflight';
import { DEFAULT_PROFILES } from '../services/pdfAnalyzer';
import { createCustomProfile } from '../profiles/registry';
import { SAMPLE_PDFS, SamplePdfDefinition } from '../services/samplePdfs';

interface UploadSectionProps {
  onFileSelected: (buffer: ArrayBuffer, fileName: string, profile: PrintProfile) => void;
  selectedProfile: PrintProfile;
  setSelectedProfile: (profile: PrintProfile) => void;
  isAnalyzing: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onFileSelected,
  selectedProfile,
  setSelectedProfile,
  isAnalyzing,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ buffer: ArrayBuffer; name: string; size: number } | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [customBleed, setCustomBleed] = useState(5);
  const [customSafety, setCustomSafety] = useState(10);
  const [isGeneratingSample, setIsGeneratingSample] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Veuillez déposer un document au format PDF (.pdf).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        setCurrentFile({
          buffer: reader.result,
          name: file.name,
          size: file.size,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectSample = async (sample: SamplePdfDefinition) => {
    try {
      setIsGeneratingSample(sample.id);
      const matchingProfile = DEFAULT_PROFILES.find((p) => p.id === sample.profileId) || DEFAULT_PROFILES[0];
      setSelectedProfile(matchingProfile);
      setIsCustomMode(false);

      const generated = await sample.generate();
      setCurrentFile({
        buffer: generated.buffer,
        name: generated.fileName,
        size: generated.buffer.byteLength,
      });

      onFileSelected(generated.buffer, generated.fileName, matchingProfile);
    } catch (err) {
      console.error('Failed to generate sample PDF:', err);
    } finally {
      setIsGeneratingSample(null);
    }
  };

  const handleStartAnalysis = () => {
    if (!currentFile) return;

    let profileToUse = selectedProfile;
    if (isCustomMode) {
      profileToUse = createCustomProfile({
        widthMm: customWidth,
        heightMm: customHeight,
        requiredBleedMm: customBleed,
        advisorySafetyMarginMm: customSafety,
        criticalSafetyMarginMm: Math.round(customSafety / 2),
      });
    }

    onFileSelected(currentFile.buffer, currentFile.name, profileToUse);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      {/* Intro Heading */}
      <div className="text-center max-w-xl mx-auto space-y-2.5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Espace de contrôle prépresse PDF
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Ouvrez votre document pour inspecter le fond perdu (5 mm), les marges de coupe (10 mm), les corps de texte (&lt; 8 pt), l'incorporation des polices et les transparences.
        </p>
      </div>

      {/* Main Intake Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: Drop Area */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : currentFile
                  ? 'border-cyan-600 bg-slate-950/80 hover:border-cyan-500'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {currentFile ? (
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-white truncate max-w-xs">
                    {currentFile.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {(currentFile.size / (1024 * 1024)).toFixed(2)} Mo · Fichier sélectionné
                  </p>
                  <span className="text-[11px] text-cyan-400 underline block pt-1">
                    Changer de fichier
                  </span>
                </div>
              ) : (
                <div className="text-center space-y-2.5">
                  <div className="w-12 h-12 mx-auto rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Déposez votre PDF ici
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ou cliquez pour parcourir vos dossiers
                    </p>
                  </div>
                  <span className="inline-block px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 rounded-md border border-slate-700 transition-colors">
                    Sélectionner un fichier
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Print Profile Configuration */}
          <div className="md:col-span-5 p-6 sm:p-8 bg-slate-900/60 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Profil cible
                </span>
                <button
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                >
                  {isCustomMode ? 'Standards' : 'Personnalisé'}
                </button>
              </div>

              {!isCustomMode ? (
                <div className="space-y-1.5">
                  {DEFAULT_PROFILES.map((profile) => {
                    const isSelected = selectedProfile.id === profile.id;
                    return (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfile(profile)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-950/40 text-white font-medium'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate">{profile.name}</span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-cyan-400 bg-cyan-500' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Largeur (mm)</label>
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(10, Number(e.target.value)))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Hauteur (mm)</label>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Math.max(10, Number(e.target.value)))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Fond perdu (mm)</label>
                      <input
                        type="number"
                        value={customBleed}
                        onChange={(e) => setCustomBleed(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Sécurité (mm)</label>
                      <input
                        type="number"
                        value={customSafety}
                        onChange={(e) => setCustomSafety(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={!currentFile || isAnalyzing}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${
                currentFile && !isAnalyzing
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Inspecter le document</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Test Sample Documents Bar */}
      <div className="pt-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Fichiers d'essai prêts à l'inspection
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_PDFS.map((sample) => {
            const isLoading = isGeneratingSample === sample.id;
            const isError = sample.expectedVerdict === 'to_fix';
            const isReady = sample.expectedVerdict === 'ready';

            return (
              <button
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                disabled={Boolean(isGeneratingSample) || isAnalyzing}
                className="text-left p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-2 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`font-semibold ${
                        isError ? 'text-rose-400' : isReady ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isError ? 'Cas : Anomalies' : isReady ? 'Cas : Conforme' : 'Cas : Vigilance'}
                    </span>
                    {isLoading && <span className="text-cyan-400 animate-pulse">Chargement...</span>}
                  </div>
                  <p className="text-xs font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {sample.name}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {sample.description}
                  </p>
                </div>
                <span className="text-[10px] text-cyan-400 font-medium inline-flex items-center gap-1">
                  <span>Ouvrir dans l'atelier</span>
                  <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
