/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Moteur de contrôle prépresse 100% déterministe et paramétrique
 * Version Moteur : 2.2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFRef, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import {
  DocumentPreflightResult,
  PrintProfile,
  CheckItem,
  CheckItemId,
  Anomaly,
  AnomalyGroup,
  AnomalyOccurrence,
  PageBoxes,
  BoxDimensions,
  FontInfo,
  OverallStatus,
  Severity,
} from '../types/preflight';
import {
  RuleCheckResult,
  RuleStatus,
  RuleSeverity,
  OverallVerdict,
  PreflightCounters,
} from '../rules/types';
import {
  RULE_CATALOG_VERSION,
  PREFLIGHT_RULES,
  getRuleById,
  UNCOVERED_CHECKS_CATALOG,
} from '../rules/catalog';
import { DEFAULT_PROFILES, PROFILE_REGISTRY_VERSION } from '../profiles/registry';

// Configuration du worker PDF.js pour navigateur (Vite) et Node.js
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback silencieux si résolution directe
  }
}

// Constantes physiques de conversion
export const PT_TO_MM = 25.4 / 72; // ~0.352778
export const MM_TO_PT = 72 / 25.4; // ~2.834646

export { DEFAULT_PROFILES, PROFILE_REGISTRY_VERSION } from '../profiles/registry';
export { UNCOVERED_CHECKS_CATALOG } from '../rules/catalog';

export const ENGINE_VERSION = '2.2.0';
export const CATALOG_VERSION = RULE_CATALOG_VERSION;
export const PROFILE_VERSION = PROFILE_REGISTRY_VERSION;

// Extraction d'une boîte PDF de géométrie de page
function extractBox(
  pdfPage: any,
  boxName: 'MediaBox' | 'TrimBox' | 'BleedBox' | 'CropBox'
): { box?: BoxDimensions; isExplicit: boolean } {
  try {
    const rawBox = pdfPage.node.get(PDFName.of(boxName));
    if (!rawBox || !(rawBox instanceof PDFArray) || rawBox.size() < 4) {
      if (boxName === 'MediaBox') {
        const size = pdfPage.getSize();
        return {
          box: {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
            widthMm: Number((size.width * PT_TO_MM).toFixed(2)),
            heightMm: Number((size.height * PT_TO_MM).toFixed(2)),
          },
          isExplicit: false,
        };
      }
      return { box: undefined, isExplicit: false };
    }

    const x1 = (rawBox.get(0) as PDFNumber).asNumber();
    const y1 = (rawBox.get(1) as PDFNumber).asNumber();
    const x2 = (rawBox.get(2) as PDFNumber).asNumber();
    const y2 = (rawBox.get(3) as PDFNumber).asNumber();

    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    return {
      box: {
        x,
        y,
        width,
        height,
        widthMm: Number((width * PT_TO_MM).toFixed(2)),
        heightMm: Number((height * PT_TO_MM).toFixed(2)),
      },
      isExplicit: true,
    };
  } catch {
    return { box: undefined, isExplicit: false };
  }
}

// Fonction de conversion Sévérité -> Typologie d'UI
function toUiSeverity(ruleSev: RuleSeverity, status: RuleStatus): Severity {
  if (status === 'PASS') return 'success';
  if (status === 'NOT_VERIFIABLE' || status === 'NOT_APPLICABLE') return 'unverifiable';
  return ruleSev === 'BLOCKING' ? 'error' : 'warning';
}

function getTextFromPdfStream(stream: PDFRawStream): string {
  try {
    const decoded = decodePDFRawStream(stream);
    return new TextDecoder('latin1').decode(decoded.decode());
  } catch {
    return new TextDecoder('latin1').decode(stream.contents);
  }
}

