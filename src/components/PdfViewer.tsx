import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { DocumentPreflightResult, Anomaly } from '../types/preflight';
import { MM_TO_PT } from '../services/pdfAnalyzer';

interface PdfViewerProps {
  fileBuffer: ArrayBuffer;
  result: DocumentPreflightResult;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  selectedAnomalyId: string | null;
  onSelectAnomaly?: (anomaly: Anomaly) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileBuffer,
  result,
  selectedPage,
  setSelectedPage,
  selectedAnomalyId,
  onSelectAnomaly,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [autoFitted, setAutoFitted] = useState<boolean>(true);
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [currentViewport, setCurrentViewport] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Overlay toggles
  const [showTrimBox, setShowTrimBox] = useState(true);
  const [showBleedBox, setShowBleedBox] = useState(true);
  const [showSafetyMargin, setShowSafetyMargin] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);

  const [hoveredAnomaly, setHoveredAnomaly] = useState<Anomaly | null>(null);

  const currentRenderTaskRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);

  // Load PDF Document once with isolated buffer clone
  useEffect(() => {
    let active = true;
    const loadDoc = async () => {
      try {
        if (loadingTaskRef.current) {
          try {
            loadingTaskRef.current.destroy();
          } catch {
            // Ignore
          }
        }
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer.slice(0)) });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
        }
      } catch (err) {
        console.error('Failed to load PDF in viewer:', err);
      }
    };
    loadDoc();
    return () => {
      active = false;
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch {
          // Ignore
        }
      }
    };
  }, [fileBuffer]);

  // Fit to screen calculation
  const fitToScreen = () => {
    if (!pdfDoc || !scrollContainerRef.current) return;
    pdfDoc.getPage(selectedPage).then((page: any) => {
      const baseViewport = page.getViewport({ scale: 1.0 });
      const container = scrollContainerRef.current;
      if (!container) return;

      const availableWidth = container.clientWidth - 80;
      const availableHeight = container.clientHeight - 80;

      if (availableWidth > 0 && availableHeight > 0) {
        const scaleW = availableWidth / baseViewport.width;
        const scaleH = availableHeight / baseViewport.height;
        const targetScale = Math.min(scaleW, scaleH, 1.8);
        setZoomScale(Number(Math.max(0.4, targetScale).toFixed(2)));
        setAutoFitted(true);
      }
    }).catch((err: any) => {
      console.warn('Could not auto-fit page:', err);
    });
  };

  useEffect(() => {
    if (pdfDoc && autoFitted) {
      fitToScreen();
    }
  }, [pdfDoc, selectedPage]);

  // Render current page when selectedPage or zoomScale changes
  useEffect(() => {
    let active = true;
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      // Annuler toute tâche de rendu en cours sur le canevas avant d'en démarrer une nouvelle
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        currentRenderTaskRef.current = null;
      }

      try {
        setIsRendering(true);
        const page = await pdfDoc.getPage(selectedPage);
        if (!active) return;

        // Viewport respects page.rotate natively
        const viewport = page.getViewport({ scale: zoomScale });
        setViewportDims({ width: viewport.width, height: viewport.height });
        setCurrentViewport(viewport);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderTask = page.render({
          canvasContext: context,
          transform,
          viewport,
        });
        currentRenderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        // PDF.js lève RenderingCancelledException lors d'une annulation normale (zoom / changement rapide)
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
      } finally {
        if (active) {
          setIsRendering(false);
          currentRenderTaskRef.current = null;
        }
      }
    };

    renderPage();
    return () => {
      active = false;
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [pdfDoc, selectedPage, zoomScale]);

  // Transformation géométrique robuste utilisant convertToViewportPoint (disponible dans pdfjs-dist)
  // Convertit les 4 coins d'une zone PDF [x, y, w, h] en coordonnées canevas/écran [x, y, w, h]
  // Invariant quelle que soit la rotation de page (0°, 90°, 180°, 270°) et le niveau de zoom
  const toScreenRect = (xPt: number, yPt: number, wPt: number, hPt: number) => {
    if (!currentViewport || typeof currentViewport.convertToViewportPoint !== 'function') {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    try {
      // Coordonnées PDF : (x, y) = bas-gauche, (x+w, y+h) = haut-droit
      // Projection des 4 sommets
      const p1 = currentViewport.convertToViewportPoint(xPt, yPt);
      const p2 = currentViewport.convertToViewportPoint(xPt + wPt, yPt);
      const p3 = currentViewport.convertToViewportPoint(xPt, yPt + hPt);
      const p4 = currentViewport.convertToViewportPoint(xPt + wPt, yPt + hPt);

      const xs = [p1[0], p2[0], p3[0], p4[0]];
      const ys = [p1[1], p2[1], p3[1], p4[1]];

      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      return {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.max(0, Math.round(maxX - minX)),
        height: Math.max(0, Math.round(maxY - minY)),
      };
    } catch (err) {
      console.warn('Coordinates conversion error:', err);
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  };

  const currentPageBoxes = result.pages[selectedPage - 1];
  const mediaW_pt = currentPageBoxes ? currentPageBoxes.mediaBox.width : 595.28;
  const mediaH_pt = currentPageBoxes ? currentPageBoxes.mediaBox.height : 841.89;

  // TrimBox values
  const trimX = currentPageBoxes?.trimBox ? currentPageBoxes.trimBox.x : 0;
  const trimY = currentPageBoxes?.trimBox ? currentPageBoxes.trimBox.y : 0;
  const trimW = currentPageBoxes?.trimBox ? currentPageBoxes.trimBox.width : mediaW_pt;
  const trimH = currentPageBoxes?.trimBox ? currentPageBoxes.trimBox.height : mediaH_pt;

  const trimScreen = toScreenRect(trimX, trimY, trimW, trimH);

  // Safety margin offset
  const safetyMarginPt = result.profile.requiredSafetyMarginMm * MM_TO_PT;
  const safetyScreen = toScreenRect(
    trimX + safetyMarginPt,
    trimY + safetyMarginPt,
    Math.max(0, trimW - 2 * safetyMarginPt),
    Math.max(0, trimH - 2 * safetyMarginPt)
  );

  // Bleed Box screen
  const bleedMarginPt = result.profile.requiredBleedMm * MM_TO_PT;
  const bleedScreen = currentPageBoxes?.bleedBox
    ? toScreenRect(
        currentPageBoxes.bleedBox.x,
        currentPageBoxes.bleedBox.y,
        currentPageBoxes.bleedBox.width,
        currentPageBoxes.bleedBox.height
      )
    : toScreenRect(
        trimX - bleedMarginPt,
        trimY - bleedMarginPt,
        trimW + 2 * bleedMarginPt,
        trimH + 2 * bleedMarginPt
      );

  // Anomalies on this page
  const pageAnomalies = result.anomalies.filter(
    (a) => a.page === selectedPage && a.highlightBox
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Workspace Toolbar */}
      <div className="h-11 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 select-none text-xs">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedPage(Math.max(1, selectedPage - 1))}
            disabled={selectedPage <= 1}
            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-slate-300 tabular-nums px-2">
            Page <strong className="text-white">{selectedPage}</strong> / {result.pageCount || 1}
          </span>

          <button
            onClick={() => setSelectedPage(Math.min(result.pageCount || 1, selectedPage + 1))}
            disabled={selectedPage >= (result.pageCount || 1)}
            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentPageBoxes?.rotationDegrees ? (
            <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 flex items-center gap-1 ml-1" title="Orientation de page non nulle">
              <RotateCw className="w-3 h-3" />
              <span>{currentPageBoxes.rotationDegrees}°</span>
            </span>
          ) : null}
        </div>

        {/* Center: Overlays & Guides Toggles (Dynamically using profile values!) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => setShowTrimBox(!showTrimBox)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              showTrimBox
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Afficher la ligne de coupe (format fini)"
          >
            <div className="w-2 h-2 rounded-xs border border-cyan-400 bg-cyan-400/20" />
            <span>Ligne de coupe</span>
          </button>

          <button
            onClick={() => setShowBleedBox(!showBleedBox)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              showBleedBox
                ? 'bg-pink-950/80 text-pink-300 border border-pink-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={`Afficher le fond perdu requis (${result.profile.requiredBleedMm} mm)`}
          >
            <div className="w-2 h-2 rounded-xs border border-pink-400 bg-pink-400/20" />
            <span>Fond perdu ({result.profile.requiredBleedMm} mm)</span>
          </button>

          <button
            onClick={() => setShowSafetyMargin(!showSafetyMargin)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              showSafetyMargin
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={`Afficher la marge de sécurité intérieure (${result.profile.requiredSafetyMarginMm} mm)`}
          >
            <div className="w-2 h-2 rounded-xs border border-emerald-400 bg-emerald-400/20" />
            <span>Sécurité ({result.profile.requiredSafetyMarginMm} mm)</span>
          </button>

          <button
            onClick={() => setShowAnomalies(!showAnomalies)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              showAnomalies
                ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Afficher les anomalies sur la page"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Anomalies ({pageAnomalies.length})</span>
          </button>
        </div>

        {/* Right: Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setAutoFitted(false);
              setZoomScale(Math.max(0.4, Number((zoomScale - 0.15).toFixed(2))));
            }}
            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom arrière"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-slate-300 tabular-nums w-11 text-center text-[11px]">
            {Math.round(zoomScale * 100)}%
          </span>

          <button
            onClick={() => {
              setAutoFitted(false);
              setZoomScale(Math.min(2.5, Number((zoomScale + 0.15).toFixed(2))));
            }}
            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom avant"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={fitToScreen}
            className="ml-1 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Ajuster à l'écran"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-8 flex items-center justify-center relative select-none"
      >
        <div
          className="relative shadow-2xl rounded-xs bg-white overflow-hidden transition-transform duration-100"
          style={{
            width: `${viewportDims.width}px`,
            height: `${viewportDims.height}px`,
          }}
        >
          {/* Base PDF Canvas */}
          <canvas ref={canvasRef} className="block w-full h-full" />

          {/* SVG Overlay Guides */}
          <svg
            className="absolute inset-0 pointer-events-none w-full h-full"
            style={{ width: `${viewportDims.width}px`, height: `${viewportDims.height}px` }}
          >
            {/* 1. Bleed Box */}
            {showBleedBox && bleedScreen.width > 0 && (
              <rect
                x={bleedScreen.x}
                y={bleedScreen.y}
                width={bleedScreen.width}
                height={bleedScreen.height}
                fill="none"
                stroke="#ec4899"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            )}

            {/* 2. Cut line (Trim line) */}
            {showTrimBox && trimScreen.width > 0 && (
              <rect
                x={trimScreen.x}
                y={trimScreen.y}
                width={trimScreen.width}
                height={trimScreen.height}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                opacity="0.9"
              />
            )}

            {/* 3. Safety Margin */}
            {showSafetyMargin && safetyScreen.width > 0 && (
              <rect
                x={safetyScreen.x}
                y={safetyScreen.y}
                width={safetyScreen.width}
                height={safetyScreen.height}
                fill="rgba(16, 185, 129, 0.03)"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                opacity="0.8"
              />
            )}
          </svg>

          {/* Interactive Anomaly Highlight Overlays */}
          {showAnomalies &&
            pageAnomalies.map((anom) => {
              if (!anom.highlightBox) return null;
              const box = toScreenRect(
                anom.highlightBox.xPt,
                anom.highlightBox.yPt,
                anom.highlightBox.widthPt,
                anom.highlightBox.heightPt
              );

              const isSelected = selectedAnomalyId === anom.id;
              const isError = anom.severity === 'error';

              return (
                <div
                  key={anom.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAnomaly?.(anom);
                  }}
                  onMouseEnter={() => setHoveredAnomaly(anom)}
                  onMouseLeave={() => setHoveredAnomaly(null)}
                  className={`absolute cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-500/30 border-2 border-cyan-400 ring-4 ring-cyan-500/40 z-30'
                      : isError
                      ? 'bg-rose-500/20 border-2 border-rose-500 hover:bg-rose-500/35 z-10'
                      : 'bg-amber-500/20 border-2 border-amber-500 hover:bg-amber-500/35 z-10'
                  }`}
                  style={{
                    left: `${Math.max(0, box.x - 2)}px`,
                    top: `${Math.max(0, box.y - 2)}px`,
                    width: `${Math.max(16, box.width + 4)}px`,
                    height: `${Math.max(12, box.height + 4)}px`,
                  }}
                >
                  <span
                    className={`absolute -top-2.5 -right-2.5 text-[9px] font-bold px-1 rounded text-white shadow ${
                      isSelected
                        ? 'bg-cyan-500 ring-2 ring-white'
                        : isError
                        ? 'bg-rose-600'
                        : 'bg-amber-600'
                    }`}
                  >
                    !
                  </span>
                </div>
              );
            })}
        </div>

        {/* Floating Tooltip on Hover */}
        {hoveredAnomaly && (
          <div className="absolute bottom-6 left-6 z-40 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-3.5 shadow-2xl max-w-sm pointer-events-none text-left space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase text-amber-400">
                {hoveredAnomaly.title}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Page {hoveredAnomaly.page}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-snug">
              {hoveredAnomaly.explanation}
            </p>
            {hoveredAnomaly.detectedValue && (
              <p className="text-[10px] font-mono text-cyan-300">
                Détecté : {hoveredAnomaly.detectedValue} (Attendu : {hoveredAnomaly.expectedValue})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Scale / Coordinate Helper */}
      <div className="h-7 px-4 bg-slate-950/90 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-pink-500 inline-block" />
            <span className="text-slate-400">Fond perdu ({result.profile.requiredBleedMm} mm)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-cyan-400 inline-block" />
            <span className="text-slate-400">Ligne de coupe</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-emerald-400 inline-block" />
            <span className="text-slate-400">Zone tranquille ({result.profile.requiredSafetyMarginMm} mm)</span>
          </span>
        </div>
        <div>
          Format cible : {result.profile.widthMm} × {result.profile.heightMm} mm ({result.profile.name})
        </div>
      </div>
    </div>
  );
};
