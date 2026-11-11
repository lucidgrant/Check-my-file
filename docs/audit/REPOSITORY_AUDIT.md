# ÉTAT DES LIEUX ET AUDIT DU REPOSITORY — CHECK MYFILE
## Document de cadrage — Étape 0 du Master Development Brief

Date de l'audit : 11 novembre 2026  
Statut : **Validé (Phase 0 achevée)**  
Auteur : Moteur d'Ingénierie Check MyFile  

---

## 1. Architecture Réelle & Arborescence

L'application **Check MyFile** est une Single-Page Application (SPA) bâtie sur **React 19**, **TypeScript** et **Vite 8**, avec styling **Tailwind CSS v4**.

Son exécution est **100% côté client (in-browser)** : aucun fichier PDF n'est téléversé sur un serveur distant ni stocké de manière persistante. Le traitement s'effectue directement sur des tampons mémoires (`ArrayBuffer`).

### Arborescence réelle constatée

```text
/
├── docs/
│   ├── adr/
│   │   └── 001-rule-governance-architecture.md # Décision d'architecture initiale (5 couches)
│   ├── audit/
│   │   └── REPOSITORY_AUDIT.md                 # Ce document (Étape 0)
│   ├── COVERAGE_MATRIX.md                      # Matrice de couverture actuelle (8 règles)
│   ├── GLOSSARY.md                             # Glossaire prépresse en français
│   └── RULE_CATALOG.md                         # Catalogue exhaustif v2.1.0 des règles métier
├── scripts/
│   └── runTests.ts                             # Lanceur CLI de tests prépresse déterministes
├── src/
│   ├── components/
│   │   ├── AnalyzingOverlay.tsx                # Overlay d'animation d'analyse
│   │   ├── ErrorBoundary.tsx                   # Barrière de sécurité anti-crash React
│   │   ├── Header.tsx                          # En-tête avec cartouche de versions et actions
│   │   ├── InspectionSidebar.tsx               # Volet latéral des points à examiner
│   │   ├── PdfViewer.tsx                       # Visionneuse PDF canvas + calques SVG
│   │   ├── RuleDetailModal.tsx                 # Modal de consultation des fiches techniques
│   │   └── UploadSection.tsx                   # Espace de dépôt, profils et cas d'essai
│   ├── profiles/
│   │   ├── registry.ts                         # Registre des 6 profils d'impression (v1.2.0)
│   │   └── types.ts                            # Types des profils et spécifications PDF/X
│   ├── rules/
│   │   ├── catalog.ts                          # Référentiel des 8 règles prépresse (v2.1.0)
│   │   └── types.ts                            # Types des règles, résultats et statuts
│   ├── services/
│   │   ├── pdfAnalyzer.ts                      # Moteur central d'analyse prévol (v2.0.0)
│   │   ├── preflightTests.ts                   # Suite de 6 tests de validation automatisés
│   │   ├── reportGenerator.ts                  # Générateur du rapport PDF téléchargeable
│   │   └── samplePdfs.ts                       # Générateur de 3 PDF témoins pour l'interface
│   ├── types/
│   │   └── preflight.ts                        # Modèles du domaine prépresse et diagnostics
│   ├── App.tsx                                 # Composant racine et machine d'état
│   ├── index.css                               # Tailwind CSS v4 (@import "tailwindcss")
│   └── main.tsx                                # Point d'entrée avec ErrorBoundary
├── ARCHITECTURE.md                             # Synthèse architecturale de premier niveau
├── index.html                                  # Document HTML maître
├── package.json                                # Dépendances et scripts de build
├── tsconfig.json                               # Configuration du compilateur TypeScript
└── vite.config.ts                              # Configuration Vite
```

---

## 2. Flux de Traitement des Fichiers PDF

Le cycle de vie du document PDF dans Check MyFile suit le pipeline suivant :

