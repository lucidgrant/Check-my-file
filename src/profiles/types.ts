/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Typologie 100% paramétrique des profils d'impression prépresse
 */

import { RuleSeverity } from '../rules/types';

export type ProductType = 
  | 'commercial_print'  // Flyers, affiches, dépliants
  | 'stationery'        // Cartes de visite, papier en-tête, enveloppes
  | 'publishing'        // Brochures piquées, magazines, catalogues
  | 'large_format'      // Affiches grand format, bâches
  | 'packaging'         // Packaging, boîtes, étiquettes
  | 'custom';           // Dimensions et contraintes sur-mesure

export type OrientationRequirement = 'portrait' | 'landscape' | 'any';

export type PdfXExpectedStandard = 'none' | 'PDF/X-1a' | 'PDF/X-4';

export type TransparencyPolicy = 'allowed' | 'discouraged' | 'forbidden';

export type AllowedColorSpace = 'DeviceCMYK' | 'DeviceGray' | 'DeviceRGB' | 'ICCBased' | 'Separation' | 'Indexed';

export interface BleedPerSide {
  topMm: number;
  bottomMm: number;
  leftMm: number;
  rightMm: number;
}

export interface PrintProfile {
  id: string;
  version: string;
  name: string;
  description: string;
  productType: ProductType;

  // 1. Géométrie & Format fini (mm)
  widthMm: number;
  heightMm: number;
  orientation: OrientationRequirement;
  dimensionToleranceMm: number; // Tolérance de conformité sur le format (ex: 0.5 mm)

  // 2. Fond perdu (Bleed) par côté (mm)
  bleed: BleedPerSide;
  requiredBleedMm: number; // Valeur nominale de référence (ex: 5 mm)

  // 3. Marge de sécurité intérieure / Zone tranquille (mm)
  criticalSafetyMarginMm: number; // Seuil critique (ex: 5 mm) - BLOCKING
  advisorySafetyMarginMm: number; // Seuil d'alerte confort (ex: 10 mm) - ADVISORY
  requiredSafetyMarginMm: number; // Alias de compatibilité

  // 4. Corps de texte minimal (pt)
  criticalTextSizePt: number;     // Seuil critique illisibilité (ex: 5 pt) - BLOCKING
  advisoryTextSizePt: number;     // Seuil d'alerte finesse (ex: 7 pt ou 8 pt) - ADVISORY
  minTextSizePt: number;          // Alias de compatibilité

  // 5. Filets & Contours vectoriels (pt)
  criticalStrokeWidthPt: number;  // Seuil critique filet disparu au flashage (ex: 0.2 pt) - BLOCKING
  advisoryStrokeWidthPt: number;  // Seuil d'alerte fragilité d'impression (ex: 0.5 pt) - ADVISORY
  minStrokeWidthPt: number;       // Alias de compatibilité

  // 6. Résolution matricielle des images (DPI)
  criticalImageDpi: number;       // Seuil critique pixellisation (ex: 150 DPI) - BLOCKING
  advisoryImageDpi: number;       // Seuil d'alerte qualité optimale (ex: 240 ou 300 DPI) - ADVISORY

  // 7. Politique colorimétrique
  allowedColorSpaces: AllowedColorSpace[];
  rgbAllowed: boolean;
  outputIntentRequired: boolean;
  prohibitRichBlackText: boolean; // Interdire le noir 4 couleurs sur le texte < 14 pt

  // 8. Politique de transparence
  transparencyPolicy: TransparencyPolicy;

  // 9. Standard PDF/X exigé
  pdfxStandard: PdfXExpectedStandard;

  // 10. Surcharges de sévérité par règle (optionnelles)
  ruleSeverities?: Record<string, RuleSeverity>;

  // 11. Métadonnées d'atelier
  isCustom?: boolean;
  workshopConventionNote: string; // "Convention d'atelier, à valider par un imprimeur"
  notes?: string;
}

export interface ProfileRegistryMetadata {
  registryVersion: string;
  lastUpdated: string;
  profilesCount: number;
  profiles: PrintProfile[];
}
