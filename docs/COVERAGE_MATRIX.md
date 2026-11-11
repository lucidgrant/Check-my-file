# Matrice de Couverture des Règles & Standards — Check MyFile

**Version :** 2.1.0  
**Date :** Novembre 2026  
**Moteur de calcul :** pdf-lib (1.17+) + PDF.js (4.10+)  

---

## 1. Vue d'Ensemble de la Couverture

La matrice ci-dessous détaille la traçabilité complète entre la règle métier prépresse, son implémentation technique dans le moteur déterministe, les standards industriels appliqués et sa validation par la suite de tests automatisée.

| Règle ID | Catégorie | Méthode Technique | Norme Industrielle | Automatisation | Confiance | Statut de Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`BLEED-01`** | Géométrie | Mathématique `TrimBox` vs `BleedBox` / `MediaBox` | ISO 15930-7 (PDF/X-4) / GWG 2022 | Complète (Boîtes PDF) | ÉLEVÉ (`HIGH`) si TrimBox | Test 1, 2, 3, 4 |
| **`BLEED-02`** | Géométrie | Inspection nœud `/Page /TrimBox` | ISO 32000-1 / ISO 15930-1 | Complète | ÉLEVÉ (`HIGH`) | Test 1, 4 |
| **`MARGIN-01`** | Sécurité | Norme euclidienne TextItem vs TrimBox | GWG 2022 Prepress | Complète (Flux texte) | ÉLEVÉ (`HIGH`) | Test 1, 2 |
| **`TEXT-01`** | Typographie | Norme matrice affine `hypot(sx, sky)` | ISO 12647-2:2013 / GWG 2022 | Complète (Flux texte) | ÉLEVÉ (`HIGH`) | Test 1, 2 |
| **`FONT-01`** | Typographie | Dictionnaires `/Font`, `/Type0`, `FontDescriptor` | ISO 15930-4 / ISO 15930-7 | Complète (Dictionnaires) | ÉLEVÉ (`HIGH`) | Test 1, 2 |
| **`STROKE-01`** | Tracés | Opérateurs `setLineWidth` de page | GWG 2022 / ISO 12647-2 | Complète (Flux vectoriel) | ÉLEVÉ (`HIGH`) | Test 1 |
| **`TRANSP-01`** | Couleur | Dictionnaires `/ExtGState`, `/SMask`, `/Group` | ISO 15930-1 / ISO 15930-7 | Complète (Métadonnées) | ÉLEVÉ (`HIGH`) | Test 1, 3 |
| **`BOX-01`** | Structure | Dictionnaires `/MediaBox` et `/Rotate` | ISO 32000-1:2008 | Complète | ÉLEVÉ (`HIGH`) | Test 1, 5 |

---

## 2. Analyse Détaillée des Degrés d'Automatisation

### A. Contrôles à Automatisation Complète & Déterministe
1. **Géométrie des boîtes PDF (`BLEED-01`, `BLEED-02`, `BOX-01`)** :
   - Lecture directe de l'arbre d'objets PDF (`pdf-lib`).
   - Tolérance mathématique de 0.4 mm pour absorber les approximations de conversion points/millimètres.
   - Refus d'inférence en l'absence de repères formels pour les formats atypiques.
2. **Typographie vectorielle (`FONT-01`, `TEXT-01`)** :
   - Détection des sous-ensembles par regex normalisée `^[A-Z]{6}\+`.
   - Inspection récursive des polices composites CID.
   - Mesure exacte de la taille en points par calcul d'échelle de la matrice affine.

### B. Contrôles avec Périmètre Délimité (Prudence Industrielle)
1. **Zone de sécurité (`MARGIN-01`)** :
   - Délimitation stricte aux éléments textuels extractibles.
   - Les fonds colorés, textures et images en pleine page sont délibérément exclus pour éviter les fausses alertes sur la matière de fond perdu légitime.
2. **Filets vectoriels (`STROKE-01`)** :
   - Contrôle des contours tracés via `setLineWidth`.
   - Ne recalcule pas les matrices de transformation courante imbriquées (CTM) complexes.

---

## 3. Matrice des Contrôles Hors Périmètre Actuel

Pour assurer une transparence absolue avec l'utilisateur et les professionnels de l'impression :

| Domaine de Contrôle | Raison du Report / Non-Prise en Charge | Recommandation Atelier |
| :--- | :--- | :--- |
| **Séparation CMJN vs RVB / Profils ICC** | Une conversion colorimétrique sans moteur RIP dédié ou sans profil ICC normalisé (ex: FOGRA51) risque de dénaturer les teintes et les noirs texte. | Géré par le flux prépresse de l'imprimeur (RIP). |
| **DPI effectif des images matricielles** | Les images encapsulées dans des masques ou des flux complexes nécessitent un moteur de rastérisation complet. | Vérifier la résolution source ($\ge 300\text{ DPI}$) dans le logiciel de PAO. |
| **Aplatissement vectoriel des transparences** | L'aplatissement destructif requiert des algorithmes PostScript lourds (Ghostscript). | Exporter en PDF/X-1a depuis InDesign si l'imprimeur refuse le PDF/X-4. |
| **Génération artificielle de fond perdu** | L'effet miroir ou la dilatation automatique des bordures altère les mises en page et peut déformer des logos situés en bord de page. | Ajuster les blocs d'arrière-plan dans le document source. |
| **Surimpression & Défonce (Overprint / Trapping)** | Nécessite un simulateur de prévisualisation de séparations de plaques. | Vérifier les options de surimpression du noir 100% dans InDesign. |
