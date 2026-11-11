# ADR-003 : Système de profils et seuils 100% paramétriques

## Statut
Accepté — Intégré dans Check MyFile v2.2.0.

## Contexte
Auparavant, des seuils techniques arbitraires (fond perdu de 5 mm, texte de 8 pt, filet de 0,5 pt, marges de 10 mm) étaient dispersés en dur dans les composants React (`PdfViewer.tsx`, `InspectionSidebar.tsx`) et dans les détecteurs du moteur. Cela empêchait d'adapter l'outil à des produits différents (cartes de visite, affiches grand format, brochures) et créait des incohérences d'affichage.

## Décision

### 1. Zéro seuil en dur dans le code
Toutes les constantes prépresse doivent obligatoirement provenir de l'instance `PrintProfile` injectée lors de l'analyse :
- Format cible : `widthMm`, `heightMm`, `dimensionToleranceMm`.
- Fond perdu par côté : `bleed: { topMm, bottomMm, leftMm, rightMm }`, `requiredBleedMm`.
- Marges de sécurité : `criticalSafetyMarginMm` (bloquant) et `advisorySafetyMarginMm` (alerte).
- Corps de texte minimal : `criticalTextSizePt` et `advisoryTextSizePt`.
- Épaisseur de filet minimale : `criticalStrokeWidthPt` et `advisoryStrokeWidthPt`.
- Résolution d'image : `criticalImageDpi` et `advisoryImageDpi`.
- Politiques : `allowedColorSpaces`, `rgbAllowed`, `transparencyPolicy`, `pdfxStandard`.

### 2. Distinction des seuils critiques et d'alerte
Pour chaque critère physique (marge, corps, filet, résolution), le profil définit deux seuils :
1. **Seuil critique (BLOCKING)** : Valeur en-deçà de laquelle l'impression est matériellement compromise (ex: filet < 0.2 pt qui disparaît, texte < 4.5 pt illisible, image < 150 DPI floue).
2. **Seuil d'alerte (ADVISORY)** : Recommandation d'atelier pour garantir le confort visuel optimal (ex: marge de 10 mm sur A4, image 300 DPI).

### 3. Statut des seuils : Conventions d'atelier
Chaque profil inclut la mention explicite :
> **« Convention d'atelier, à valider par un imprimeur »**

Ces seuils ne sont pas des lois physiques universelles imposées par ISO, mais des pratiques professionnelles constatées chez les imprimeurs partenaires.

### 4. Surcharge de sévérité par règle
Le profil dispose du dictionnaire optionnel `ruleSeverities?: Record<string, RuleSeverity>` permettant d'adapter la sévérité d'une règle selon le support (ex: rendre l'incorporation de police bloquante en imprimerie de labeur mais consultative sur imprimante de bureau).

## Conséquences
- L'interface d'inspection et le viewer PDF lisent dynamiquement les guides et calques depuis `result.profile`.
- Les profils personnalisés (`createCustomProfile`) s'adaptent instantanément à tout format atypique.
- Isolation complète entre la logique de détection algorithmique et la politique commerciale d'impression.
