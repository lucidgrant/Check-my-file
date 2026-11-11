# Architecture Technique — Check MyFile

Espace de travail documentaire spécialisé dans l'inspection prépresse de fichiers PDF. L'ensemble des contrôles s'exécute localement dans le navigateur, sans envoi de fichier vers un serveur distant et sans recours à une intelligence artificielle.

---

## 1. Flux de traitement des données

```
Fichier PDF (.pdf)
       │ (glisser-déposer ou sélection locale)
       ▼
  ArrayBuffer (mémoire navigateur)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
   pdf-lib                           PDF.js                       Profil d'impression
 (Structure & Boîtes)          (Rendu & Glyphes)                (Exigences & Seuils)
 • Table xref / syntaxe        • Parsing textuel                 • Format fini & tolérances
 • MediaBox, TrimBox, BleedBox • Matrice CTM / échelle           • Fond perdu par bord
 • Descripteurs de polices     • Coordonnées d'affichage         • Marges de sécurité
 • Flux décompressés (zlib)    • Tracés & images matricielles    • Politiques couleur / PDF/X
       │                                 │                                 │
       └─────────────────────────────────┴─────────────────────────────────┘
                                         │
                                         ▼
                             Moteur de règles métier
                             (src/services/pdfAnalyzer.ts)
                                         │
                                         ▼
                            Tableau de RuleCheckResult[]
                         (Statut, Sévérité, Constat, Mesure)
                                         │
                                         ▼
                       Calcul du verdict global par priorité
     (ANALYSIS_FAILED > PROBLEMS_DETECTED > ATTENTION_REQUIRED > PARTIAL_VERIFICATION > NO_ISSUE)
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
          Espace d'inspection UI                     Générateur de rapport PDF
       • Visualiseur PDF & Repères                • Document téléchargeable
       • Panneau « Points à examiner »            • Tableau des contrôles
       • Périmètre technique non couvert          • Liste « Non couvert » officielle
```

---

## 2. Rôles et responsabilités des bibliothèques PDF

| Bibliothèque | Rôle principal | Cas d'usage spécifiques |
| :--- | :--- | :--- |
| **`pdf-lib`** | Manipulation structurelle de bas niveau | • Extraction des boîtes de page (`MediaBox`, `TrimBox`, `BleedBox`).<br>• Décodage des flux bruts via `decodePDFRawStream`.<br>• Vérification des flux de polices vectorielles (`FontFile`, `FontFile2`, `FontFile3`).<br>• Détection des espaces colorimétriques dans les ressources.<br>• Génération du rapport de contrôle prépresse PDF. |
| **`pdfjs-dist` (PDF.js)** | Moteur d'interprétation et de rendu | • Extraction du texte avec positionnement spatial et transformation matricielle.<br>• Calcul du corps de texte effectif ($\text{taille} \times \text{échelle CTM}$).<br>• Affichage haute fidélité du document dans le canevas interactif.<br>• Projection des repères géométriques sur l'écran (`convertToViewportPoint`). |

---

## 3. Organisation du code source

```
/
├── src/
│   ├── rules/                 # Référentiel centralisé des règles métier
│   │   ├── types.ts           # Typologie normalisée (RuleStatus, RuleSeverity, OverallVerdict)
│   │   └── catalog.ts         # Catalogue des règles prépresse et constante UNCOVERED_CHECKS_CATALOG
│   ├── profiles/              # Profils d'impression paramétriques
│   │   ├── types.ts           # Schéma 100% paramétrique (fond perdu, marges, corps, couleurs)
│   │   └── registry.ts        # Profils standard (A4, A5, Carte, etc.) et factory createCustomProfile
│   ├── services/
│   │   ├── pdfAnalyzer.ts     # Moteur de détection déterministe
│   │   ├── reportGenerator.ts # Générateur de rapport PDF
│   │   └── preflightTests.ts  # Suite de tests automatisée par règle et par statut
│   ├── components/            # Composants React de l'espace d'inspection
│   │   ├── Header.tsx         # En-tête avec verdict technique et actions
│   │   ├── PdfViewer.tsx      # Zone principale : Document et calques géométriques
│   │   ├── InspectionSidebar  # Panneau latéral « Points à examiner » et liste « Non couvert »
│   │   ├── RuleDetailModal    # Modal de consultation des fiches techniques des règles
│   │   ├── UploadSection.tsx  # Dépose de fichier et sélection du profil
│   │   └── ErrorBoundary.tsx  # Neutralisation des erreurs d'affichage
│   ├── types/
│   │   └── preflight.ts       # Interfaces unifiées de diagnostic
│   ├── App.tsx                # Composant racine orchestrant l'espace de travail
│   └── main.tsx               # Point d'entrée de l'application
├── docs/                      # Documentation technique et décisions d'architecture
│   ├── STATE_OF_PLAY.md       # Tableau d'avancement par règle
│   ├── IMPLEMENTATION_LOG.md  # Journal des modifications techniques
│   └── adr/                   # Architecture Decision Records (ADR-001, ADR-002, ADR-003)
└── scripts/
    └── runTests.ts            # Exécuteur CLI de la suite de tests automatisée
```

---

## 4. Checklist : « Ajouter une nouvelle règle de contrôle »

Pour enrichir le catalogue avec une nouvelle règle (ex: `TRIM-03` ou `BARCODE-01`) sans déstabiliser l'application :

1. **Déclarer dans `src/rules/types.ts`** :
   - Associer la règle à une `RuleCategory` existante ou en ajouter une.
2. **Documenter dans `src/rules/catalog.ts`** :
   - Enregistrer l'objet `PreflightRule` complet avec : `id`, `name`, `version`, `objective`, `technicalDefinition`, `primaryUnit`, `detectionMethod`, `defaultSeverity`, `userMessages`, et références techniques.
3. **Paramétrer dans `src/profiles/types.ts` & `registry.ts`** :
   - Ajouter si nécessaire le seuil correspondant au niveau du profil avec valeurs critiques et d'alerte. Ne jamais coder de seuil en dur dans le détecteur.
4. **Implémenter le détecteur dans `src/services/pdfAnalyzer.ts`** :
   - Effectuer la mesure déterministe.
   - En l'absence de preuve matérielle incontestable, retourner impérativement `NOT_VERIFIABLE`.
   - Émettre un objet `RuleCheckResult` structuré et un `CheckItem` pour l'interface.
5. **Ajouter la fixture de test dans `src/services/preflightTests.ts`** :
   - Créer un cas de test dédié validant le statut attendu (`PASS`, `FAIL BLOCKING`, `FAIL ADVISORY` ou `NOT_APPLICABLE`).
6. **Mettre à jour `docs/STATE_OF_PLAY.md`** :
   - Ajouter la ligne de synthèse de la nouvelle règle avec son statut d'implémentation et ses limites.
