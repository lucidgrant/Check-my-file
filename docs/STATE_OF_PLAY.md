# Check MyFile — État d’avancement des règles (State of Play)

Ce document dresse l'état précis d'implémentation de chacune des 14 règles de contrôle prépresse du prototype Check MyFile.

| Identifiant | Règle | Statut d'implémentation | Méthode technique | Niveau de confiance | Limites connues | Ce qui reste à valider / refaire |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BLEED-01** | Fond perdu requis (4 côtés) | **Complète** | Différentiel `TrimBox` vs `BleedBox` / `MediaBox` sur chaque bord | `HIGH` | Exige une TrimBox pour calculer avec certitude le débord | Tester avec des fichiers contenant des BleedBox asymétriques |
| **BLEED-02** | Définition et cohérence de la TrimBox | **Complète** | Inspection du dictionnaire de page (`/TrimBox`) et inclusion dans `MediaBox` | `HIGH` | Absente par défaut des exports PDF bureautiques (Word, etc.) | Vérifier les arrondis au 1/100e de point |
| **BLEED-03** | Présence de matière dans le fond perdu | **Approximative** | Heuristique de détection de tracés / visuels débordant au-delà de la coupe | `MEDIUM` | Faux positif sur les pages à fond blanc volontaire | Rendu rasterisé de haute précision sur la bande de massicot |
| **MARGIN-01** | Zone de sécurité intérieure (Zone tranquille) | **Complète** | Filtrage des glyphes utiles dans la TrimBox et calcul de distance aux 4 bords | `HIGH` | Les textes vectorisés (en courbes) ne sont pas inspectés | Gérer le cas où un texte touche intentionnellement le fond perdu (titre pleine page) |
| **TEXT-01** | Corps de texte minimal effectif | **Complète** | Déterminant de la matrice de transformation CTM $\times$ taille nominale | `HIGH` | Ne détecte pas les textes vectorisés ou scannés | Prise en compte du crénage et graisse réelle |
| **FONT-01** | Incorporation effective des polices | **Complète** | Validation des flux `FontFile`/`FontFile2`/`FontFile3` > 0 octet sur polices utilisées | `HIGH` | Les polices Type 3 générées dynamiquement n'ont pas de flux standard | Détection fine des encodages ToUnicode personnalisés |
| **STROKE-01** | Épaisseur minimale des filets (Hairlines) | **Complète** | Parcours des opérateurs `w` et `S` dans les flux de contenu | `HIGH` | `NOT_APPLICABLE` si aucun filet ; CTM sur Form XObjects imbriqués | Détection des contours générés par des brosses artistiques |
| **IMAGE-01** | Résolution effective des images (DPI) | **Complète** | Ratio pixels natifs du XObject `/Image` sur emprise géométrique projetée | `HIGH` | `NOT_APPLICABLE` si aucune image ; masques vectoriels non retranchés | Détection des images inclinées ou déformées de manière anamorphique |
| **COLOR-01** | Espaces colorimétriques & Noir quadri | **Complète** | Audit des opérateurs `rg`/`RG`, `k`/`K` et des dictionnaires `/ColorSpace` | `HIGH` | Les profils DeviceRGB avec DeviceLink RIP sont signalés par précaution | Échantillonnage spectral du taux d'encrage total (TAC / Couverture) |
| **COLOR-02** | OutputIntent & Déclaration PDF/X | **Complète** | Lecture du dictionnaire `/Root -> /OutputIntents` (`/GTS_PDFX`) | `HIGH` | `NOT_APPLICABLE` si aucun standard PDF/X n'est exigé par le profil | Valider le nom exact de la condition d'impression (FOGRA39 vs FOGRA51) |
| **TRANSP-01** | Transparences actives et modes de fusion | **Complète** | Audit des `/ExtGState` réels (`/ca`, `/CA < 1`, `/BM`) et `/SMask` | `HIGH` | Le `/Group` par défaut posé sur chaque page par les PAO modernes est ignoré | Aplatissement interactif côté client |
| **OVERPRINT-01** | Gestion de la surimpression (Overprint) | **Complète** | Filtrage des états `/OP` et `/op` combinés aux couleurs blanches | `HIGH` | Ne remplace pas le RIP qui peut forcer le blanc en défonce | Détection fine de la surimpression du noir 100% K en corps de texte |
| **BOX-01** | Orientation et homogénéité des pages | **Complète** | Analyse des entrées `/Rotate` et des dimensions `MediaBox` de chaque page | `HIGH` | `NOT_APPLICABLE` sur les documents d'une seule page | Détection des formats dépliants 3 volets avec rabat plus court |
| **INGEST-01** | Intégrité du document & Accès | **Complète** | Analyse de syntaxe, mot de passe d'ouverture et validation `pageCount > 0` | `HIGH` | `pdf-lib` ne peut pas inspecter les fichiers avec mot de passe propriétaire | Lecture partielle des flux avec métadonnées seules |

---

### Conventions & Niveaux d'implémentation
- **Complète** : Algorithme déterministe validé sur cas nominaux et cas d'erreur avec assertions strictes.
- **Approximative** : Heuristique fonctionnelle basée sur des approximations géométriques (marquée `confidenceLevel: MEDIUM`).
- **Partielle** : Couvre les cas majeurs mais laisse de côté certains formats exotiques.
- **Stub** : Détecteur squelette retournant `NOT_VERIFIABLE` documenté.
