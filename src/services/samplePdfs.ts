import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { MM_TO_PT } from './pdfAnalyzer';

export interface SamplePdfDefinition {
  id: string;
  name: string;
  description: string;
  expectedVerdict: 'to_fix' | 'ready' | 'to_verify';
  profileId: string;
  generate: () => Promise<{ buffer: ArrayBuffer; fileName: string }>;
}

export const SAMPLE_PDFS: SamplePdfDefinition[] = [
  {
    id: 'flyer_with_errors',
    name: 'Flyer A4 — Anomalies critiques (Massicot & Fond perdu)',
    description: 'Document 210×297 mm sans fond perdu (0 mm), mentions à 5.5 pt et texte à 2.5 mm du bord de coupe.',
    expectedVerdict: 'to_fix',
    profileId: 'a4',
    generate: async () => {
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Exact A4 dimensions in pt: 595.28 x 841.89 (NO BLEED = 0 mm!)
      const width = 210 * MM_TO_PT;
      const height = 297 * MM_TO_PT;
      const page = pdfDoc.addPage([width, height]);

      // Background color
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.96, 0.97, 0.99),
      });

      // Top colored banner
      page.drawRectangle({
        x: 0,
        y: height - 120,
        width,
        height: 120,
        color: rgb(0.12, 0.23, 0.45),
      });

      page.drawText('GRAND FESTIVAL DE PRINTEMPS', {
        x: 40,
        y: height - 70,
        size: 22,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('Concert, animations & restauration sur place', {
        x: 40,
        y: height - 95,
        size: 11,
        font: helvetica,
        color: rgb(0.85, 0.9, 1),
      });

      // Content text
      page.drawText('Samedi 24 Mai — Entrée libre pour tous', {
        x: 40,
        y: height - 170,
        size: 15,
        font: helveticaBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText('Venez nombreux célébrer le retour des beaux jours avec plus de 30 artistes et artisans locaux.', {
        x: 40,
        y: height - 200,
        size: 10,
        font: helvetica,
        color: rgb(0.3, 0.35, 0.45),
      });

      // ANOMALY 1: Critical safety margin violation! Text at x = 7 pt (2.5 mm from left border)
      // Cut line is at x = 0, so 7 pt is ~2.46 mm < 10 mm required and < 3 mm critical
      page.drawText('Contact réservations : 01 42 68 00 00 — info@printemps-fest.fr', {
        x: 7, // 2.46 mm from left cut line!
        y: 120,
        size: 9,
        font: helveticaBold,
        color: rgb(0.85, 0.15, 0.15),
      });

      // ANOMALY 2: Text size violation! Text at 5.5 pt (< 8 pt required min)
      page.drawText('Mentions légales : Association loi 1901 N° W751204892. L’abus d’alcool est dangereux pour la santé, à consommer avec modération. Ne pas jeter sur la voie publique.', {
        x: 40,
        y: 40,
        size: 5.5, // 5.5 pt text!
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });

      const bytes = await pdfDoc.save();
      return {
        buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        fileName: 'Flyer_A4_Anomalies_Impression.pdf',
      };
    },
  },
  {
    id: 'compliant_business_card',
    name: 'Carte de Visite — 100% Conforme (Prêt à imprimer)',
    description: 'Format 85×55 mm avec 3 mm de fond perdu tout autour, marges de sécurité 5 mm et textes ≥ 8 pt.',
    expectedVerdict: 'ready',
    profileId: 'business_card',
    generate: async () => {
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const bleedMm = 3;
      const cardWidthMm = 85;
      const cardHeightMm = 55;

      const totalWidthPt = (cardWidthMm + bleedMm * 2) * MM_TO_PT;
      const totalHeightPt = (cardHeightMm + bleedMm * 2) * MM_TO_PT;
      const bleedPt = bleedMm * MM_TO_PT;

      const page = pdfDoc.addPage([totalWidthPt, totalHeightPt]);

      // Set explicit MediaBox, TrimBox, and BleedBox
      page.setMediaBox(0, 0, totalWidthPt, totalHeightPt);
      page.setBleedBox(0, 0, totalWidthPt, totalHeightPt);
      page.setTrimBox(bleedPt, bleedPt, cardWidthMm * MM_TO_PT, cardHeightMm * MM_TO_PT);

      // Background fills the entire bleed area
      page.drawRectangle({
        x: 0,
        y: 0,
        width: totalWidthPt,
        height: totalHeightPt,
        color: rgb(0.08, 0.12, 0.2),
      });

      // Accent gold strip extending through bleed
      page.drawRectangle({
        x: 0,
        y: totalHeightPt - bleedPt - 12,
        width: totalWidthPt,
        height: 4,
        color: rgb(0.9, 0.72, 0.3),
      });

      // Inside safe area (well away from trim edges)
      const safeLeft = bleedPt + (6 * MM_TO_PT); // 6 mm inside trim
      const safeBottom = bleedPt + (8 * MM_TO_PT);

      page.drawText('ALEXANDRE DUPONT', {
        x: safeLeft,
        y: safeBottom + 65,
        size: 13,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('Directeur de Production Graphique', {
        x: safeLeft,
        y: safeBottom + 48,
        size: 8.5,
        font: helvetica,
        color: rgb(0.8, 0.85, 0.9),
      });

      page.drawText('+33 6 12 34 56 78 · a.dupont@atelier-print.fr', {
        x: safeLeft,
        y: safeBottom + 26,
        size: 8,
        font: helvetica,
        color: rgb(0.65, 0.7, 0.8),
      });

      page.drawText('24 Rue de l’Imprimerie — 75011 Paris', {
        x: safeLeft,
        y: safeBottom + 10,
        size: 8,
        font: helvetica,
        color: rgb(0.65, 0.7, 0.8),
      });

      const bytes = await pdfDoc.save();
      return {
        buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        fileName: 'Carte_Visite_85x55_Conforme.pdf',
      };
    },
  },
  {
    id: 'poster_with_transparency',
    name: 'Affiche A4 — Transparences actives & Fond perdu partiel',
    description: 'Document A4 avec 2 mm de débord (au lieu de 5 mm), éléments avec opacité réduite (alpha blend) et texte 7.5 pt.',
    expectedVerdict: 'to_verify',
    profileId: 'a4',
    generate: async () => {
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // A4 + 2mm bleed = 214 x 301 mm
      const totalWidthPt = 214 * MM_TO_PT;
      const totalHeightPt = 301 * MM_TO_PT;
      const bleedPt = 2 * MM_TO_PT;

      const page = pdfDoc.addPage([totalWidthPt, totalHeightPt]);
      page.setTrimBox(bleedPt, bleedPt, 210 * MM_TO_PT, 297 * MM_TO_PT);

      page.drawRectangle({
        x: 0,
        y: 0,
        width: totalWidthPt,
        height: totalHeightPt,
        color: rgb(0.1, 0.1, 0.15),
      });

      // Transparency layer using opacity
      page.drawRectangle({
        x: bleedPt + 20,
        y: totalHeightPt - bleedPt - 160,
        width: 210 * MM_TO_PT - 40,
        height: 120,
        color: rgb(0.2, 0.6, 0.9),
        opacity: 0.65, // Active transparency!
      });

      page.drawText('EXPOSITION DESIGN & ARCHITECTURE', {
        x: bleedPt + 35,
        y: totalHeightPt - bleedPt - 100,
        size: 16,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      // Text size 7.5 pt
      page.drawText('Entrée payante sur billetterie en ligne · Tarif réduit pour les étudiants et demandeurs d’emploi.', {
        x: bleedPt + 35,
        y: totalHeightPt - bleedPt - 220,
        size: 7.5, // 7.5 pt (< 8 pt warning)
        font: helvetica,
        color: rgb(0.8, 0.8, 0.8),
      });

      const bytes = await pdfDoc.save();
      return {
        buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        fileName: 'Affiche_A4_Transparences_Actives.pdf',
      };
    },
  },
];
