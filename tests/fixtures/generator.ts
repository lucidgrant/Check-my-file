/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts, PDFName, degrees } from 'pdf-lib';
import { MM_TO_PT } from '../../src/services/pdfAnalyzer';

export interface FixtureSpec {
  id: string;
  fileName: string;
  description: string;
  producer: 'InDesign_Mock' | 'Canva_Mock' | 'Word_Mock' | 'Illustrator_Mock';
  expectedStatus: 'no_issues_detected' | 'issues_detected' | 'partial_verification';
  generate: () => Promise<Uint8Array>;
}

export const GOLDEN_FIXTURES: FixtureSpec[] = [
  // 1. InDesign-like compliant business card with explicit TrimBox, BleedBox, embedded font
  {
    id: 'indesign_compliant_card',
    fileName: 'ID_Card_85x55_Compliant.pdf',
    description: 'Carte de visite professionnelle générée selon le standard InDesign avec TrimBox et BleedBox à 3mm, sous-ensemble de police incorporé.',
    producer: 'InDesign_Mock',
    expectedStatus: 'no_issues_detected',
    generate: async () => {
      const doc = await PDFDocument.create();
      doc.setProducer('Adobe InDesign 19.0 (Macintosh)');
      doc.setCreator('Adobe InDesign 19.0');
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const cardW = 85 * MM_TO_PT;
      const cardH = 55 * MM_TO_PT;
      const bleed = 3 * MM_TO_PT;
      const totalW = cardW + bleed * 2;
      const totalH = cardH + bleed * 2;

      const page = doc.addPage([totalW, totalH]);
      page.setMediaBox(0, 0, totalW, totalH);
      page.setBleedBox(0, 0, totalW, totalH);
      page.setTrimBox(bleed, bleed, cardW, cardH);

      // Fond étendu au fond perdu
      page.drawRectangle({ x: 0, y: 0, width: totalW, height: totalH, color: rgb(0.1, 0.15, 0.25) });

      // Textes dans la zone tranquille (>= 3mm)
      page.drawText('Sophie Valérie', { x: bleed + 20, y: bleed + 35, size: 9, font });
      page.drawText('Directrice Artistique', { x: bleed + 20, y: bleed + 22, size: 7, font });

      const rawBytes = await doc.save();
      const loaded = await PDFDocument.load(rawBytes);
      const res = loaded.getPage(0).node.Resources();
      const fontDict = res?.get(PDFName.of('Font')) as any;
      if (fontDict) {
        for (const [, fontRef] of fontDict.entries()) {
          const fObj = loaded.context.lookup(fontRef) as any;
          fObj?.set(PDFName.of('BaseFont'), PDFName.of('ABCDEF+Helvetica'));
        }
      }
      return loaded.save();
    },
  },

  // 2. Canva-like flyer with NO bleed (TrimBox = MediaBox), small text, missing font file
  {
    id: 'canva_unbleed_flyer',
    fileName: 'Canva_Flyer_NoBleed.pdf',
    description: 'Flyer A4 typique Canva exporté sans débord, texte 5pt plaqué au bord et police externe non incorporée.',
    producer: 'Canva_Mock',
    expectedStatus: 'issues_detected',
    generate: async () => {
      const doc = await PDFDocument.create();
      doc.setProducer('Canva (PDF export engine)');
      doc.setCreator('Canva.com');
      const font = await doc.embedFont(StandardFonts.TimesRoman);
      const w = 210 * MM_TO_PT;
      const h = 297 * MM_TO_PT;

      const page = doc.addPage([w, h]);
      page.setMediaBox(0, 0, w, h);
      page.setTrimBox(0, 0, w, h); // 0 mm bleed

      page.drawText('Offre promotionnelle exclusive', { x: 4, y: 150, size: 9, font }); // 1.4mm from cut
      page.drawText('Conditions générales d’utilisation disponibles sur internet', { x: 30, y: 50, size: 5, font }); // 5 pt text

      const rawBytes = await doc.save();
      const loaded = await PDFDocument.load(rawBytes);
      const res = loaded.getPage(0).node.Resources();
      const fontDict = res?.get(PDFName.of('Font')) as any;
      if (fontDict) {
        for (const [, fontRef] of fontDict.entries()) {
          const fObj = loaded.context.lookup(fontRef) as any;
          const descDict = loaded.context.obj({
            Type: 'FontDescriptor',
            FontName: 'Times-Roman',
          });
          const descRef = loaded.context.register(descDict);
          fObj?.set(PDFName.of('FontDescriptor'), descRef);
        }
      }
      return loaded.save();
    },
  },

  // 3. Illustrator-like poster with opacity blend / transparency & partial bleed (2mm)
  {
    id: 'illustrator_transparency_poster',
    fileName: 'Illustrator_Poster_Transparency.pdf',
    description: 'Affiche A4 avec transparences actives (/ExtGState) et fond perdu partiel de 2mm (au lieu de 5mm requis).',
    producer: 'Illustrator_Mock',
    expectedStatus: 'partial_verification',
    generate: async () => {
      const doc = await PDFDocument.create();
      doc.setProducer('Adobe Illustrator 28.0 (Windows)');
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const w = 210 * MM_TO_PT;
      const h = 297 * MM_TO_PT;
      const partialBleed = 2 * MM_TO_PT;
      const totalW = w + partialBleed * 2;
      const totalH = h + partialBleed * 2;

      const page = doc.addPage([totalW, totalH]);
      page.setMediaBox(0, 0, totalW, totalH);
      page.setBleedBox(0, 0, totalW, totalH);
      page.setTrimBox(partialBleed, partialBleed, w, h);

      page.drawRectangle({
        x: partialBleed + 30,
        y: partialBleed + 100,
        width: 200,
        height: 50,
        color: rgb(0.2, 0.4, 0.8),
        opacity: 0.65, // Active transparency
      });

      page.drawText('Exposition Internationale', { x: partialBleed + 40, y: partialBleed + 200, size: 12, font });

      const rawBytes = await doc.save();
      const loaded = await PDFDocument.load(rawBytes);
      const res = loaded.getPage(0).node.Resources();
      const fontDict = res?.get(PDFName.of('Font')) as any;
      if (fontDict) {
        for (const [, fontRef] of fontDict.entries()) {
          const fObj = loaded.context.lookup(fontRef) as any;
          fObj?.set(PDFName.of('BaseFont'), PDFName.of('ABCDEF+Helvetica'));
        }
      }
      return loaded.save();
    },
  },

  // 4. Word-like PDF export without TrimBox and non-standard dimensions
  {
    id: 'word_arbitrary_unverifiable',
    fileName: 'Word_Export_NoTrimBox.pdf',
    description: 'Document bureautique Word sans TrimBox, dimensions arbitraires (195x280mm) empêchant toute déduction déterministe.',
    producer: 'Word_Mock',
    expectedStatus: 'partial_verification',
    generate: async () => {
      const doc = await PDFDocument.create();
      doc.setProducer('Microsoft Word for Office 365');
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const w = 195 * MM_TO_PT;
      const h = 280 * MM_TO_PT;

      const page = doc.addPage([w, h]);
      page.setMediaBox(0, 0, w, h);
      page.drawText('Rapport d’activité bureautique non normalisé', { x: 50, y: 150, size: 11, font });

      const rawBytes = await doc.save();
      const loaded = await PDFDocument.load(rawBytes);
      const res = loaded.getPage(0).node.Resources();
      const fontDict = res?.get(PDFName.of('Font')) as any;
      if (fontDict) {
        for (const [, fontRef] of fontDict.entries()) {
          const fObj = loaded.context.lookup(fontRef) as any;
          fObj?.set(PDFName.of('BaseFont'), PDFName.of('ABCDEF+Helvetica'));
        }
      }
      return loaded.save();
    },
  },

  // 5. Rotated page (/Rotate 90)
  {
    id: 'rotated_page_landscape',
    fileName: 'Landscape_Rotated_90.pdf',
    description: 'Page au format portrait avec drapeau /Rotate 90 transformé en paysage.',
    producer: 'Illustrator_Mock',
    expectedStatus: 'partial_verification',
    generate: async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const w = 210 * MM_TO_PT;
      const h = 297 * MM_TO_PT;

      const page = doc.addPage([w, h]);
      page.setRotation(degrees(90));
      page.drawText('Document paysage avec rotation 90 degrés', { x: 50, y: 150, size: 11, font });

      return doc.save();
    },
  },
];