```text
[Fichier PDF Déposé]
         │ (FileReader.readAsArrayBuffer)
         ▼
  [ArrayBuffer] ─────────────── Clones défensifs (.slice(0))
         │                               │
         ├───────────────────────────────┤
         ▼                               ▼
  [pdf-lib (COS parser)]         [pdfjs-dist (Vite)]
  • MediaBox, TrimBox, BleedBox  • page.getTextContent()
  • Rotation (/Rotate)           • Matrices de transformation (CTM)
  • /Font & /FontDescriptor      • Calcul des corps de texte
  • /FontFile, /FontFile2, /FontFile3 • Bounding boxes des glyphes
  • Préfixes sous-ensembles ABCDEF+ • Opérateurs graphiques setLineWidth
  • Dictionnaires /ExtGState     • Tracés de contours vectoriels
         │                               │
         └───────────────┬───────────────┘
                         ▼
        [Calculs Géométriques & Métier]
        • Comparaison au profil d'impression sélectionné
        • Évaluation des seuils (fond perdu, marges, lisibilité)
        • Agrégation des occurrences en AnomalyGroups
        • Émission des 8 RuleCheckResults
                         ▼
             [Calcul du Verdict Global]
             (no_issues | issues | partial | failed)
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[Espace Documentaire]             [Rapport de Synthèse]
• Header (statut & versions)      • Exportation PDF téléchargeable
• PdfViewer (Canvas + SVG)        • Horodatage et cartouche
• InspectionSidebar (Badges)      • Traçabilité par règle
```

---

## 3. Responsabilités Comparées de `pdf-lib` et `pdfjs-dist`

| Domaine technique | Bibliothèque responsable | Mécanisme d'extraction | Justification technique |
| :--- | :--- | :--- | :--- |
| **Boîtes de page** (`MediaBox`, `TrimBox`, `BleedBox`, `CropBox`) | **`pdf-lib`** | Inspection directe des dictionnaires `/Page` via l'API COS (`PDFDict`, `PDFArray`). | `pdfjs-dist` ne garantit pas la restitution fidèle de la `TrimBox` ou `BleedBox` si elles ne sont pas appliquées au viewport d'affichage. |
| **Rotation de page** | **`pdf-lib`** | `page.getRotation().angle` sur l'objet de page. | Permet d'isoler la rotation structurelle (`/Rotate 0, 90, 180, 270`) avant tout affichage. |
| **Polices et sous-ensembles** | **`pdf-lib`** | Parcours de `/Resources /Font`, inspection de `/FontDescriptor` et recherche des flux `/FontFile*`. Détection de préfixe `ABCDEF+`. Support des dictionnaires `/DescendantFonts` (Type0). | `pdfjs-dist` charge des substituts système silencieusement lorsque la police n'est pas incorporée, faussant le diagnostic. |
| **Transparences et masques** | **`pdf-lib`** | Détection de `/ExtGState` avec `ca < 1` ou `CA < 1`, `/SMask`, et `/Group /Transparency`. | Détection directe et certaine au niveau structurel du fichier. |
| **Extraction du texte et positions** | **`pdfjs-dist`** | `page.getTextContent()`. | Restitue la matrice affine `transform: [sx, sky, skx, sy, tx, ty]` de chaque bloc de texte, indispensable pour calculer les coordonnées spatiales exactes. |
| **Taille typographique (corps en points)** | **`pdfjs-dist`** | $\text{Taille} = \sqrt{\text{transform}[0]^2 + \text{transform}[1]^2}$. | Prend en compte les transformations combinées (échelle de matrice et taille de police). |
| **Filets maigres (contours)** | **`pdfjs-dist`** | `page.getOperatorList()`, recherche des `OPS.setLineWidth` associés aux opérations de tracé (`stroke`). | `pdf-lib` ne possède pas de parseur de flux d'opérateurs de rendu. |
| **Rendu visuel interactif** | **`pdfjs-dist`** | `page.render({ canvasContext, viewport })`. | Moteur de tramage raster éprouvé pour le navigateur avec gestion HiDPI. |
| **Génération du rapport PDF** | **`pdf-lib`** | Assemblage programmatique de primitives vectorielles, textes et tableaux dans un nouveau `PDFDocument`. | Aucune dépendance externe requise, génération rapide et locale. |

---

## 4. Catalogue des Règles Actuelles (`src/rules/catalog.ts` — v2.1.0)

| Identifiant | Intitulé de la règle | Méthode de détection | Norme de référence | Sévérité par défaut |
| :--- | :--- | :--- | :--- | :--- |
| **`BLEED-01`** | Fond perdu géométrique requis | `pdf_box_math` via `pdf-lib` | ISO 15930-7 / GWG 2022 | `error` |
| **`BLEED-02`** | Balisage formel de la TrimBox | `structure_meta` via `pdf-lib` | ISO 32000-1 / ISO 15930-1 | `warning` |
| **`MARGIN-01`** | Marge intérieure de sécurité (zone tranquille) | `glyph_bbox` via `pdfjs-dist` | GWG 2022 / ISO 12647-2 | `warning` |
| **`TEXT-01`** | Corps typographique minimal | `glyph_bbox` via `pdfjs-dist` | GWG 2022 | `warning` |
| **`FONT-01`** | Incorporation des polices et sous-ensembles | `font_dict` via `pdf-lib` | ISO 15930-7 / ISO 32000-1 | `error` |
| **`STROKE-01`** | Épaisseur minimale des filets | `operator_stream` via `pdfjs-dist` | GWG 2022 / ISO 12647-2 | `warning` |
| **`TRANSP-01`** | Transparences actives et modes de fusion | `extgstate` via `pdf-lib` | ISO 15930-1 vs ISO 15930-7 | `warning` |
| **`BOX-01`** | Intégrité et orientation des boîtes de page | `structure_meta` via `pdf-lib` | ISO 32000-1 | `warning` |

