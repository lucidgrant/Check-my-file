/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Générateur de rapport de contrôle qualité prépresse
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DocumentPreflightResult } from '../types/preflight';
import { UNCOVERED_CHECKS_CATALOG } from '../rules/catalog';
import { FixAuditLog } from '../fixers/types';

function cleanWinAnsi(str: string): string {
  if (!str) return '';
  return str
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[«»]/g, '"')
    .replace(/[’‘]/g, "'");
}

export async function generatePreflightReportPdf(
  result: DocumentPreflightResult,
  auditLog?: FixAuditLog | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Color constants
  const cDark = rgb(0.06, 0.09, 0.16);
  const cCard = rgb(0.97, 0.98, 0.99);
  const cBorder = rgb(0.85, 0.88, 0.92);
  const cText = rgb(0.12, 0.16, 0.24);
  const cMuted = rgb(0.45, 0.5, 0.58);
  const cSuccess = rgb(0.09, 0.64, 0.29);
  const cWarning = rgb(0.85, 0.47, 0.02);
  const cError = rgb(0.86, 0.15, 0.15);
  const cSky = rgb(0.12, 0.53, 0.89);
  const cGray = rgb(0.4, 0.45, 0.52);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1),
  });

  // Top header bar
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: cDark,
  });

  // Title & Brand
  page.drawText('CHECK MYFILE', {
    x: 40,
    y: height - 42,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    `RAPPORT DE CONTRÔLE PRÉPRESSE | Moteur v${result.engineVersion || '2.2.0'} - Catalogue v${result.catalogVersion || '2.2.0'} - Profil v${result.profileVersion || '2.0.0'}`,
    {
      x: 40,
      y: height - 60,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.55, 0.75, 0.95),
    }
  );

  // Date and file meta top right
  page.drawText(`Date : ${new Date().toLocaleDateString('fr-FR')} à ${result.analyzedAt}`, {
    x: width - 230,
    y: height - 42,
    size: 8,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText(`Fichier : ${result.fileName.slice(0, 30)}`, {
    x: width - 230,
    y: height - 58,
    size: 8,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.9),
  });

  let currentY = height - 105;

  // VERDICT BANNER (Hiérarchie stricte des 5 statuts)
  let verdictColor = cSuccess;
  let verdictTitle = 'AUCUN PROBLÈME DÉTECTÉ SUR LES CONTRÔLES EFFECTUÉS';

  if (result.overallStatus === 'PROBLEMS_DETECTED' || (result.overallStatus as any) === 'issues_detected') {
    verdictColor = cError;
    verdictTitle = 'PROBLÈMES DÉTECTÉS — INTERVENTION REQUISE';
  } else if (result.overallStatus === 'ATTENTION_REQUIRED' || (result.overallStatus as any) === 'attention_required') {
    verdictColor = cWarning;
    verdictTitle = 'POINTS D’ATTENTION D’ATELIER';
  } else if (result.overallStatus === 'PARTIAL_VERIFICATION' || (result.overallStatus as any) === 'partial_verification') {
    verdictColor = cSky;
    verdictTitle = 'VÉRIFICATION PARTIELLE — ÉLÉMENTS NON ATTESTABLES';
  } else if (result.overallStatus === 'ANALYSIS_FAILED' || (result.overallStatus as any) === 'analysis_failed') {
    verdictColor = cGray;
    verdictTitle = 'ANALYSE IMPOSSIBLE';
  }

  page.drawRectangle({
    x: 40,
    y: currentY - 45,
    width: width - 80,
    height: 45,
    color: cCard,
    borderColor: cBorder,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: 40,
    y: currentY - 45,
    width: 6,
    height: 45,
    color: verdictColor,
  });

  page.drawText(cleanWinAnsi(`VERDICT : ${verdictTitle}`), {
    x: 58,
    y: currentY - 22,
    size: 9.5,
    font: fontBold,
    color: verdictColor,
  });

  page.drawText(cleanWinAnsi(result.statusDescription.slice(0, 115)), {
    x: 58,
    y: currentY - 37,
    size: 7.5,
    font: fontRegular,
    color: cMuted,
  });

  currentY -= 65;

  // DOCUMENT SUMMARY STRIP
  page.drawRectangle({
    x: 40,
    y: currentY - 40,
    width: width - 80,
    height: 40,
    color: cCard,
    borderColor: cBorder,
    borderWidth: 1,
  });

  const fileSizeKb = (result.fileSizeBytes / 1024).toFixed(1);
  const firstPage = result.pages[0];

  const colWidth = (width - 80) / 4;
  const metaCols = [
    { label: 'PROFIL CIBLE', val: result.profile.name.slice(0, 22) },
    { label: 'PAGES / POIDS', val: `${result.pageCount} page(s) | ${fileSizeKb} Ko` },
    {
      label: 'DIMENSIONS FEUILLE',
      val: firstPage ? `${firstPage.mediaBox.widthMm} x ${firstPage.mediaBox.heightMm} mm` : 'Non mesurable',
    },
    {
      label: 'LIGNE DE COUPE (TRIM)',
      val: firstPage?.hasExplicitTrimBox
        ? `${firstPage.trimBox!.widthMm} x ${firstPage.trimBox!.heightMm} mm`
        : 'Absente du PDF',
    },
  ];

  metaCols.forEach((col, idx) => {
    const colX = 50 + idx * colWidth;
    page.drawText(col.label, {
      x: colX,
      y: currentY - 16,
      size: 6.5,
      font: fontBold,
      color: cMuted,
    });
    page.drawText(cleanWinAnsi(col.val), {
      x: colX,
      y: currentY - 29,
      size: 7.5,
      font: fontRegular,
      color: cText,
    });
  });

  currentY -= 55;

  // PREFLIGHT DETAILED TABLE
  page.drawText('TABLEAU DES CONTRÔLES MÉTIER', {
    x: 40,
    y: currentY,
    size: 10,
    font: fontBold,
    color: cText,
  });

  currentY -= 15;

  // Table header
  page.drawRectangle({
    x: 40,
    y: currentY - 18,
    width: width - 80,
    height: 18,
    color: cDark,
  });

  page.drawText('RÈGLE', { x: 50, y: currentY - 13, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('CONTRÔLE', { x: 120, y: currentY - 13, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('STATUT', { x: 235, y: currentY - 13, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('VALEUR OBSERVÉE', { x: 315, y: currentY - 13, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('EXIGENCE PROFIL', { x: 445, y: currentY - 13, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });

  currentY -= 18;

  // Table rows
  result.checks.forEach((item, index) => {
    const rowHeight = 20;
    const isEven = index % 2 === 0;

    if (isEven) {
      page.drawRectangle({
        x: 40,
        y: currentY - rowHeight,
        width: width - 80,
        height: rowHeight,
        color: rgb(0.98, 0.99, 1),
      });
    }

    // Border bottom
    page.drawRectangle({
      x: 40,
      y: currentY - rowHeight,
      width: width - 80,
      height: 0.5,
      color: cBorder,
    });

    const isPass = item.status === 'success';
    const isError = item.status === 'error';
    const isWarning = item.status === 'warning';
    const statusText = isPass ? 'CONFORME' : isError ? 'NON CONFORME' : isWarning ? 'VIGILANCE' : 'NON VÉRIFIABLE';
    const statusColor = isPass ? cSuccess : isError ? cError : isWarning ? cWarning : cGray;

    page.drawText(item.ruleId || `R-${index + 1}`, {
      x: 50,
      y: currentY - 14,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.45, 0.7),
    });

    page.drawText(cleanWinAnsi(item.title).slice(0, 22), {
      x: 120,
      y: currentY - 14,
      size: 7.5,
      font: fontRegular,
      color: cText,
    });

    page.drawText(statusText, {
      x: 235,
      y: currentY - 14,
      size: 7,
      font: fontBold,
      color: statusColor,
    });

    page.drawText(cleanWinAnsi(item.detectedSummary).slice(0, 24), {
      x: 315,
      y: currentY - 14,
      size: 7,
      font: fontRegular,
      color: cMuted,
    });

    page.drawText(cleanWinAnsi(item.expectedSummary).slice(0, 24), {
      x: 445,
      y: currentY - 14,
      size: 7,
      font: fontRegular,
      color: cMuted,
    });

    currentY -= rowHeight;
  });

  currentY -= 20;

  // NON COUVERT SECTION (Toujours visible et explicitement mentionnée)
  page.drawText('PÉRIMÈTRE TECHNIQUE NON COUVERT DANS CETTE VERSION', {
    x: 40,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: cText,
  });

  currentY -= 12;

  UNCOVERED_CHECKS_CATALOG.slice(0, 4).forEach((uncov) => {
    page.drawText(`- ${cleanWinAnsi(uncov)}`, {
      x: 45,
      y: currentY,
      size: 6.5,
      font: fontRegular,
      color: cMuted,
    });
  // SI UN JOURNAL D'AUDIT DE CORRECTION EST PRÉSENT : AJOUT DE LA PAGE DE TRAÇABILITÉ
  if (auditLog && auditLog.appliedFixers.length > 0) {
    const page2 = doc.addPage([595.28, 841.89]);
    const { width: p2W, height: p2H } = page2.getSize();

    // Top bar
    page2.drawRectangle({
      x: 0,
      y: p2H - 70,
      width: p2W,
      height: 70,
      color: cDark,
    });

    page2.drawText('CHECK MYFILE — TRAÇABILITÉ DES CORRECTIONS APPLIQUÉES', {
      x: 40,
      y: p2H - 35,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page2.drawText(`Identifiant d’audit : ${cleanWinAnsi(auditLog.auditId)} · Date : ${cleanWinAnsi(auditLog.timestampIso)}`, {
      x: 40,
      y: p2H - 52,
      size: 8,
      font: fontRegular,
      color: rgb(0.65, 0.72, 0.85),
    });

    let p2Y = p2H - 95;

    // Cartouche des empreintes SHA-256
    page2.drawRectangle({
      x: 40,
      y: p2Y - 45,
      width: p2W - 80,
      height: 45,
      color: cCard,
      borderColor: cBorder,
      borderWidth: 1,
    });

    page2.drawText('EMPREINTES CRYPTOGRAPHIQUES (SHA-256) :', {
      x: 50,
      y: p2Y - 14,
      size: 8,
      font: fontBold,
      color: cText,
    });

    page2.drawText(`Fichier original : ${auditLog.originalSha256}`, {
      x: 50,
      y: p2Y - 26,
      size: 7,
      font: fontRegular,
      color: cMuted,
    });

    page2.drawText(`Copie corrigée  : ${auditLog.correctedSha256}`, {
      x: 50,
      y: p2Y - 37,
      size: 7,
      font: fontBold,
      color: cSuccess,
    });

    p2Y -= 65;

    // Liste des correcteurs exécutés
    page2.drawText('CORRECTEURS EXÉCUTÉS & OUTILS ÉPINGLÉS :', {
      x: 40,
      y: p2Y,
      size: 9,
      font: fontBold,
      color: cText,
    });

    p2Y -= 15;

    auditLog.appliedFixers.forEach((fixer) => {
      const toolsStr = Object.entries(fixer.toolsUsed).map(([t, v]) => `${t} v${v}`).join(', ');
      page2.drawText(`- [${fixer.fixerId}] ${cleanWinAnsi(fixer.fixerName)} (v${fixer.version}, Niveau ${fixer.riskLevel})`, {
        x: 45,
        y: p2Y,
        size: 8,
        font: fontBold,
        color: cText,
      });
      p2Y -= 10;
      page2.drawText(`  Outils : ${toolsStr} · Modifications effectives : ${fixer.changes.length}`, {
        x: 45,
        y: p2Y,
        size: 7,
        font: fontRegular,
        color: cMuted,
      });
      p2Y -= 14;
    });

    p2Y -= 10;

    // Tableau des changements détaillés
    page2.drawText('JOURNAL DÉTAILLÉ DES MODIFICATIONS :', {
      x: 40,
      y: p2Y,
      size: 9,
      font: fontBold,
      color: cText,
    });

    p2Y -= 16;

    // Header tableau
    page2.drawRectangle({
      x: 40,
      y: p2Y - 14,
      width: p2W - 80,
      height: 16,
      color: rgb(0.92, 0.94, 0.97),
    });

    page2.drawText('PAGE', { x: 45, y: p2Y - 10, size: 7, font: fontBold, color: cText });
    page2.drawText('ÉLÉMENT MODIFIÉ', { x: 80, y: p2Y - 10, size: 7, font: fontBold, color: cText });
    page2.drawText('AVANT CORRECTION', { x: 260, y: p2Y - 10, size: 7, font: fontBold, color: cText });
    page2.drawText('APRÈS CORRECTION', { x: 400, y: p2Y - 10, size: 7, font: fontBold, color: cText });

    p2Y -= 18;

    const allChanges = auditLog.appliedFixers.flatMap(f => f.changes).slice(0, 18);
    allChanges.forEach((ch) => {
      page2.drawText(ch.pageNumber ? `P.${ch.pageNumber}` : 'Doc', {
        x: 45,
        y: p2Y,
        size: 7,
        font: fontRegular,
        color: cMuted,
      });

      page2.drawText(cleanWinAnsi(ch.itemDescription).slice(0, 32), {
        x: 80,
        y: p2Y,
        size: 7,
        font: fontRegular,
        color: cText,
      });

      page2.drawText(cleanWinAnsi(ch.beforeValue).slice(0, 24), {
        x: 260,
        y: p2Y,
        size: 7,
        font: fontRegular,
        color: rgb(0.7, 0.3, 0.3),
      });

      page2.drawText(cleanWinAnsi(ch.afterValue).slice(0, 24), {
        x: 400,
        y: p2Y,
        size: 7,
        font: fontBold,
        color: cSuccess,
      });

      p2Y -= 12;
    });

    // Mention d'atelier
    page2.drawText("Mention : Convention d'atelier, à valider par un imprimeur.", {
      x: 40,
      y: 35,
      size: 7,
      font: fontRegular,
      color: cMuted,
    });
  }

  return await doc.save();
}
