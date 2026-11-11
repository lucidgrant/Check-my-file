/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { GOLDEN_FIXTURES } from './fixtures/generator';
import { analyzePdfDocument, DEFAULT_PROFILES, ENGINE_VERSION, CATALOG_VERSION } from '../src/services/pdfAnalyzer';
import { generatePreflightReportPdf } from '../src/services/reportGenerator';
import { PDFDocument } from 'pdf-lib';

describe('Check MyFile — Golden Master & Preflight Test Suite', () => {
  it('Fixture 1 (InDesign_Mock): Carte de visite 100% conforme', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'indesign_compliant_card')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'business_card')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);

    expect(result.overallStatus).toBe('no_issues_detected');
    expect(result.ruleResults.length).toBe(8);

    const bleed01 = result.ruleResults.find(r => r.ruleId === 'BLEED-01');
    const bleed02 = result.ruleResults.find(r => r.ruleId === 'BLEED-02');
    const font01 = result.ruleResults.find(r => r.ruleId === 'FONT-01');
    const text01 = result.ruleResults.find(r => r.ruleId === 'TEXT-01');
    const margin01 = result.ruleResults.find(r => r.ruleId === 'MARGIN-01');

    expect(bleed01?.status).toBe('PASS');
    expect(bleed02?.status).toBe('PASS');
    expect(font01?.status).toBe('PASS');
    expect(text01?.status).toBe('PASS');
    expect(margin01?.status).toBe('PASS');
  });

  it('Fixture 2 (Canva_Mock): Flyer sans fond perdu, texte critique et police manquante', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'canva_unbleed_flyer')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'a4')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);

    expect(result.overallStatus).toBe('issues_detected');

    const bleed01 = result.ruleResults.find(r => r.ruleId === 'BLEED-01');
    const text01 = result.ruleResults.find(r => r.ruleId === 'TEXT-01');
    const margin01 = result.ruleResults.find(r => r.ruleId === 'MARGIN-01');
    const font01 = result.ruleResults.find(r => r.ruleId === 'FONT-01');

    expect(bleed01?.status).toBe('FAIL');
    expect(text01?.status).toBe('FAIL');
    expect(margin01?.status).toBe('FAIL');
    expect(font01?.status).toBe('FAIL');
  });

  it('Fixture 3 (Illustrator_Mock): Transparences actives et fond perdu partiel', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'illustrator_transparency_poster')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'a4')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);

    expect(result.overallStatus).toBe('partial_verification');

    const bleed01 = result.ruleResults.find(r => r.ruleId === 'BLEED-01');
    const transp01 = result.ruleResults.find(r => r.ruleId === 'TRANSP-01');

    expect(bleed01?.status).toBe('WARNING');
    expect(transp01?.status).toBe('WARNING');
  });

  it('Fixture 4 (Word_Mock): Document bureautique arbitraire sans TrimBox', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'word_arbitrary_unverifiable')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'a4')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);

    expect(result.overallStatus).toBe('partial_verification');

    const bleed01 = result.ruleResults.find(r => r.ruleId === 'BLEED-01');
    expect(bleed01?.status).toBe('NOT_VERIFIABLE');
  });

  it('Fixture 5 (Illustrator_Mock): Rotation de page détectée (/Rotate 90)', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'rotated_page_landscape')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'a4')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);

    expect(result.hasRotatedPages).toBe(true);
    expect(result.pages[0]?.rotationDegrees).toBe(90);
    const box01 = result.ruleResults.find(r => r.ruleId === 'BOX-01');
    expect(box01?.status).toBe('WARNING');
  });

  it('Rapport PDF : Génération complète et cohérence du versioning', async () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === 'indesign_compliant_card')!;
    const bytes = await fixture.generate();
    const profile = DEFAULT_PROFILES.find(p => p.id === 'business_card')!;

    const result = await analyzePdfDocument(bytes.buffer as ArrayBuffer, fixture.fileName, profile);
    const reportBytes = await generatePreflightReportPdf(result);

    const reportDoc = await PDFDocument.load(reportBytes);
    expect(reportDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(result.catalogVersion).toBe(CATALOG_VERSION);
  });
});