---

## 5. Profils d'Impression Existants (`src/profiles/registry.ts` — v1.2.0)

| Identifiant | Nom du profil | Dimensions ($L \times H$) | Fond perdu | Marge sécurité | Texte min. | Filet min. | Norme PDF/X |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `a4` | Flyer / Affiche A4 | $210 \times 297\text{ mm}$ | $5\text{ mm}$ | $10\text{ mm}$ | $8\text{ pt}$ | $0.5\text{ pt}$ | PDF/X-4 |
| `a5` | Flyer A5 | $148 \times 210\text{ mm}$ | $3\text{ mm}$ | $5\text{ mm}$ | $7\text{ pt}$ | $0.5\text{ pt}$ | PDF/X-4 |
| `business_card` | Carte de Visite | $85 \times 55\text{ mm}$ | $3\text{ mm}$ | $3\text{ mm}$ | $6\text{ pt}$ | $0.4\text{ pt}$ | PDF/X-4 |
| `brochure_a4` | Brochure A4 piquée | $210 \times 297\text{ mm}$ | $5\text{ mm}$ | $12\text{ mm}$ | $8\text{ pt}$ | $0.5\text{ pt}$ | PDF/X-4 |
| `square_150` | Carré 150 | $150 \times 150\text{ mm}$ | $5\text{ mm}$ | $10\text{ mm}$ | $8\text{ pt}$ | $0.5\text{ pt}$ | non_specifie |
| `large_format_a3` | Affiche A3 | $297 \times 420\text{ mm}$ | $5\text{ mm}$ | $15\text{ mm}$ | $10\text{ pt}$ | $0.75\text{ pt}$ | PDF/X-4 |
| `custom` | Personnalisé | Dynamique | Paramétrable | Paramétrable | $\ge 4\text{ pt}$ | $\ge 0.1\text{ pt}$ | Paramétrable |

---

## 6. Modèle de Verdict Actuel

Le moteur émet actuellement 4 statuts d'agrégation :
1. `no_issues_detected` : « Aucun problème détecté » (vert).
2. `issues_detected` : « Problèmes détectés » (rouge).
3. `partial_verification` : « Vérification partielle » (orange).
4. `analysis_failed` : « Analyse impossible » (gris/rouge foncé).

Au niveau unitaire d'une règle, `RuleCheckResult` émet : `PASS`, `FAIL`, `WARNING`, `NOT_VERIFIABLE`, `ERROR`.

### Limites constatées sur le modèle de verdict (cibles de l'Étape 2 / ADR-002) :
- Pas de séparation stricte entre sévérité (`BLOCKING` vs `ADVISORY`) et statut de règle.
- Absence du statut individuel `NOT_APPLICABLE` (ex: document sans aucun tracé vectoriel, ou sans transparence).
- Absence d'état de cycle de vie formel sur la règle (`PLANNED`, `ACTIVE`, `DEPRECATED`).
- Absence de compteurs distincts et immuables dans le résultat (bloquants, points de vigilance, non vérifiables, non applicables).

---

## 7. Architecture des Tests et Dépendances

### Dépendances directes (`package.json`)
- Runtime : `@google/genai` (2.4.0), `express` (4.21.2), `lucide-react` (0.546.0), `motion` (12.23.24), `pdf-lib` (1.17.1), `pdfjs-dist` (6.5.438), `react` (19.0.1), `react-dom` (19.0.1), `vite` (8.3.0).
- Dev : `@types/react` (19.3.0), `tailwindcss` (4.3.3), `tsx` (4.21.0), `typescript` (7.0.2).

