# Glossaire Métier Prépresse & Imprimerie — Check MyFile

Guide terminologique et technique à l'usage des concepteurs graphiques, développeurs et professionnels de l'impression.

---

### A
- **Aplatissement des transparences (Transparency Flattening)** : Opération prépresse consistant à convertir les éléments vectoriels translucides, modes de fusion et ombres portées en une mosaïque d'éléments opaques (vectoriels ou rasterisés) pour les RIPs ne gérant pas le modèle de transparence natif PDF 1.4+.

### B
- **BleedBox (Boîte de fond perdu)** : Zone rectangulaire PDF délimitant les contours du document incluant la réserve de fond perdu requise pour la découpe. En production conforme, la BleedBox doit être strictement plus grande que la TrimBox.
- **Balisage (Tagging)** : Présence explicite d'une clé de boîte de page (`/TrimBox`, `/BleedBox`) dans le dictionnaire d'une page PDF, évitant aux logiciels d'imposition de devoir deviner les dimensions du produit fini.

### C
- **Chasse au massicot (Creep / Shingling)** : Déplacement mécanique progressif des pages intérieures vers l'extérieur d'un cahier plié en brochure agrafée, nécessitant une marge de sécurité intérieure plus large (ex: 12 mm au lieu de 10 mm).
- **CIDFont / Type0** : Format de police composite PDF conçu pour gérer les jeux de caractères étendus (Unicode, idéogrammes asiatiques, polices OpenType complexes). Le descripteur de police réel se trouve dans le sous-dictionnaire `/DescendantFonts`.
- **CropBox (Boîte de visualisation)** : Zone d'affichage par défaut dans les visionneuses PDF grand public (Acrobat Reader). Elle ne constitue pas une référence technique fiable pour l'imposition.

### F
- **Façonnage** : Ensemble des opérations physiques suivant l'impression : pliage, massicotage, assemblage, reliure, agrafage.
- **Filet maigre (Hairline)** : Ligne ou contour vectoriel excessivement fin (inférieur à 0.25 pt ou 0.08 mm). À l'impression offset, un filet maigre ne retient pas assez d'encre sur la plaque et risque de disparaître totalement sur le papier.
- **Fond perdu (Bleed)** : Prolongation de la matière graphique (fonds colorés, visuels, photographies) au-delà de la ligne de coupe finale (TrimBox). Le standard d'atelier est généralement de 3 mm à 5 mm par bord.

### G
- **Ghent Workgroup (GWG)** : Consortium international d'experts prépresse établissant les spécifications de contrôle qualité et de conformité des fichiers PDF destinés à l'industrie graphique mondiale.

### I
- **Imposition** : Agencement géométrique des pages d'un document sur une grande feuille d'impression (plaque offset ou feuille de presse) de façon à ce que les pages se retrouvent dans l'ordre après pliage et coupe.
- **Incorporation des polices (Font Embedding)** : Inclusion du fichier binaire de la police dans le document PDF. Évite que le RIP ne substitue une police locale différente lors du traitement.
- **ISO 12647-2** : Norme internationale spécifiant les paramètres du procédé d'impression offset feuille et rotative (engraissement de point, repérage, colorimétrie).
- **ISO 15930 (Famille PDF/X)** : Norme ISO régissant les échanges de données prépresse (PDF/X-1a, PDF/X-3, PDF/X-4).

### M
- **Massicot** : Machine industrielle de découpe papier équipée d'une lame tranchante sous pression. Les tolérances mécaniques de massicotage varient couramment de $\pm 0.5\text{ mm}$ à $\pm 1.5\text{ mm}$, justifiant l'obligation de fond perdu et de marge de sécurité.
- **MediaBox (Boîte de support)** : Plus grande boîte d'une page PDF, représentant le format physique brut de la feuille ou du canevas d'export.

### P
- **PDF/X-1a** : Standard d'échange prépresse strict (ISO 15930-1) imposant la quadrichromie CMJN / tons directs et interdisant formellement les transparences actives (obligation d'aplatissement).
- **PDF/X-4** : Standard d'échange moderne (ISO 15930-7) acceptant nativement les transparences, les calques et la gestion avancée des profils ICC couleur.
- **Points typographiques (pt)** : Unité de mesure standard en PAO et dans la spécification PDF : $1\text{ pt} = \frac{1}{72}\text{ pouce} \approx 0.3528\text{ mm}$.

### R
- **RIP (Raster Image Processor)** : Moteur matériel ou logiciel de l'imprimante convertissant les données vectorielles, typographiques et images du fichier PDF en une trame de points matricielle haute résolution pour chaque séparation de couleur.

### S
- **Sous-ensemble de police (Font Subset)** : Incorporation exclusive des glyphes réellement utilisés dans le document, préfixée selon la norme PDF par 6 lettres capitales aléatoires et un signe plus (ex: `ABCDEF+Helvetica`). Ce format allège le document et garantit qu'aucune modification non autorisée ne sera apportée.
- **Standard 14 (Base 14 Fonts)** : Les 14 polices historiques PostScript (Times, Helvetica, Courier, Symbol, Zapf Dingbats) qui étaient préinstallées dans les RIPs d'époque. Dans les flux modernes, leur incorporation reste fortement recommandée pour éviter les écarts d'interlettrage.

### T
- **TrimBox (Boîte de rognage / coupe)** : Boîte PDF officielle délimitant les dimensions exactes du produit imprimé après découpe finale. C'est la référence géométrique absolue d'imposition.

### Z
- **Zone tranquille (Marge de sécurité)** : Espace intérieur longeant la ligne de coupe dans lequel aucun élément informatif vital ne doit être placé. Sa largeur dépend du produit (ex: 3 mm pour une carte de visite, 10 mm pour un flyer A4, 12 mm pour une brochure).
