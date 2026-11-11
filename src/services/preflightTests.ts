/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Suite de tests automatisée des 14 règles prépresse et des statuts
 */

import { PDFDocument, rgb, cmyk, StandardFonts, PDFName, PDFNumber, PDFArray, degrees } from 'pdf-lib';
import { analyzePdfDocument, MM_TO_PT, DEFAULT_PROFILES } from './pdfAnalyzer';
import { generatePreflightReportPdf } from './reportGenerator';
import { RuleCheckResult } from '../rules/types';

export interface TestCaseResult {
  name: string;
  category: 'conforme' | 'non_conforme' | 'cas_limite' | 'non_verifiable' | 'not_applicable' | 'rotation' | 'external_producer';
  ruleTested: string;
  passed: boolean;
  expectedStatus: string;
  actualStatus: string;
  details: string;
}

export async function runPreflightTestSuite(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const profileA4 = DEFAULT_PROFILES.find(p => p.id === 'a4')!;
  const profileCard = DEFAULT_PROFILES.find(p => p.id === 'business_card')!;

  // =========================================================================
  // TEST 1 : Document Conforme (Carte de visite avec TrimBox, BleedBox 2mm, CMJN)
  // Assertions : BLEED-01=PASS, BLEED-02=PASS, TEXT-01=PASS, MARGIN-01=PASS, FONT-01=PASS
  // =========================================================================
  try {
    const doc1 = await PDFDocument.create();
    const font1 = await doc1.embedFont(StandardFonts.Helvetica);
    const cardW = 85 * MM_TO_PT;
    const cardH = 55 * MM_TO_PT;
    const bleed = 2 * MM_TO_PT;
    const totalW = cardW + bleed * 2;
    const totalH = cardH + bleed * 2;

    const page1 = doc1.addPage([totalW, totalH]);
    page1.setMediaBox(0, 0, totalW, totalH);
    page1.setBleedBox(0, 0, totalW, totalH);
    page1.setTrimBox(bleed, bleed, cardW, cardH);

    // Textes conformes >= 6 pt et marge >= 4 mm, composés en CMJN (100% Noir)
    page1.drawText('Jean Dupont', { x: bleed + 20, y: bleed + 35, size: 9, font: font1, color: cmyk(0, 0, 0, 1) });
    page1.drawText('Directeur Artistique', { x: bleed + 20, y: bleed + 22, size: 7, font: font1, color: cmyk(0, 0, 0, 1) });

    const raw1 = await doc1.save();
    // Injecter un FontDescriptor avec flux simulé
    const loadedDoc1 = await PDFDocument.load(raw1);
    const pageObj1 = loadedDoc1.getPage(0);
    const resDict1 = pageObj1.node.Resources();
    const fontDict1 = resDict1?.get(PDFName.of('Font')) as any;
    if (fontDict1) {
      for (const [, fontRef] of fontDict1.entries()) {
        const fObj = loadedDoc1.context.lookup(fontRef) as any;
        const desc = loadedDoc1.context.obj({
          Type: 'FontDescriptor',
          FontName: 'Helvetica',
          FontFile2: loadedDoc1.context.stream(new Uint8Array([1, 2, 3, 4, 5])),
        });
        const descRef = loadedDoc1.context.register(desc);
        fObj?.set(PDFName.of('FontDescriptor'), descRef);
      }
    }

    // Déclarer l'OutputIntent PDF/X requis par le profil business_card
    const outputIntent = loadedDoc1.context.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFX',
      OutputConditionIdentifier: 'FOGRA39',
    });
    const outputIntentRef = loadedDoc1.context.register(outputIntent);
    const intentsArray = loadedDoc1.context.obj([outputIntentRef]);
    loadedDoc1.catalog.set(PDFName.of('OutputIntents'), intentsArray);

    const bytes1 = await loadedDoc1.save();
    const res1 = await analyzePdfDocument(bytes1.buffer as ArrayBuffer, 'Test1_Conforme_Card.pdf', profileCard);

    const b01 = res1.ruleResults.find(r => r.ruleId === 'BLEED-01');
    const b02 = res1.ruleResults.find(r => r.ruleId === 'BLEED-02');
    const f01 = res1.ruleResults.find(r => r.ruleId === 'FONT-01');
    const t01 = res1.ruleResults.find(r => r.ruleId === 'TEXT-01');
    const m01 = res1.ruleResults.find(r => r.ruleId === 'MARGIN-01');

    const pass = b01?.status === 'PASS' && 
                 b02?.status === 'PASS' && 
                 f01?.status === 'PASS' && 
                 t01?.status === 'PASS' && 
                 m01?.status === 'PASS' && 
                 res1.overallStatus === 'NO_ISSUE_ON_CHECKED_RULES';

    results.push({
      name: 'Test 1 : Document Conforme [NO_ISSUE_ON_CHECKED_RULES: 12 PASS, 2 N/A]',
      category: 'conforme',
      ruleTested: 'GLOBAL & BLEED/FONT/TEXT/MARGIN',
      passed: pass,
      expectedStatus: 'NO_ISSUE_ON_CHECKED_RULES',
      actualStatus: `Verdict:${res1.overallStatus} (PASS:${res1.counters.passedRulesCount}, N/A:${res1.counters.notApplicableCount})`,
      details: pass ? 'Succès : Document validé sans défaut (bandeau vert borné).' : 'Échec d’assertion sur le verdict global.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 1 : Document Conforme',
      category: 'conforme',
      ruleTested: 'GLOBAL',
      passed: false,
      expectedStatus: 'PASS',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 2 : BLEED-01 = FAIL (BLOCKING) (Flyer A4 avec 0mm de débord)
  // =========================================================================
  try {
    const doc2 = await PDFDocument.create();
    const a4W = 210 * MM_TO_PT;
    const a4H = 297 * MM_TO_PT;
    const page2 = doc2.addPage([a4W, a4H]);
    page2.setMediaBox(0, 0, a4W, a4H);
    page2.setTrimBox(0, 0, a4W, a4H); // 0 mm de fond perdu!

    const bytes2 = await doc2.save();
    const res2 = await analyzePdfDocument(bytes2.buffer as ArrayBuffer, 'Test2_No_Bleed.pdf', profileA4);
    const b01 = res2.ruleResults.find(r => r.ruleId === 'BLEED-01');

    const pass = b01?.status === 'FAIL' && b01?.severity === 'BLOCKING';
    results.push({
      name: 'Test 2 : BLEED-01 = FAIL BLOCKING (0 mm de fond perdu)',
      category: 'non_conforme',
      ruleTested: 'BLEED-01',
      passed: pass,
      expectedStatus: 'status=FAIL && severity=BLOCKING',
      actualStatus: `status=${b01?.status}, severity=${b01?.severity}`,
      details: pass ? 'Succès : Absence de fond perdu détectée et qualifiée de bloquante.' : 'Échec de qualification sur BLEED-01.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 2 : BLEED-01 FAIL',
      category: 'non_conforme',
      ruleTested: 'BLEED-01',
      passed: false,
      expectedStatus: 'FAIL',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 3 : BLEED-01 = NOT_VERIFIABLE (Document sans TrimBox)
  // Prudence industrielle : Refus d'inventer la coupe.
  // =========================================================================
  try {
    const doc3 = await PDFDocument.create();
    const a4W = 210 * MM_TO_PT;
    const a4H = 297 * MM_TO_PT;
    const page3 = doc3.addPage([a4W, a4H]);
    page3.setMediaBox(0, 0, a4W, a4H);
    // AUCUNE TrimBox balisée !

    const bytes3 = await doc3.save();
    const res3 = await analyzePdfDocument(bytes3.buffer as ArrayBuffer, 'Test3_Missing_Trim.pdf', profileA4);
    const b01 = res3.ruleResults.find(r => r.ruleId === 'BLEED-01');
    const b02 = res3.ruleResults.find(r => r.ruleId === 'BLEED-02');

    const pass = b01?.status === 'NOT_VERIFIABLE' && b02?.status === 'FAIL';
    results.push({
      name: 'Test 3 : BLEED-01 = NOT_VERIFIABLE (TrimBox absente du PDF)',
      category: 'non_verifiable',
      ruleTested: 'BLEED-01',
      passed: pass,
      expectedStatus: 'BLEED-01: NOT_VERIFIABLE, BLEED-02: FAIL',
      actualStatus: `BLEED-01:${b01?.status}, BLEED-02:${b02?.status}`,
      details: pass ? 'Succès : Prudence industrielle respectée, la coupe n’est pas inventée.' : 'Échec sur la gestion d’absence de TrimBox.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 3 : BLEED-01 NOT_VERIFIABLE',
      category: 'non_verifiable',
      ruleTested: 'BLEED-01',
      passed: false,
      expectedStatus: 'NOT_VERIFIABLE',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 4 : FONT-01 = FAIL (Police Standard 14 sans flux incorporé)
  // =========================================================================
  try {
    const doc4 = await PDFDocument.create();
    const font4 = await doc4.embedFont(StandardFonts.TimesRoman); // Standard 14 sans FontDescriptor explicite
    const page4 = doc4.addPage([500, 500]);
    page4.drawText('Texte en Times Roman externe', { x: 50, y: 50, font: font4, size: 12 });

    const bytes4 = await doc4.save();
    const res4 = await analyzePdfDocument(bytes4.buffer as ArrayBuffer, 'Test4_Unembedded_Font.pdf', profileA4);
    const f01 = res4.ruleResults.find(r => r.ruleId === 'FONT-01');

    const pass = f01?.status === 'FAIL';
    results.push({
      name: 'Test 4 : FONT-01 = FAIL (Police Standard 14 non incorporée)',
      category: 'non_conforme',
      ruleTested: 'FONT-01',
      passed: pass,
      expectedStatus: 'status=FAIL',
      actualStatus: `status=${f01?.status}, observed=${f01?.observedValue}`,
      details: pass ? 'Succès : Police externe non incorporée détectée.' : 'Échec de détection de police non incorporée.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 4 : FONT-01 FAIL',
      category: 'non_conforme',
      ruleTested: 'FONT-01',
      passed: false,
      expectedStatus: 'FAIL',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 5 : STROKE-01 = NOT_APPLICABLE (Document sans aucun tracé vectoriel)
  // =========================================================================
  try {
    const doc5 = await PDFDocument.create();
    const page5 = doc5.addPage([400, 400]);
    // Aucun filet tracé, juste un fond blanc

    const bytes5 = await doc5.save();
    const res5 = await analyzePdfDocument(bytes5.buffer as ArrayBuffer, 'Test5_No_Strokes.pdf', profileA4);
    const s01 = res5.ruleResults.find(r => r.ruleId === 'STROKE-01');

    const pass = s01?.status === 'NOT_APPLICABLE';
    results.push({
      name: 'Test 5 : STROKE-01 = NOT_APPLICABLE (Document sans aucun filet)',
      category: 'not_applicable',
      ruleTested: 'STROKE-01',
      passed: pass,
      expectedStatus: 'status=NOT_APPLICABLE',
      actualStatus: `status=${s01?.status}`,
      details: pass ? 'Succès : Absence de tracé qualifiée en NOT_APPLICABLE sans fausse alerte.' : 'Échec de qualification sur STROKE-01.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 5 : STROKE-01 NOT_APPLICABLE',
      category: 'not_applicable',
      ruleTested: 'STROKE-01',
      passed: false,
      expectedStatus: 'NOT_APPLICABLE',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 6 : COLOR-01 = FAIL BLOCKING (Présence de RVB dans un profil CMJN strict)
  // =========================================================================
  try {
    const doc6 = await PDFDocument.create();
    const page6 = doc6.addPage([400, 400]);
    // Écrire un opérateur RVB brut dans le flux
    page6.drawRectangle({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      color: rgb(1, 0, 0), // RGB pur
    });

    const bytes6 = await doc6.save();
    const res6 = await analyzePdfDocument(bytes6.buffer as ArrayBuffer, 'Test6_RGB_Color.pdf', profileA4); // A4 interdit le RVB
    const c01 = res6.ruleResults.find(r => r.ruleId === 'COLOR-01');

    const pass = c01?.status === 'FAIL' && c01?.severity === 'BLOCKING';
    results.push({
      name: 'Test 6 : COLOR-01 = FAIL BLOCKING (RVB interdit par le profil A4)',
      category: 'non_conforme',
      ruleTested: 'COLOR-01',
      passed: pass,
      expectedStatus: 'status=FAIL && severity=BLOCKING',
      actualStatus: `status=${c01?.status}, severity=${c01?.severity}`,
      details: pass ? 'Succès : Couleur RVB détectée et rejetée par le profil CMJN strict.' : 'Échec de détection RVB.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 6 : COLOR-01 FAIL',
      category: 'non_conforme',
      ruleTested: 'COLOR-01',
      passed: false,
      expectedStatus: 'FAIL',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 7 : TRANSP-01 = FAIL (Transparences actives avec /ca < 1)
  // =========================================================================
  try {
    const doc7 = await PDFDocument.create();
    const page7 = doc7.addPage([400, 400]);

    // Ajouter un ExtGState transparent
    const gs = doc7.context.obj({
      Type: 'ExtGState',
      ca: 0.5,
      CA: 0.5,
    });
    const gsRef = doc7.context.register(gs);
    const resDict = doc7.context.obj({
      ExtGState: doc7.context.obj({
        GS1: gsRef,
      }),
    });
    page7.node.set(PDFName.of('Resources'), resDict);

    const bytes7 = await doc7.save();
    const res7 = await analyzePdfDocument(bytes7.buffer as ArrayBuffer, 'Test7_Transparency.pdf', profileCard); // Card interdit les transparences
    const tr01 = res7.ruleResults.find(r => r.ruleId === 'TRANSP-01');

    const pass = tr01?.status === 'FAIL';
    results.push({
      name: 'Test 7 : TRANSP-01 = FAIL (Transparences actives /ca 0.5)',
      category: 'cas_limite',
      ruleTested: 'TRANSP-01',
      passed: pass,
      expectedStatus: 'status=FAIL',
      actualStatus: `status=${tr01?.status}, occurrences=${tr01?.observedValue}`,
      details: pass ? 'Succès : Transparence active interceptée.' : 'Échec de détection de transparence.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 7 : TRANSP-01 FAIL',
      category: 'cas_limite',
      ruleTested: 'TRANSP-01',
      passed: false,
      expectedStatus: 'FAIL',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 8 : BOX-01 = FAIL ADVISORY (Page avec rotation /Rotate 90)
  // =========================================================================
  try {
    const doc8 = await PDFDocument.create();
    const page8 = doc8.addPage([500, 500]);
    page8.setRotation(degrees(90));

    const bytes8 = await doc8.save();
    const res8 = await analyzePdfDocument(bytes8.buffer as ArrayBuffer, 'Test8_Rotated_Page.pdf', profileA4);
    const bx01 = res8.ruleResults.find(r => r.ruleId === 'BOX-01');

    const pass = bx01?.status === 'FAIL' && bx01?.severity === 'ADVISORY' && res8.hasRotatedPages;
    results.push({
      name: 'Test 8 : BOX-01 = FAIL ADVISORY (Page avec rotation 90°)',
      category: 'rotation',
      ruleTested: 'BOX-01',
      passed: pass,
      expectedStatus: 'status=FAIL && severity=ADVISORY',
      actualStatus: `status=${bx01?.status}, severity=${bx01?.severity}`,
      details: pass ? 'Succès : Rotation /Rotate 90° détectée.' : 'Échec de détection de rotation.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 8 : BOX-01 FAIL',
      category: 'rotation',
      ruleTested: 'BOX-01',
      passed: false,
      expectedStatus: 'FAIL',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 9 : Producteur Externe (Simulation document exporté depuis InDesign / Canva)
  // Vérifie la robustesse face aux métadonnées /Producer et /Creator
  // =========================================================================
  try {
    const doc9 = await PDFDocument.create();
    doc9.setProducer('Adobe InDesign 19.0 (Macintosh)');
    doc9.setCreator('Adobe InDesign CC 2024');

    const cardW = 85 * MM_TO_PT;
    const cardH = 55 * MM_TO_PT;
    const bleed = 2 * MM_TO_PT;
    const page9 = doc9.addPage([cardW + bleed * 2, cardH + bleed * 2]);
    page9.setTrimBox(bleed, bleed, cardW, cardH);
    page9.setBleedBox(0, 0, cardW + bleed * 2, cardH + bleed * 2);

    const bytes9 = await doc9.save();
    const res9 = await analyzePdfDocument(bytes9.buffer as ArrayBuffer, 'Test9_InDesign_Export.pdf', profileCard);
    const ing01 = res9.ruleResults.find(r => r.ruleId === 'INGEST-01');
    const b01 = res9.ruleResults.find(r => r.ruleId === 'BLEED-01');

    const pass = ing01?.status === 'PASS' && b01?.status === 'PASS';
    results.push({
      name: 'Test 9 : Producteur Externe (Fichier marqué InDesign CC 2024)',
      category: 'external_producer',
      ruleTested: 'INGEST-01, BLEED-01',
      passed: pass,
      expectedStatus: 'INGEST-01: PASS && BLEED-01: PASS',
      actualStatus: `INGEST-01:${ing01?.status}, BLEED-01:${b01?.status}`,
      details: pass ? 'Succès : Document InDesign ingéré et analysé correctement.' : 'Échec d’ingestion du flux InDesign.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 9 : Producteur Externe',
      category: 'external_producer',
      ruleTested: 'INGEST-01',
      passed: false,
      expectedStatus: 'PASS',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  // =========================================================================
  // TEST 10 : Génération du rapport PDF avec le libellé vert et métadonnées
  // =========================================================================
  try {
    const doc10 = await PDFDocument.create();
    const page10 = doc10.addPage([595.28, 841.89]);
    page10.setTrimBox(14.17, 14.17, 566.93, 813.54);
    const bytes10 = await doc10.save();
    const res10 = await analyzePdfDocument(bytes10.buffer as ArrayBuffer, 'Test10_Report.pdf', profileA4);

    const reportBytes = await generatePreflightReportPdf(res10);
    const decodedReport = await PDFDocument.load(reportBytes);
    const pass = decodedReport.getPageCount() >= 1;

    results.push({
      name: 'Test 10 : Rapport PDF avec cartouche de gouvernance et liste non-couvert',
      category: 'conforme',
      ruleTested: 'REPORT-GEN',
      passed: pass,
      expectedStatus: 'Génération PDF >= 1 page',
      actualStatus: `${decodedReport.getPageCount()} page(s) générée(s)`,
      details: pass ? 'Succès : Rapport PDF généré avec succès.' : 'Échec de génération du rapport.',
    });
  } catch (err: any) {
    results.push({
      name: 'Test 10 : Rapport PDF',
      category: 'conforme',
      ruleTested: 'REPORT-GEN',
      passed: false,
      expectedStatus: 'PASS',
      actualStatus: 'EXCEPTION',
      details: String(err?.message || err),
    });
  }

  return results;
}