### Tests actuels
- Fichier : `src/services/preflightTests.ts`
- Script : `scripts/runTests.ts` (`bun x tsx scripts/runTests.ts`)
- Couverture : 6 tests déterministes (Conforme, Non conforme, Cas limite, Non vérifiable, Rotation 90°, Rapport PDF).
- **Constat** : Aucun framework de test standardisé (Vitest) n'est installé. Les tests passent tous (6/6), mais la collecte de Golden Masters et l'exécution fine par détecteur nécessitent une infrastructure dédiée (Étape 1).

---

## 8. Classification Exhaustive des Constats

### A. BUGS CONFIRMÉS

1. **Incohérence des seuils affichés dans l'en-tête de `UploadSection.tsx`** :
   - *Code* : ligne 119 de `UploadSection.tsx` affiche en dur `(5 mm), les marges de coupe (10 mm), les corps de texte (< 8 pt)`.
   - *Impact* : Confusion lorsque l'utilisateur sélectionne un profil Carte de visite (3 mm / 3 mm / 6 pt).
   - *Statut* : Bug confirmé d'interface.
2. **Vocabulaire de verdict obsolète dans `src/services/samplePdfs.ts`** :
   - *Code* : `expectedVerdict` utilise encore `'to_fix' | 'ready' | 'to_verify'` au lieu de `'issues_detected' | 'no_issues_detected' | 'partial_verification'`.
   - *Impact* : Désynchronisation entre les types de démonstration et les types du moteur.
   - *Statut* : Bug confirmé de typage d'échantillons.

### B. RISQUES TECHNIQUES

1. **Documents PDF chiffrés / protégés par mot de passe** :
   - *Code* : `PDFDocument.load` dans `pdf-lib` lance une exception brute lors du décodage de documents chiffrés.
   - *Risque* : Blocage de l'analyse même si le document n'a qu'un mot de passe propriétaire (permissions) et pas de mot de passe utilisateur d'ouverture.
   - *Atténuation en place* : Détection du mot-clé `password`/`encrypted` et bascule en `analysis_failed`, mais distinction propriétaire/utilisateur impossible sans parseur spécifique.
2. **Gestion de la mémoire et transfert des `ArrayBuffer`** :
   - *Risque* : Le passage d'un `ArrayBuffer` entre la visionneuse et le moteur d'analyse peut détacher le tampon mémoire (`byteLength === 0`) si un Web Worker ou un transfert natif intervient sans copie défensive.
   - *Atténuation en place* : Clones explicites `.slice(0)` avant instanciation des deux bibliothèques.

### C. LIMITATIONS FONCTIONNELLES ASSUMÉES

1. **`BLEED-01` : Présence de matière graphique réelle dans le fond perdu** :
   - Le moteur valide l'extension mathématique de la `BleedBox` par rapport à la `TrimBox`, mais ne vérifie pas si les pixels effectifs du débord sont blancs ou imprimés.
2. **`MARGIN-01` : Éléments vectoriels et images en zone tranquille** :
   - Le contrôle inspecte exclusivement les flux de texte extractibles. Un logo vectoriel ou une illustration collée au bord de coupe n'est pas signalé sous `MARGIN-01`.
3. **Textes vectorisés (Outlines)** :
   - Si les textes ont été transformés en courbes de Bézier dans Illustrator/InDesign, ils ne contiennent plus de police ni de chaîne textuelle. Le moteur qualifie le contrôle de non vérifiable / sans objet.
4. **Pas de conversion destructive RGB $\rightarrow$ CMYK** :
   - Choix d'architecture explicite : aucune conversion destructive dans le navigateur sans profil ICC certifié.

### D. AMÉLIORATIONS RECOMMANDÉES

1. **Installation de Vitest** pour structurer l'exécution des tests unitaires par règle et par profil avec rapports de régression.
2. **Création d'un `PageModel` unifié** pour mutualiser les calculs de coordonnées entre le moteur prépresse et la visionneuse PDF.
3. **Formalisation de l'ADR-002** pour le modèle de verdict à 4 dimensions (Résultat, Sévérité, Cycle de vie, Couverture).
4. **Implémentation progressive des règles `IMAGE-01` (DPI effectif) et `COLOR-01` (Espaces colorimétriques)** après consolidation des règles existantes.

---

## 9. Conclusion de l'Étape 0

Le repository présente une base technique saine, déterministe et performante. Aucune régression n'a été introduite. Les dépendances sont stables et la suite de tests existante est au vert (6/6 PASS).

Les incohérences identifiées sont d'ordre déclaratif et structurel (séparation des modèles de verdict, seuils résiduels d'interface et absence de PageModel unifié).

L'Étape 0 est **terminée**. L'Étape 1 (Filet de sécurité & Golden Master) peut être engagée conformément au plan d'exécution.