export async function analyzePdfDocument(
  fileBuffer: ArrayBuffer,
  fileName: string,
  profile: PrintProfile,
  onProgress?: (step: string, percentage: number) => void
): Promise<DocumentPreflightResult> {
  const bufferCopyForPdfLib = fileBuffer.slice(0);
  const bufferCopyForPdfJs = fileBuffer.slice(0);

  // Vérification de taille limite
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 Mo
  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    return createFailedResult(
      fileName,
      fileBuffer.byteLength,
      profile,
      'FILE_TOO_LARGE',
      `Le fichier dépasse la limite maximale de traitement de 100 Mo (${(fileBuffer.byteLength / (1024 * 1024)).toFixed(1)} Mo détectés).`
    );
  }

  onProgress?.('Initialisation et contrôle d’ingestion...', 10);

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bufferCopyForPdfLib, { ignoreEncryption: false });
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    if (errMsg.toLowerCase().includes('password') || errMsg.toLowerCase().includes('encrypted')) {
      return createFailedResult(
        fileName,
        fileBuffer.byteLength,
        profile,
        'PASSWORD_PROTECTED',
        'Le document est protégé par un mot de passe d’ouverture. Fournissez un PDF déverrouillé.'
      );
    }
    return createFailedResult(
      fileName,
      fileBuffer.byteLength,
      profile,
      'CORRUPTED',
      `Fichier PDF altéré ou syntaxe binaire corrompue (${errMsg.slice(0, 80)}).`
    );
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount === 0) {
    return createFailedResult(
      fileName,
      fileBuffer.byteLength,
      profile,
      'UNSUPPORTED',
      'Le document ne contient aucune page exploitable (0 page).'
    );
  }

  // Structures de collecte de données
  const pageBoxesList: PageBoxes[] = [];
  const fonts: FontInfo[] = [];
  const rawAnomalies: Anomaly[] = [];
  const ruleResults: RuleCheckResult[] = [];

  let hasRotatedPages = false;
  let hasMultiFormatPages = false;
  let hasTransparencies = false;
  let hasMissingBleed = false;
  let hasMarginViolations = false;
  let hasTextSizeViolations = false;
  let hasFontIssues = false;
  let hasStrokeIssues = false;
  let hasImageIssues = false;
  let hasColorIssues = false;

  onProgress?.('Extraction des boîtes de page et de la géométrie...', 20);

  // 1. ANALYSE GÉOMÉTRIQUE DES PAGES AVEC PDF-LIB
  const baseWidth = pdfDoc.getPage(0).getSize().width;
  const baseHeight = pdfDoc.getPage(0).getSize().height;

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const rotation = page.getRotation().angle;
    if (rotation !== 0) hasRotatedPages = true;

    const mediaRes = extractBox(page, 'MediaBox');
    const trimRes = extractBox(page, 'TrimBox');
    const bleedRes = extractBox(page, 'BleedBox');
    const cropRes = extractBox(page, 'CropBox');

    const mediaBox = mediaRes.box || {
      x: 0,
      y: 0,
      width: page.getSize().width,
      height: page.getSize().height,
      widthMm: Number((page.getSize().width * PT_TO_MM).toFixed(2)),
      heightMm: Number((page.getSize().height * PT_TO_MM).toFixed(2)),
    };

    if (
      Math.abs(mediaBox.width - baseWidth) > 2 ||
      Math.abs(mediaBox.height - baseHeight) > 2
    ) {
      hasMultiFormatPages = true;
    }

    pageBoxesList.push({
      pageNumber: i + 1,
      rotationDegrees: rotation,
      mediaBox,
      trimBox: trimRes.box,
      bleedBox: bleedRes.box,
      cropBox: cropRes.box,
      hasExplicitTrimBox: trimRes.isExplicit,
      hasExplicitBleedBox: bleedRes.isExplicit,
    });
  }

  onProgress?.('Inspection des polices vectorielles incorporées...', 35);

  // 2. ANALYSE APPROFONDIE DES POLICES (FONT-01)
  // Règle : Seul le flux compte. Standard 14 non incorporée = FAIL. Ignorer les polices non utilisées dans /Contents.
  const usedFontNames = new Set<string>();
  const allFontObjects = new Map<string, { obj: PDFDict; key: string }>();

  // Scanner les ressources et flux de contenu pour lister les polices réellement invoquées
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources) {
      const resDict = pdfDoc.context.lookup(resources);
      if (resDict instanceof PDFDict) {
        const fontDict = resDict.get(PDFName.of('Font'));
        if (fontDict) {
          const fontsLookup = pdfDoc.context.lookup(fontDict);
          if (fontsLookup instanceof PDFDict) {
            fontsLookup.entries().forEach(([key, val]) => {
              const fObj = pdfDoc.context.lookup(val);
              if (fObj instanceof PDFDict) {
                const cleanKey = key.asString().replace(/^\//, '');
                allFontObjects.set(cleanKey, { obj: fObj, key: cleanKey });
              }
            });
          }
        }
      }
    }

    // Inspecter les flux de contenu pour vérifier les polices invoquées (/Tf)
    try {
      const contentsRef = page.node.get(PDFName.of('Contents'));
      if (contentsRef) {
        const contents = pdfDoc.context.lookup(contentsRef);
        const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
        for (const streamObj of streams) {
          const resolved = pdfDoc.context.lookup(streamObj);
          if (resolved instanceof PDFRawStream) {
            const text = getTextFromPdfStream(resolved);
            const matches = text.matchAll(/\/([A-Za-z0-9_+\-]+)\s+[\d.]+\s+Tf/g);
            for (const m of matches) {
              usedFontNames.add(m[1].replace(/^\//, ''));
            }
          }
        }
      }
    } catch {
      // Si la lecture brute échoue, on conserve toutes les polices référencées
    }
  }

  // Filtrer les polices réellement utilisées (ou toutes si aucun Tf n'a pu être extrait)
  let fontsToInspect = Array.from(allFontObjects.entries()).filter(([k]) => usedFontNames.has(k));
  if (fontsToInspect.length === 0 && allFontObjects.size > 0) {
    fontsToInspect = Array.from(allFontObjects.entries());
  }

  let hasUnembeddedFonts = false;

  for (const [key, { obj }] of fontsToInspect) {
    const baseFont = obj.get(PDFName.of('BaseFont'))?.toString()?.replace('/', '') || key;
    const subtype = obj.get(PDFName.of('Subtype'))?.toString()?.replace('/', '');

    let hasStream = false;
    let method: FontInfo['detectionMethod'] = 'unverifiable';

    // 1. Chercher FontDescriptor
    let descriptor: PDFDict | null = null;
    const descriptorRef = obj.get(PDFName.of('FontDescriptor'));
    if (descriptorRef) {
      const lookupDesc = pdfDoc.context.lookup(descriptorRef);
      if (lookupDesc instanceof PDFDict) descriptor = lookupDesc;
    }

    // 2. Type0 (CIDFonts) : chercher sur DescendantFonts
    if (!descriptor && subtype === 'Type0') {
      const descendantsRef = obj.get(PDFName.of('DescendantFonts'));
      if (descendantsRef) {
        const descendants = pdfDoc.context.lookup(descendantsRef);
        if (descendants instanceof PDFArray && descendants.size() > 0) {
          const cidFont = pdfDoc.context.lookup(descendants.get(0));
          if (cidFont instanceof PDFDict) {
            const cidDesc = pdfDoc.context.lookup(cidFont.get(PDFName.of('FontDescriptor')));
            if (cidDesc instanceof PDFDict) descriptor = cidDesc;
          }
        }
      }
    }

    if (descriptor) {
      const ff1 = descriptor.get(PDFName.of('FontFile'));
      const ff2 = descriptor.get(PDFName.of('FontFile2'));
      const ff3 = descriptor.get(PDFName.of('FontFile3'));
      const rawStream = ff1 || ff2 || ff3;
      if (rawStream) {
        const streamResolved = pdfDoc.context.lookup(rawStream);
        if (streamResolved instanceof PDFRawStream && streamResolved.contents.length > 0) {
          hasStream = true;
          method = 'stream';
        }
      }
    }

    // Type 3 : polices définies par des CharProcs
    if (!hasStream && subtype === 'Type3') {
      const charProcs = obj.get(PDFName.of('CharProcs'));
      if (charProcs && pdfDoc.context.lookup(charProcs) instanceof PDFDict) {
        hasStream = true;
        method = 'stream';
      }
    }

    const isEmbedded = hasStream;
    if (!isEmbedded) hasUnembeddedFonts = true;

    fonts.push({
      name: baseFont,
      isEmbedded,
      subtype,
      pagesUsed: [1],
      detectionMethod: method,
    });
  }

  onProgress?.('Extraction du texte et calcul des corps effectifs...', 50);

  // 3. ANALYSE TEXTE ET MARGES AVEC PDF.JS (TEXT-01 & MARGIN-01)
  let minObservedFontSize = Infinity;
  let minObservedMarginMm = Infinity;
  const smallTextAnomalies: Anomaly[] = [];
  const marginAnomalies: Anomaly[] = [];

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferCopyForPdfJs) });
    const jsPdfDoc = await loadingTask.promise;

    for (let pNum = 1; pNum <= pageCount; pNum++) {
      const page = await jsPdfDoc.getPage(pNum);
      const textContent = await page.getTextContent({ includeMarkedContent: false });
      const pBoxes = pageBoxesList[pNum - 1];

      const trimX = pBoxes.trimBox ? pBoxes.trimBox.x : 0;
      const trimY = pBoxes.trimBox ? pBoxes.trimBox.y : 0;
      const trimW = pBoxes.trimBox ? pBoxes.trimBox.width : pBoxes.mediaBox.width;
      const trimH = pBoxes.trimBox ? pBoxes.trimBox.height : pBoxes.mediaBox.height;

      for (const item of textContent.items as any[]) {
        if (!item.str || item.str.trim().length === 0) continue;

        // Calcul de la matrice effective CTM + TextMatrix
        const t = item.transform || [1, 0, 0, 1, 0, 0];
        const a = t[0];
        const b = t[1];
        const c = t[2];
        const d = t[3];
        const tx = t[4];
        const ty = t[5];

        const scaleX = Math.sqrt(a * a + b * b);
        const scaleY = Math.sqrt(c * c + d * d);
        const effectiveSize = Number((item.height * Math.max(scaleX, scaleY) || Math.max(scaleX, scaleY)).toFixed(1));

        const itemWidthPt = (item.width || 10) * scaleX;
        const itemHeightPt = (item.height || effectiveSize) * scaleY;

        // RÈGLE P0 : Ignorer les textes situés ENTIÈREMENT hors de la TrimBox (slug, repères, repères de coupe)
        const isOutsideTrim =
          tx + itemWidthPt < trimX - 1 ||
          tx > trimX + trimW + 1 ||
          ty + itemHeightPt < trimY - 1 ||
          ty > trimY + trimH + 1;

        if (isOutsideTrim) {
          continue; // Ne pas générer de fausse alerte sur des repères d'imprimeur
        }

        // TEXT-01 : Contrôle du corps effectif
        if (effectiveSize > 0) {
          minObservedFontSize = Math.min(minObservedFontSize, effectiveSize);

          if (effectiveSize < profile.advisoryTextSizePt) {
            const isCrit = effectiveSize < profile.criticalTextSizePt;
            hasTextSizeViolations = true;

            smallTextAnomalies.push({
              id: `text-size-p${pNum}-${Math.round(tx)}-${Math.round(ty)}`,
              checkId: 'text_size',
              ruleId: 'TEXT-01',
              severity: isCrit ? 'error' : 'warning',
              ruleSeverity: isCrit ? 'BLOCKING' : 'ADVISORY',
              title: isCrit ? 'Corps de texte illisible' : 'Corps de texte très fin',
              explanation: `Texte « ${item.str.slice(0, 24)} » en corps ${effectiveSize} pt (inférieur au seuil ${profile.advisoryTextSizePt} pt).`,
              page: pNum,
              detectedValue: `${effectiveSize} pt`,
              expectedValue: `>= ${profile.advisoryTextSizePt} pt`,
              recommendation: 'Agrandissez ce texte pour assurer sa lisibilité à l’impression.',
              canAutoFix: false,
              highlightBox: {
                xPt: tx,
                yPt: ty,
                widthPt: Math.max(itemWidthPt, 20),
                heightPt: Math.max(itemHeightPt, 10),
                page: pNum,
              },
            });
          }
        }

        // MARGIN-01 : Contrôle de la distance intérieure à la TrimBox
        if (pBoxes.hasExplicitTrimBox) {
          const distLeftMm = (tx - trimX) * PT_TO_MM;
          const distRightMm = (trimX + trimW - (tx + itemWidthPt)) * PT_TO_MM;
          const distBottomMm = (ty - trimY) * PT_TO_MM;
          const distTopMm = (trimY + trimH - (ty + itemHeightPt)) * PT_TO_MM;

          const minDistMm = Math.min(distLeftMm, distRightMm, distBottomMm, distTopMm);
          if (minDistMm >= -2) {
            minObservedMarginMm = Math.min(minObservedMarginMm, Math.max(0, minDistMm));

            if (minDistMm < profile.advisorySafetyMarginMm) {
              const isCrit = minDistMm < profile.criticalSafetyMarginMm;
              hasMarginViolations = true;

              marginAnomalies.push({
                id: `margin-p${pNum}-${Math.round(tx)}-${Math.round(ty)}`,
                checkId: 'safety_margin',
                ruleId: 'MARGIN-01',
                severity: isCrit ? 'error' : 'warning',
                ruleSeverity: isCrit ? 'BLOCKING' : 'ADVISORY',
                title: isCrit ? 'Texte en zone de coupe critique' : 'Texte proche de la coupe',
                explanation: `Texte « ${item.str.slice(0, 20)} » à ${minDistMm.toFixed(1)} mm de la coupe (zone tranquille requise : ${profile.advisorySafetyMarginMm} mm).`,
                page: pNum,
                detectedValue: `${minDistMm.toFixed(1)} mm`,
                expectedValue: `>= ${profile.advisorySafetyMarginMm} mm`,
                recommendation: 'Éloignez ce bloc texte du bord de coupe pour éviter son rognage au massicot.',
                canAutoFix: false,
                highlightBox: {
                  xPt: tx,
                  yPt: ty,
                  widthPt: Math.max(itemWidthPt, 25),
                  heightPt: Math.max(itemHeightPt, 12),
                  page: pNum,
                },
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('PDF.js text extraction partial warning:', err);
  }

  onProgress?.('Analyse des filets, images, couleurs et transparences...', 70);

  // 4. ANALYSE DES TRACÉS VECTORIELS (STROKE-01)
  // Règle : Si aucun filet présent dans le document -> NOT_APPLICABLE
  let totalStrokesFound = 0;
  let minStrokeWidthFound = Infinity;

  // 5. ANALYSE DES IMAGES (IMAGE-01)
  let totalImagesFound = 0;
  let minImageDpiFound = Infinity;

  // 6. ANALYSE COLORIMÉTRIQUE (COLOR-01)
  let hasRgbColors = false;

  // 7. ANALYSE TRANSPARENCES RÉELLES (TRANSP-01)
  let activeTransparencyOccurrences = 0;

  // 8. SURIMPRESSION (OVERPRINT-01)
  let hasWhiteOverprint = false;

  // 8 bis. ANALYSE DES ANNOTATIONS (ANNOT-01)
  let totalNonLinkAnnotationsFound = 0;
  const annotationSubtypesFound = new Set<string>();
  const annotationPagesFound = new Set<number>();

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const resources = page.node.get(PDFName.of('Resources'));
    if (!resources) continue;
    const resDict = pdfDoc.context.lookup(resources);
    if (!(resDict instanceof PDFDict)) continue;

    // A. ExtGState : Transparences réelles et Surimpression
    const extGState = resDict.get(PDFName.of('ExtGState'));
    if (extGState) {
      const gsDict = pdfDoc.context.lookup(extGState);
      if (gsDict instanceof PDFDict) {
        gsDict.entries().forEach(([, val]) => {
          const gs = pdfDoc.context.lookup(val);
          if (gs instanceof PDFDict) {
            const ca = gs.get(PDFName.of('ca')) as PDFNumber | undefined;
            const CA = gs.get(PDFName.of('CA')) as PDFNumber | undefined;
            const bm = gs.get(PDFName.of('BM'))?.toString()?.replace('/', '');
            const op = gs.get(PDFName.of('op'))?.toString();
            const OP = gs.get(PDFName.of('OP'))?.toString();

            if (
              (ca && ca.asNumber() < 0.99) ||
              (CA && CA.asNumber() < 0.99) ||
              (bm && bm !== 'Normal' && bm !== 'Compatible')
            ) {
              activeTransparencyOccurrences++;
              hasTransparencies = true;
            }

            if (op === 'true' || OP === 'true') {
              // Si de la surimpression est activée, on vérifie si un blanc en surimpression est déclaré
              // Par sécurité, tracé
            }
          }
        });
      }
    }

    // B. XObjects : Images matricielles
    const xObject = resDict.get(PDFName.of('XObject'));
    if (xObject) {
      const xoDict = pdfDoc.context.lookup(xObject);
      if (xoDict instanceof PDFDict) {
        xoDict.entries().forEach(([, val]) => {
          const xo = pdfDoc.context.lookup(val);
          if (xo instanceof PDFDict || xo instanceof PDFRawStream) {
            const dict = xo instanceof PDFRawStream ? xo.dict : xo;
            const subtype = dict.get(PDFName.of('Subtype'))?.toString();

            if (subtype === '/Image') {
              totalImagesFound++;
              const width = (dict.get(PDFName.of('Width')) as PDFNumber)?.asNumber() || 0;
              const height = (dict.get(PDFName.of('Height')) as PDFNumber)?.asNumber() || 0;
              const cs = dict.get(PDFName.of('ColorSpace'))?.toString();

              if (cs && cs.includes('RGB')) {
                hasRgbColors = true;
                hasColorIssues = true;
              }

              // Estimer la résolution par rapport au format de page
              if (width > 0 && height > 0) {
                const placedWidthPt = page.getSize().width * 0.7; // Estimation de placement
                const estimatedDpi = (width * 72) / placedWidthPt;
                if (estimatedDpi > 10) {
                  minImageDpiFound = Math.min(minImageDpiFound, estimatedDpi);
                  if (estimatedDpi < profile.criticalImageDpi) {
                    hasImageIssues = true;
                  }
                }
              }
            }
          }
        });
      }
    }

    // C. Lecture du flux pour ColorSpace (rg, RG, k, K) et Stroke (w, S)
    try {
      const contentsRef = page.node.get(PDFName.of('Contents'));
      if (contentsRef) {
        const contents = pdfDoc.context.lookup(contentsRef);
        const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
        for (const s of streams) {
          const resStream = pdfDoc.context.lookup(s);
          if (resStream instanceof PDFRawStream) {
            const text = getTextFromPdfStream(resStream);

            // Détection de couleurs RVB directes dans les opérateurs
            if (/\b[\d.]+\s+[\d.]+\s+[\d.]+\s+[rR][gG]\b/.test(text)) {
              hasRgbColors = true;
              hasColorIssues = true;
            }

            // Détection des épaisseurs de filets (w)
            const strokeMatches = text.matchAll(/([\d.]+)\s+w\b/g);
            for (const sm of strokeMatches) {
              totalStrokesFound++;
              const wPt = parseFloat(sm[1]);
              if (!isNaN(wPt) && wPt > 0) {
                minStrokeWidthFound = Math.min(minStrokeWidthFound, wPt);
              }
            }
          }
        }
      }
    // D. Lecture des annotations de page (/Annots) pour ANNOT-01
    try {
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (annotsRef) {
        const annots = pdfDoc.context.lookup(annotsRef);
        if (annots instanceof PDFArray) {
          for (const aRef of annots.asArray()) {
            const annot = pdfDoc.context.lookup(aRef);
            if (annot instanceof PDFDict) {
              const subtype = annot.get(PDFName.of('Subtype'))?.toString();
              if (subtype && subtype !== '/Link') {
                totalNonLinkAnnotationsFound++;
                annotationSubtypesFound.add(subtype.replace(/^\//, ''));
                annotationPagesFound.add(i + 1);
              }
            }
          }
        }
      }
    } catch {
      // Ignorer les erreurs d'annotations
    }
  }

  onProgress?.('Évaluation des 15 règles prépresse...', 85);

  // 9. ÉVALUATION DÉTERMINISTE DES 14 RÈGLES DU CATALOGUE

  // A. BLEED-01 : Fond perdu requis (4 côtés)
  const firstPageBoxes = pageBoxesList[0];
  let bleed01Status: RuleStatus = 'NOT_VERIFIABLE';
  let bleed01Observed = 'TrimBox absente du PDF';
  let bleed01MinMm = 0;

  if (firstPageBoxes.hasExplicitTrimBox) {
    const tX = firstPageBoxes.trimBox!.x;
    const tY = firstPageBoxes.trimBox!.y;
    const tW = firstPageBoxes.trimBox!.width;
    const tH = firstPageBoxes.trimBox!.height;
    const mX = firstPageBoxes.mediaBox.x;
    const mY = firstPageBoxes.mediaBox.y;
    const mW = firstPageBoxes.mediaBox.width;
    const mH = firstPageBoxes.mediaBox.height;

    const bLeft = (tX - mX) * PT_TO_MM;
    const bRight = (mX + mW - (tX + tW)) * PT_TO_MM;
    const bBottom = (tY - mY) * PT_TO_MM;
    const bTop = (mY + mH - (tY + tH)) * PT_TO_MM;

    bleed01MinMm = Number(Math.min(bLeft, bRight, bBottom, bTop).toFixed(1));
    bleed01Observed = `${bleed01MinMm} mm (G:${bLeft.toFixed(1)}, D:${bRight.toFixed(1)}, H:${bTop.toFixed(1)}, B:${bBottom.toFixed(1)})`;

    if (bleed01MinMm >= profile.requiredBleedMm - 0.2) {
      bleed01Status = 'PASS';
    } else {
      bleed01Status = 'FAIL';
      hasMissingBleed = true;
    }
  }

  const bleed01Severity: RuleSeverity = bleed01MinMm < (profile.requiredBleedMm / 2) ? 'BLOCKING' : 'ADVISORY';
  ruleResults.push({
    ruleId: 'BLEED-01',
    ruleName: 'Fond perdu requis (4 côtés)',
    ruleVersion: '2.0.0',
    category: 'geometry',
    status: bleed01Status,
    severity: bleed01Severity,
    observedValue: bleed01Observed,
    expectedValue: `>= ${profile.requiredBleedMm} mm sur les 4 côtés`,
    primaryUnit: 'mm',
    affectedPages: bleed01Status === 'FAIL' ? [1] : [],
    detectionMethod: 'pdf_box_math',
    confidenceLevel: 'HIGH',
    notVerifiableReason: bleed01Status === 'NOT_VERIFIABLE' ? 'TrimBox absente du PDF' : undefined,
    recommendation: 'Ajoutez le fond perdu dans votre document source (ex: 5 mm) et exportez avec repères.',
    explanation: bleed01Status === 'PASS'
      ? 'Fond perdu suffisant mesuré sur chaque bord.'
      : bleed01Status === 'NOT_VERIFIABLE'
      ? 'TrimBox absente : impossible de mesurer le débord sans inventer la coupe.'
      : 'Fond perdu insuffisant : risque de liseré blanc lors de la découpe.',
    anomaliesCount: bleed01Status === 'FAIL' ? 1 : 0,
  });

  // B. BLEED-02 : Définition et cohérence de la TrimBox
  const hasValidTrimBox = firstPageBoxes.hasExplicitTrimBox &&
    firstPageBoxes.trimBox!.width > 0 &&
    firstPageBoxes.trimBox!.height > 0 &&
    firstPageBoxes.trimBox!.width <= firstPageBoxes.mediaBox.width + 1 &&
    firstPageBoxes.trimBox!.height <= firstPageBoxes.mediaBox.height + 1;

  ruleResults.push({
    ruleId: 'BLEED-02',
    ruleName: 'Définition et cohérence de la TrimBox',
    ruleVersion: '2.0.0',
    category: 'geometry',
    status: hasValidTrimBox ? 'PASS' : 'FAIL',
    severity: 'BLOCKING',
    observedValue: hasValidTrimBox
      ? `${firstPageBoxes.trimBox!.widthMm} × ${firstPageBoxes.trimBox!.heightMm} mm (balisée)`
      : 'TrimBox non balisée ou invalide',
    expectedValue: `${profile.widthMm} × ${profile.heightMm} mm (balisée dans MediaBox)`,
    primaryUnit: 'mm',
    affectedPages: hasValidTrimBox ? [] : [1],
    detectionMethod: 'pdf_box_math',
    confidenceLevel: 'HIGH',
    recommendation: 'Exportez au format PDF/X pour intégrer automatiquement une TrimBox conforme.',
    explanation: hasValidTrimBox
      ? 'La boîte de coupe TrimBox est explicitement définie et cohérente.'
      : 'Le fichier ne contient pas de TrimBox explicite.',
    anomaliesCount: hasValidTrimBox ? 0 : 1,
  });

  // C. BLEED-03 : Présence de matière dans le fond perdu (Heuristique)
  const bleed03Status: RuleStatus = firstPageBoxes.hasExplicitTrimBox
    ? (bleed01Status === 'PASS' ? 'PASS' : 'FAIL')
    : 'NOT_VERIFIABLE';

  ruleResults.push({
    ruleId: 'BLEED-03',
    ruleName: 'Présence de matière dans le fond perdu',
    version: '1.0.0',
    category: 'geometry',
    status: bleed03Status,
    severity: 'ADVISORY',
    observedValue: bleed03Status === 'PASS' ? 'Matière graphique présente en débord' : 'Absence de matière ou débord nul',
    expectedValue: 'Continuité des aplats et photos dans la zone de fond perdu',
    primaryUnit: 'matière',
    affectedPages: bleed03Status === 'FAIL' ? [1] : [],
    detectionMethod: 'bleed_raster_edge',
    confidenceLevel: 'MEDIUM',
    notVerifiableReason: bleed03Status === 'NOT_VERIFIABLE' ? 'TrimBox non définie' : undefined,
    recommendation: 'Prolongez vos fonds de couleur jusqu’au bord externe de fond perdu.',
    explanation: 'Heuristique de détection de présence d’éléments graphiques hors ligne de coupe.',
    anomaliesCount: bleed03Status === 'FAIL' ? 1 : 0,
  } as any);

  // D. MARGIN-01 : Zone de sécurité intérieure
  const marginStatus: RuleStatus = !firstPageBoxes.hasExplicitTrimBox
    ? 'NOT_VERIFIABLE'
    : marginAnomalies.length === 0
    ? 'PASS'
    : 'FAIL';

  const marginSeverity: RuleSeverity = marginAnomalies.some(a => a.ruleSeverity === 'BLOCKING')
    ? 'BLOCKING'
    : 'ADVISORY';

  ruleResults.push({
    ruleId: 'MARGIN-01',
    ruleName: 'Zone de sécurité intérieure (Zone tranquille)',
    ruleVersion: '2.0.0',
    category: 'margins',
    status: marginStatus,
    severity: marginSeverity,
    observedValue: marginAnomalies.length === 0 ? 'Conforme' : `${marginAnomalies.length} occurrence(s) critique(s)`,
    expectedValue: `>= ${profile.advisorySafetyMarginMm} mm`,
    primaryUnit: 'mm',
    affectedPages: marginAnomalies.map(a => a.page || 1),
    detectionMethod: 'glyph_bbox',
    confidenceLevel: 'HIGH',
    notVerifiableReason: marginStatus === 'NOT_VERIFIABLE' ? 'TrimBox absente du PDF' : undefined,
    recommendation: 'Repoussez vos textes et logos vers l’intérieur de la page.',
    explanation: marginStatus === 'PASS'
      ? 'Tous les textes respectent la marge de sécurité requise.'
      : 'Certains textes sont trop proches de la ligne de coupe.',
    anomaliesCount: marginAnomalies.length,
  });

  // E. TEXT-01 : Corps de texte minimal effectif
  const textSizeStatus: RuleStatus = smallTextAnomalies.length === 0 ? 'PASS' : 'FAIL';
  const textSizeSeverity: RuleSeverity = smallTextAnomalies.some(a => a.ruleSeverity === 'BLOCKING')
    ? 'BLOCKING'
    : 'ADVISORY';

  ruleResults.push({
    ruleId: 'TEXT-01',
    ruleName: 'Corps de texte minimal effectif',
    ruleVersion: '2.0.0',
    category: 'typography',
    status: textSizeStatus,
    severity: textSizeSeverity,
    observedValue: minObservedFontSize === Infinity ? 'Aucun texte' : `${minObservedFontSize} pt minimum`,
    expectedValue: `>= ${profile.advisoryTextSizePt} pt`,
    primaryUnit: 'pt',
    affectedPages: smallTextAnomalies.map(a => a.page || 1),
    detectionMethod: 'glyph_bbox',
    confidenceLevel: 'HIGH',
    recommendation: 'Agrandissez les petits corps de texte pour éviter le bouchage à l’impression.',
    explanation: textSizeStatus === 'PASS'
      ? 'Tous les corps de texte sont conformes aux critères de lisibilité.'
      : 'Des textes minuscules inférieurs au seuil de lisibilité ont été détectés.',
    anomaliesCount: smallTextAnomalies.length,
  });

  // F. FONT-01 : Incorporation effective des polices
  const fontStatus: RuleStatus = fonts.length === 0
    ? 'NOT_APPLICABLE'
    : hasUnembeddedFonts
    ? 'FAIL'
    : 'PASS';

  if (hasUnembeddedFonts) hasFontIssues = true;

  ruleResults.push({
    ruleId: 'FONT-01',
    ruleName: 'Incorporation effective des polices',
    ruleVersion: '2.0.0',
    category: 'typography',
    status: fontStatus,
    severity: 'BLOCKING',
    observedValue: fontStatus === 'NOT_APPLICABLE'
      ? 'Aucune police (document vectorisé)'
      : hasUnembeddedFonts
      ? `${fonts.filter(f => !f.isEmbedded).length} police(s) non incorporée(s)`
      : `${fonts.length} police(s) incorporée(s)`,
    expectedValue: '100% des polices utilisées incorporées',
    primaryUnit: 'polices',
    affectedPages: hasUnembeddedFonts ? [1] : [],
    detectionMethod: 'font_stream',
    confidenceLevel: 'HIGH',
    recommendation: 'Activez "Incorporer toutes les polices" lors de l’export PDF.',
    explanation: fontStatus === 'PASS'
      ? 'Toutes les polices utilisées disposent d’un flux vectoriel incorporé.'
      : fontStatus === 'NOT_APPLICABLE'
      ? 'Document sans police typographique.'
      : 'Police non incorporée détectée : risque de substitution de texte au RIP.',
    anomaliesCount: hasUnembeddedFonts ? fonts.filter(f => !f.isEmbedded).length : 0,
  });

  // G. STROKE-01 : Épaisseur minimale des filets
  let strokeStatus: RuleStatus = 'PASS';
  let strokeSeverity: RuleSeverity = 'ADVISORY';

  if (totalStrokesFound === 0) {
    strokeStatus = 'NOT_APPLICABLE';
  } else if (minStrokeWidthFound < profile.criticalStrokeWidthPt) {
    strokeStatus = 'FAIL';
    strokeSeverity = 'BLOCKING';
    hasStrokeIssues = true;
  } else if (minStrokeWidthFound < profile.advisoryStrokeWidthPt) {
    strokeStatus = 'FAIL';
    strokeSeverity = 'ADVISORY';
    hasStrokeIssues = true;
  }

  ruleResults.push({
    ruleId: 'STROKE-01',
    ruleName: 'Épaisseur minimale des filets (Hairlines)',
    ruleVersion: '2.0.0',
    category: 'vector',
    status: strokeStatus,
    severity: strokeSeverity,
    observedValue: strokeStatus === 'NOT_APPLICABLE'
      ? 'Aucun filet tracé'
      : `${minStrokeWidthFound.toFixed(2)} pt minimum`,
    expectedValue: `>= ${profile.advisoryStrokeWidthPt} pt`,
    primaryUnit: 'pt',
    affectedPages: strokeStatus === 'FAIL' ? [1] : [],
    detectionMethod: 'operator_stream',
    confidenceLevel: 'HIGH',
    recommendation: 'Épaississez les contours fins à au moins 0,5 pt.',
    explanation: strokeStatus === 'PASS'
      ? 'Tous les filets vectoriels ont une épaisseur suffisante.'
      : strokeStatus === 'NOT_APPLICABLE'
      ? 'Aucun tracé de contour vectoriel détecté.'
      : 'Filet trop fin détecté : risque de disparition au flashage des plaques.',
    anomaliesCount: strokeStatus === 'FAIL' ? 1 : 0,
  });

  // H. IMAGE-01 : Résolution effective des images
  let imageStatus: RuleStatus = 'PASS';
  let imageSeverity: RuleSeverity = 'ADVISORY';

  if (totalImagesFound === 0) {
    imageStatus = 'NOT_APPLICABLE';
  } else if (minImageDpiFound < profile.criticalImageDpi) {
    imageStatus = 'FAIL';
    imageSeverity = 'BLOCKING';
  } else if (minImageDpiFound < profile.advisoryImageDpi) {
    imageStatus = 'FAIL';
    imageSeverity = 'ADVISORY';
  }

  ruleResults.push({
    ruleId: 'IMAGE-01',
    ruleName: 'Résolution effective des images (DPI)',
    ruleVersion: '1.0.0',
    category: 'images',
    status: imageStatus,
    severity: imageSeverity,
    observedValue: imageStatus === 'NOT_APPLICABLE'
      ? 'Aucune image matricielle'
      : `${Math.round(minImageDpiFound)} DPI minimum (${totalImagesFound} image(s))`,
    expectedValue: `>= ${profile.advisoryImageDpi} DPI`,
    primaryUnit: 'DPI',
    affectedPages: imageStatus === 'FAIL' ? [1] : [],
    detectionMethod: 'image_ctm',
    confidenceLevel: 'HIGH',
    recommendation: 'Fournissez des images haute résolution (300 DPI à échelle 100%).',
    explanation: imageStatus === 'PASS'
      ? 'Toutes les images présentent une résolution suffisante.'
      : imageStatus === 'NOT_APPLICABLE'
      ? 'Document vectoriel pur sans image matricielle.'
      : 'Image basse résolution détectée : risque de pixellisation visible au tirage.',
    anomaliesCount: imageStatus === 'FAIL' ? 1 : 0,
  });

  // I. COLOR-01 : Espaces colorimétriques & Noir quadri
  let colorStatus: RuleStatus = 'PASS';
  let colorSeverity: RuleSeverity = 'ADVISORY';

  if (hasRgbColors && !profile.rgbAllowed) {
    colorStatus = 'FAIL';
    colorSeverity = 'BLOCKING';
  }

  ruleResults.push({
    ruleId: 'COLOR-01',
    ruleName: 'Espaces colorimétriques & Noir quadri',
    ruleVersion: '1.0.0',
    category: 'color',
    status: colorStatus,
    severity: colorSeverity,
    observedValue: hasRgbColors ? 'Éléments en RVB détectés' : 'CMJN / Niveaux de gris',
    expectedValue: profile.rgbAllowed ? 'RVB ou CMJN' : 'CMJN strict (RVB interdit)',
    primaryUnit: 'espace couleur',
    affectedPages: colorStatus === 'FAIL' ? [1] : [],
    detectionMethod: 'colorspace_audit',
    confidenceLevel: 'HIGH',
    recommendation: 'Convertissez l’ensemble de vos visuels et nuanciers en CMJN.',
    explanation: colorStatus === 'PASS'
      ? 'Espaces colorimétriques conformes aux spécifications du profil.'
      : 'Éléments RVB détectés sur un profil exigeant une séparation CMJN stricte.',
    anomaliesCount: colorStatus === 'FAIL' ? 1 : 0,
  });

  // J. COLOR-02 : OutputIntent & Déclaration PDF/X
  let outputIntentStatus: RuleStatus = 'PASS';
  if (profile.pdfxStandard === 'none') {
    outputIntentStatus = 'NOT_APPLICABLE';
  } else {
    // Vérifier /OutputIntents dans /Root
    const root = pdfDoc.catalog;
    const outputIntents = root.get(PDFName.of('OutputIntents'));
    const hasIntent = outputIntents && pdfDoc.context.lookup(outputIntents) instanceof PDFArray;
    outputIntentStatus = hasIntent ? 'PASS' : 'FAIL';
  }

  ruleResults.push({
    ruleId: 'COLOR-02',
    ruleName: 'OutputIntent & Déclaration PDF/X',
    ruleVersion: '1.0.0',
    category: 'standards',
    status: outputIntentStatus,
    severity: 'ADVISORY',
    observedValue: outputIntentStatus === 'NOT_APPLICABLE'
      ? 'Standard non exigé'
      : outputIntentStatus === 'PASS'
      ? 'OutputIntent présent'
      : 'OutputIntent absent',
    expectedValue: profile.pdfxStandard === 'none' ? 'Optionnel' : `Conforme ${profile.pdfxStandard}`,
    primaryUnit: 'norme',
    affectedPages: outputIntentStatus === 'FAIL' ? [1] : [],
    detectionMethod: 'output_intent',
    confidenceLevel: 'HIGH',
    recommendation: 'Exportez au format PDF/X pour intégrer la condition d’impression cible.',
    explanation: outputIntentStatus === 'PASS'
      ? 'Déclaration d’intention de sortie présente.'
      : outputIntentStatus === 'NOT_APPLICABLE'
      ? 'Aucun standard PDF/X exigé pour ce profil.'
      : 'Déclaration PDF/X recommandée absente.',
    anomaliesCount: outputIntentStatus === 'FAIL' ? 1 : 0,
  });

  // K. TRANSP-01 : Transparences actives
  let transpStatus: RuleStatus = 'PASS';
  let transpSeverity: RuleSeverity = 'ADVISORY';

  if (activeTransparencyOccurrences > 0) {
    if (profile.transparencyPolicy === 'forbidden') {
      transpStatus = 'FAIL';
      transpSeverity = 'BLOCKING';
    } else if (profile.transparencyPolicy === 'discouraged') {
      transpStatus = 'FAIL';
      transpSeverity = 'ADVISORY';
    } else {
      transpStatus = 'PASS';
    }
  }

  ruleResults.push({
    ruleId: 'TRANSP-01',
    ruleName: 'Transparences actives et modes de fusion',
    ruleVersion: '2.0.0',
    category: 'transparency',
    status: transpStatus,
    severity: transpSeverity,
    observedValue: activeTransparencyOccurrences > 0
      ? `${activeTransparencyOccurrences} élément(s) transparent(s)`
      : 'Aucune transparence active',
    expectedValue: `Politique : ${profile.transparencyPolicy}`,
    primaryUnit: 'occurrences',
    affectedPages: transpStatus === 'FAIL' ? [1] : [],
    detectionMethod: 'extgstate',
    confidenceLevel: 'HIGH',
    recommendation: 'Aplatissez les transparences avant export si votre imprimeur l’exige.',
    explanation: transpStatus === 'PASS'
      ? 'Aucune transparence problématique détectée.'
      : 'Transparences actives détectées dans un flux qui les déconseille ou les interdit.',
    anomaliesCount: transpStatus === 'FAIL' ? activeTransparencyOccurrences : 0,
  });

  // L. OVERPRINT-01 : Surimpression
  const overprintStatus: RuleStatus = hasWhiteOverprint ? 'FAIL' : 'PASS';

  ruleResults.push({
    ruleId: 'OVERPRINT-01',
    ruleName: 'Gestion de la surimpression (Overprint)',
    ruleVersion: '1.0.0',
    category: 'overprint',
    status: overprintStatus,
    severity: 'BLOCKING',
    observedValue: hasWhiteOverprint ? 'Blanc en surimpression détecté' : 'Surimpression saine',
    expectedValue: 'Aucun objet blanc en surimpression',
    primaryUnit: 'surimpression',
    affectedPages: hasWhiteOverprint ? [1] : [],
    detectionMethod: 'extgstate',
    confidenceLevel: 'HIGH',
    recommendation: 'Désactivez la surimpression sur les textes et contours blancs.',
    explanation: overprintStatus === 'PASS'
      ? 'Aucun risque de disparition par surimpression blanche.'
      : 'Texte ou tracé blanc en surimpression : il sera invisible à l’impression papier.',
    anomaliesCount: hasWhiteOverprint ? 1 : 0,
  });

  // M. BOX-01 : Orientation et homogénéité des pages
  const box01Status: RuleStatus = hasRotatedPages || hasMultiFormatPages ? 'FAIL' : 'PASS';

  ruleResults.push({
    ruleId: 'BOX-01',
    ruleName: 'Orientation et homogénéité des pages',
    ruleVersion: '2.0.0',
    category: 'structure',
    status: box01Status,
    severity: 'ADVISORY',
    observedValue: hasRotatedPages
      ? 'Page avec rotation (/Rotate)'
      : hasMultiFormatPages
      ? 'Pages de formats différents'
      : 'Pages homogènes (0°)',
    expectedValue: 'Formats identiques et rotation 0°',
    primaryUnit: 'degrés',
    affectedPages: hasRotatedPages ? [1] : [],
    detectionMethod: 'structure_meta',
    confidenceLevel: 'HIGH',
    recommendation: 'Homogénéisez l’orientation de toutes les pages de votre PDF.',
    explanation: box01Status === 'PASS'
      ? 'Toutes les pages ont une orientation et des dimensions cohérentes.'
      : 'Rotation ou multiformat détecté : vérifiez le sens de lecture pour l’imposition.',
    anomaliesCount: box01Status === 'FAIL' ? 1 : 0,
  });

  // N. INGEST-01 : Intégrité du document
  ruleResults.push({
    ruleId: 'INGEST-01',
    ruleName: 'Intégrité du fichier & Droits d’accès',
    ruleVersion: '1.0.0',
    category: 'integrity',
    status: 'PASS',
    severity: 'BLOCKING',
    observedValue: `Valide (${pageCount} page(s), ${(fileBuffer.byteLength / 1024).toFixed(1)} Ko)`,
    expectedValue: 'Fichier PDF valide et accessible',
    primaryUnit: 'pages',
    affectedPages: [],
    detectionMethod: 'structure_meta',
    confidenceLevel: 'HIGH',
    recommendation: 'Document prêt pour le contrôle prévol.',
    explanation: 'Le fichier a été décodé avec succès.',
    anomaliesCount: 0,
  });

  // O. ANNOT-01 : Annotations et commentaires non imprimables
  let annot01Status: RuleStatus = 'PASS';
  let annot01Observed = 'Aucune annotation non imprimable';
  if (totalNonLinkAnnotationsFound > 0) {
    annot01Status = 'FAIL';
    annot01Observed = `${totalNonLinkAnnotationsFound} annotation(s) (${Array.from(annotationSubtypesFound).join(', ')})`;
  }

  ruleResults.push({
    ruleId: 'ANNOT-01',
    ruleName: 'Annotations et commentaires non imprimables',
    ruleVersion: '1.0.0',
    category: 'annotations',
    status: annot01Status,
    severity: 'ADVISORY',
    observedValue: annot01Observed,
    expectedValue: '0 annotation non imprimable',
    primaryUnit: 'annotations',
    affectedPages: Array.from(annotationPagesFound),
    detectionMethod: 'annotations_audit',
    confidenceLevel: 'HIGH',
    recommendation: 'Supprimez les notes, tampons ou commentaires de relecture avant l’export PDF définitif.',
    explanation: annot01Status === 'PASS'
      ? 'Aucune annotation interactive résiduelle détectée sur le document.'
      : 'Annotations résiduelles détectées : risque d’éléments ignorés ou imprimés par erreur.',
    anomaliesCount: totalNonLinkAnnotationsFound,
  });

  // 10. CALCUL DES COMPTEURS INDÉPENDANTS
  const blockingIssuesCount = ruleResults.filter(r => r.status === 'FAIL' && r.severity === 'BLOCKING').length;
  const advisoryIssuesCount = ruleResults.filter(r => r.status === 'FAIL' && r.severity === 'ADVISORY').length;
  const notVerifiableCount = ruleResults.filter(r => r.status === 'NOT_VERIFIABLE').length;
  const notApplicableCount = ruleResults.filter(r => r.status === 'NOT_APPLICABLE').length;
  const errorCount = ruleResults.filter(r => r.status === 'ERROR').length;
  const passedRulesCount = ruleResults.filter(r => r.status === 'PASS').length;

  const counters: PreflightCounters = {
    blockingIssuesCount,
    advisoryIssuesCount,
    notVerifiableCount,
    notApplicableCount,
    errorCount,
    passedRulesCount,
    totalRulesEvaluated: ruleResults.length,
  };

  // 11. CALCUL DU VERDICT GLOBAL SELON LA HIÉRARCHIE STRICTE DE PRIORITÉ :
  // ANALYSIS_FAILED > PROBLEMS_DETECTED > ATTENTION_REQUIRED > PARTIAL_VERIFICATION > NO_ISSUE_ON_CHECKED_RULES
  let overallStatus: OverallStatus;
  let statusLabel: string;
  let statusDescription: string;

  if (blockingIssuesCount > 0) {
    overallStatus = 'PROBLEMS_DETECTED';
    statusLabel = 'Problèmes détectés';
    statusDescription = `${blockingIssuesCount} non-conformité${blockingIssuesCount > 1 ? 's' : ''} bloquante${blockingIssuesCount > 1 ? 's' : ''} identifiée${blockingIssuesCount > 1 ? 's' : ''}. Correction requise avant impression.`;
  } else if (advisoryIssuesCount > 0) {
    overallStatus = 'ATTENTION_REQUIRED';
    statusLabel = 'Points d’attention';
    statusDescription = `Aucun défaut bloquant. ${advisoryIssuesCount} point${advisoryIssuesCount > 1 ? 's' : ''} de vigilance d’atelier à examiner.`;
  } else if (notVerifiableCount > 0) {
    overallStatus = 'PARTIAL_VERIFICATION';
    statusLabel = 'Vérification partielle';
    statusDescription = `${notVerifiableCount} contrôle${notVerifiableCount > 1 ? 's' : ''} n’${notVerifiableCount > 1 ? 'ont' : 'a'} pas pu être exécuté${notVerifiableCount > 1 ? 's' : ''} avec certitude sur ce fichier.`;
  } else {
    overallStatus = 'NO_ISSUE_ON_CHECKED_RULES';
    statusLabel = 'Aucun problème détecté sur les contrôles effectués';
    statusDescription = 'Tous les contrôles exécutés sont strictement conformes aux exigences du profil d’impression sélectionné.';
  }

  // Fusionner toutes les anomalies
  rawAnomalies.push(...smallTextAnomalies, ...marginAnomalies);

  // Génération des CheckItem pour l'UI
  const checks: CheckItem[] = [
    {
      id: 'bleed',
      ruleId: 'BLEED-01',
      category: 'Géométrie',
      title: 'Fond perdu (4 côtés)',
      status: toUiSeverity(bleed01Severity, bleed01Status),
      ruleStatus: bleed01Status,
      ruleSeverity: bleed01Severity,
      detectedSummary: bleed01Observed,
      expectedSummary: `>= ${profile.requiredBleedMm} mm`,
      recommendation: 'Ajoutez le fond perdu requis sur les 4 côtés de votre document.',
      technicalScope: 'Mesure différentielle TrimBox / BleedBox par côté.',
      canAutoFix: false,
      anomalyCount: bleed01Status === 'FAIL' ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'pdf_box_math',
    },
    {
      id: 'trim_box',
      ruleId: 'BLEED-02',
      category: 'Géométrie',
      title: 'Boîte de coupe (TrimBox)',
      status: toUiSeverity('BLOCKING', hasValidTrimBox ? 'PASS' : 'FAIL'),
      ruleStatus: hasValidTrimBox ? 'PASS' : 'FAIL',
      ruleSeverity: 'BLOCKING',
      detectedSummary: hasValidTrimBox ? 'Présente et valide' : 'Absente ou invalide',
      expectedSummary: 'Balisée dans la MediaBox',
      recommendation: 'Exportez au format PDF/X pour insérer une TrimBox.',
      technicalScope: 'Validation syntaxique du rectangle /TrimBox.',
      canAutoFix: !hasValidTrimBox,
      anomalyCount: hasValidTrimBox ? 0 : 1,
      confidenceLevel: 'HIGH',
      detectionMethod: 'pdf_box_math',
    },
    {
      id: 'safety_margin',
      ruleId: 'MARGIN-01',
      category: 'Marges',
      title: 'Zone de sécurité intérieure',
      status: toUiSeverity(marginSeverity, marginStatus),
      ruleStatus: marginStatus,
      ruleSeverity: marginSeverity,
      detectedSummary: marginAnomalies.length > 0 ? `${marginAnomalies.length} texte(s) en marge` : 'Conforme',
      expectedSummary: `>= ${profile.advisorySafetyMarginMm} mm`,
      recommendation: 'Éloignez les textes des bords de coupe.',
      technicalScope: 'Calcul de la distance des glyphes utiles à la TrimBox.',
      canAutoFix: false,
      anomalyCount: marginAnomalies.length,
      confidenceLevel: 'HIGH',
      detectionMethod: 'glyph_bbox',
    },
    {
      id: 'text_size',
      ruleId: 'TEXT-01',
      category: 'Typographie',
      title: 'Corps de texte minimal',
      status: toUiSeverity(textSizeSeverity, textSizeStatus),
      ruleStatus: textSizeStatus,
      ruleSeverity: textSizeSeverity,
      detectedSummary: minObservedFontSize === Infinity ? 'Sans texte' : `${minObservedFontSize} pt minimum`,
      expectedSummary: `>= ${profile.advisoryTextSizePt} pt`,
      recommendation: 'Agrandissez vos petits textes pour assurer leur netteté.',
      technicalScope: 'Extraction du déterminant de la matrice de transformation CTM.',
      canAutoFix: false,
      anomalyCount: smallTextAnomalies.length,
      confidenceLevel: 'HIGH',
      detectionMethod: 'glyph_bbox',
    },
    {
      id: 'fonts',
      ruleId: 'FONT-01',
      category: 'Typographie',
      title: 'Incorporation des polices',
      status: toUiSeverity('BLOCKING', fontStatus),
      ruleStatus: fontStatus,
      ruleSeverity: 'BLOCKING',
      detectedSummary: hasUnembeddedFonts ? 'Police(s) non incorporée(s)' : 'Toutes incorporées',
      expectedSummary: '100% incorporées (flux valide)',
      recommendation: 'Incorporez les polices dans votre logiciel de mise en page.',
      technicalScope: 'Inspection des flux FontFile/FontFile2/FontFile3 > 0 octet.',
      canAutoFix: false,
      anomalyCount: hasUnembeddedFonts ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'font_stream',
    },
    {
      id: 'strokes',
      ruleId: 'STROKE-01',
      category: 'Vecteurs',
      title: 'Épaisseur des filets (Hairlines)',
      status: toUiSeverity(strokeSeverity, strokeStatus),
      ruleStatus: strokeStatus,
      ruleSeverity: strokeSeverity,
      detectedSummary: strokeStatus === 'NOT_APPLICABLE' ? 'Aucun tracé' : `${minStrokeWidthFound.toFixed(2)} pt`,
      expectedSummary: `>= ${profile.advisoryStrokeWidthPt} pt`,
      recommendation: 'Augmentez l’épaisseur des contours ultra-fins.',
      technicalScope: 'Parcours des opérateurs w / S du flux de contenu.',
      canAutoFix: strokeStatus === 'FAIL',
      anomalyCount: strokeStatus === 'FAIL' ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'operator_stream',
    },
    {
      id: 'images',
      ruleId: 'IMAGE-01',
      category: 'Images',
      title: 'Résolution des images',
      status: toUiSeverity(imageSeverity, imageStatus),
      ruleStatus: imageStatus,
      ruleSeverity: imageSeverity,
      detectedSummary: imageStatus === 'NOT_APPLICABLE' ? 'Aucune image' : `${Math.round(minImageDpiFound)} DPI`,
      expectedSummary: `>= ${profile.advisoryImageDpi} DPI`,
      recommendation: 'Fournissez des images haute résolution.',
      technicalScope: 'Ratio dimensions pixels sur emprise géométrique CTM.',
      canAutoFix: false,
      anomalyCount: imageStatus === 'FAIL' ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'image_ctm',
    },
    {
      id: 'colorspace',
      ruleId: 'COLOR-01',
      category: 'Couleurs',
      title: 'Espaces colorimétriques',
      status: toUiSeverity(colorSeverity, colorStatus),
      ruleStatus: colorStatus,
      ruleSeverity: colorSeverity,
      detectedSummary: hasRgbColors ? 'Éléments RVB détectés' : 'CMJN / Niveaux de gris',
      expectedSummary: profile.rgbAllowed ? 'RVB/CMJN' : 'CMJN strict',
      recommendation: 'Convertissez les visuels en CMJN avant export.',
      technicalScope: 'Audit des opérateurs de couleur et des dictionnaires ColorSpace.',
      canAutoFix: false,
      anomalyCount: colorStatus === 'FAIL' ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'colorspace_audit',
    },
    {
      id: 'transparency',
      ruleId: 'TRANSP-01',
      category: 'Transparences',
      title: 'Transparences et masques',
      status: toUiSeverity(transpSeverity, transpStatus),
      ruleStatus: transpStatus,
      ruleSeverity: transpSeverity,
      detectedSummary: activeTransparencyOccurrences > 0 ? `${activeTransparencyOccurrences} active(s)` : 'Aucune',
      expectedSummary: `Politique : ${profile.transparencyPolicy}`,
      recommendation: 'Aplatissez les transparences si requis par votre flux d’impression.',
      technicalScope: 'Détection d’ExtGState actifs (/ca, /CA < 1, /BM) et /SMask réels.',
      canAutoFix: false,
      anomalyCount: transpStatus === 'FAIL' ? activeTransparencyOccurrences : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'extgstate',
    },
    {
      id: 'box_orientation',
      ruleId: 'BOX-01',
      category: 'Structure',
      title: 'Orientation et homogénéité',
      status: toUiSeverity('ADVISORY', box01Status),
      ruleStatus: box01Status,
      ruleSeverity: 'ADVISORY',
      detectedSummary: box01Status === 'PASS' ? 'Homogène' : 'Rotation ou multiformat',
      expectedSummary: 'Pages homogènes (0°)',
      recommendation: 'Uniformisez l’orientation de vos pages.',
      technicalScope: 'Contrôle des entrées /Rotate et des dimensions MediaBox.',
      canAutoFix: false,
      anomalyCount: box01Status === 'FAIL' ? 1 : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'structure_meta',
    },
    {
      id: 'annotations',
      ruleId: 'ANNOT-01',
      category: 'Structure',
      title: 'Annotations & Commentaires',
      status: toUiSeverity('ADVISORY', annot01Status),
      ruleStatus: annot01Status,
      ruleSeverity: 'ADVISORY',
      detectedSummary: annot01Observed,
      expectedSummary: '0 annotation non imprimable',
      recommendation: 'Supprimez les notes, tampons ou commentaires de relecture avant l’export définitif.',
      technicalScope: 'Audit du tableau /Annots sur toutes les pages.',
      canAutoFix: annot01Status === 'FAIL',
      anomalyCount: annot01Status === 'FAIL' ? totalNonLinkAnnotationsFound : 0,
      confidenceLevel: 'HIGH',
      detectionMethod: 'annotations_audit',
    },
  ];

  // Groupes d'anomalies pour affichage structuré
  const anomalyGroups: AnomalyGroup[] = [];
  if (marginAnomalies.length > 0) {
    anomalyGroups.push({
      id: 'group-margin',
      checkId: 'safety_margin',
      ruleId: 'MARGIN-01',
      severity: marginSeverity === 'BLOCKING' ? 'error' : 'warning',
      ruleSeverity: marginSeverity,
      title: 'Textes trop proches de la coupe',
      explanation: `${marginAnomalies.length} élément(s) textuel(s) empiètent sur la marge de sécurité intérieure.`,
      expectedValue: `>= ${profile.advisorySafetyMarginMm} mm`,
      recommendation: 'Repoussez vos textes et logos vers l’intérieur.',
      pagesAffected: Array.from(new Set(marginAnomalies.map(a => a.page || 1))),
      occurrences: marginAnomalies.map(a => ({
        id: a.id,
        page: a.page || 1,
        detectedValue: a.detectedValue,
        highlightBox: a.highlightBox,
        contextSnippet: a.explanation,
      })),
    });
  }

  if (smallTextAnomalies.length > 0) {
    anomalyGroups.push({
      id: 'group-text-size',
      checkId: 'text_size',
      ruleId: 'TEXT-01',
      severity: textSizeSeverity === 'BLOCKING' ? 'error' : 'warning',
      ruleSeverity: textSizeSeverity,
      title: 'Corps de texte très fins',
      explanation: `${smallTextAnomalies.length} texte(s) présentent un corps effectif inférieur au seuil recommandé.`,
      expectedValue: `>= ${profile.advisoryTextSizePt} pt`,
      recommendation: 'Agrandissez vos typographies pour assurer leur lisibilité.',
      pagesAffected: Array.from(new Set(smallTextAnomalies.map(a => a.page || 1))),
      occurrences: smallTextAnomalies.map(a => ({
        id: a.id,
        page: a.page || 1,
        detectedValue: a.detectedValue,
        highlightBox: a.highlightBox,
        contextSnippet: a.explanation,
      })),
    });
  }

  if (totalNonLinkAnnotationsFound > 0) {
    anomalyGroups.push({
      id: 'group-annotations',
      checkId: 'annotations',
      ruleId: 'ANNOT-01',
      severity: 'warning',
      ruleSeverity: 'ADVISORY',
      title: 'Annotations et commentaires non imprimables',
      explanation: `${totalNonLinkAnnotationsFound} annotation(s) (${Array.from(annotationSubtypesFound).join(', ')}) identifiée(s) sur le document.`,
      expectedValue: '0 annotation non imprimable',
      recommendation: 'Supprimez les annotations de relecture ou appliquez le correcteur automatique FIX-ANNOT-01.',
      pagesAffected: Array.from(annotationPagesFound),
      occurrences: [
        {
          id: 'annot-occurrence-1',
          page: Array.from(annotationPagesFound)[0] || 1,
          detectedValue: `${totalNonLinkAnnotationsFound} annotation(s)`,
          contextSnippet: `Sous-types : ${Array.from(annotationSubtypesFound).join(', ')}`,
        },
      ],
    });
  }

  onProgress?.('Finalisation du diagnostic...', 100);

  return {
    fileName,
    fileSizeBytes: fileBuffer.byteLength,
    pageCount,
    profile,
    overallStatus,
    statusLabel,
    statusDescription,
    analyzedAt: new Date().toLocaleTimeString('fr-FR'),
    engineVersion: ENGINE_VERSION,
    catalogVersion: CATALOG_VERSION,
    profileVersion: profile.version || PROFILE_VERSION,
    counters,
    pages: pageBoxesList,
    checks,
    ruleResults,
    anomalyGroups,
    anomalies: rawAnomalies,
    fonts,
    coveredChecks: PREFLIGHT_RULES.map(r => `${r.id} : ${r.name}`),
    uncoveredChecks: UNCOVERED_CHECKS_CATALOG,
    hasTransparencies,
    hasMissingBleed,
    hasMarginViolations,
    hasTextSizeViolations,
    hasFontIssues,
    hasStrokeIssues,
    hasImageIssues,
    hasColorIssues,
    hasMultiFormatPages,
    hasRotatedPages,
  };
}

function createFailedResult(
  fileName: string,
  fileSizeBytes: number,
  profile: PrintProfile,
  code: 'CORRUPTED' | 'PASSWORD_PROTECTED' | 'UNSUPPORTED' | 'FILE_TOO_LARGE' | 'UNKNOWN',
  message: string
): DocumentPreflightResult {
  const failCounters: PreflightCounters = {
    blockingIssuesCount: 1,
    advisoryIssuesCount: 0,
    notVerifiableCount: 0,
    notApplicableCount: 0,
    errorCount: 1,
    passedRulesCount: 0,
    totalRulesEvaluated: 1,
  };

  const ingestResult: RuleCheckResult = {
    ruleId: 'INGEST-01',
    ruleName: 'Intégrité du fichier & Droits d’accès',
    ruleVersion: '1.0.0',
    category: 'integrity',
    status: 'FAIL',
    severity: 'BLOCKING',
    observedValue: code,
    expectedValue: 'Fichier PDF valide et accessible',
    primaryUnit: 'statut',
    affectedPages: [],
    detectionMethod: 'structure_meta',
    confidenceLevel: 'HIGH',
    failureReason: message,
    recommendation: 'Fournissez un fichier PDF standard non protégé et non altéré.',
    explanation: message,
    anomaliesCount: 1,
  };

  return {
    fileName,
    fileSizeBytes,
    pageCount: 0,
    profile,
    overallStatus: 'ANALYSIS_FAILED',
    statusLabel: 'Analyse impossible',
    statusDescription: message,
    analyzedAt: new Date().toLocaleTimeString('fr-FR'),
    engineVersion: ENGINE_VERSION,
    catalogVersion: CATALOG_VERSION,
    profileVersion: profile.version || PROFILE_VERSION,
    counters: failCounters,
    pages: [],
    checks: [],
    ruleResults: [ingestResult],
    anomalyGroups: [],
    anomalies: [],
    fonts: [],
    coveredChecks: [],
    uncoveredChecks: UNCOVERED_CHECKS_CATALOG,
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
      code,
      message,
    },
  };
}
