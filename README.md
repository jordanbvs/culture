# Culture — recommandations culturelles de Jordan

Page unique, sans build : `index.html` + `css/style.css` + `js/app.js` lisent `data.json` au chargement (en `no-store`, donc toute modification est visible au simple rechargement).

## Lancer
    cd /workspace/culture/site && nohup python3 -m http.server 8787 > /workspace/_tmp/culture-server.log 2>&1 &
    → http://localhost:8787/   (aperçu de l'état vide : http://localhost:8787/?vide , fiche directe : #<id>)

## Format d'un élément (`data.json` = tableau)
| champ | valeur |
|---|---|
| id | slug unique (= nom de l'image) |
| category | film · serie · livre · musique · podcast · expo · spectacle · jeu · lieu · site · nourriture · autre |
| title, creator, year | texte, texte, entier |
| description | 1–2 phrases en français |
| image | chemin relatif `images/<slug>.<ext>` (fichier dans `images/`) ou null |
| recommended_by | personne ou source |
| date_added | AAAA-MM-JJ |
| status | `à découvrir` · `en cours` · `découvert` |
| rating | 1–5, seulement si `découvert`, sinon null |
| tags | tableau de chaînes |
| link | URL facultative |

## Ajouter / retirer (recommandé : le script, stdlib uniquement)
    python3 add_item.py add --category film --title "Titre" --creator "Réalisateur" --year 2025 \
        --description "Une ou deux phrases." --recommended-by "Léa" \
        --tags "tag1,tag2" --link "https://…" --wiki "en:Titre de la page Wikipédia"
    # image : --wiki "fr:Page" (prend l'image de l'infobox) | --image-url URL | --image-file images/x.jpg
    # options : --status "en cours" --rating 4 --date 2026-10-11 --id slug-perso
    python3 add_item.py list
    python3 add_item.py remove <id>        # retire l'entrée et son image
    python3 add_item.py wipe               # vide data.json et images/ (supprimer le jeu de démo)

Procédure manuelle équivalente : télécharger l'image dans `images/<slug>.jpg` (curl avec un User-Agent explicite pour Wikimedia), puis ajouter l'objet à la fin du tableau de `data.json`. L'ordre du fichier n'a pas d'importance (tri par date ou alphabétique dans l'interface). Les catégories sans élément n'apparaissent pas dans les filtres ; une image manquante est remplacée par une initiale typographique.

## Captures
    python3 screenshots/shoot.py   # nécessite le serveur sur 8787 et playwright (pip)

## Application installable (PWA)
- `manifest.webmanifest` (nom « Culture. », `start_url`/`scope` = `./`, standalone, couleurs papier `#F3EFE6`).
- `sw.js` : coquille (HTML/CSS/JS/icônes) précachée ; `data.json` et `images/` en réseau d'abord avec repli cache (une nouvelle reco apparaît immédiatement) ; polices Google mises en cache.
  **Après toute modification de CSS/JS/HTML/icônes, incrémenter `VERSION` dans `sw.js`** (sinon les visiteurs gardent l'ancienne coquille). Ajouter des recos ne nécessite rien.
- Icônes : `python3 tools/make_icons.py` (Pillow + Instrument Serif TTF, chemin via `CULTURE_FONT`) → `icons/`.
- Bandeau d'installation : automatique sur Chrome/Android/desktop (`beforeinstallprompt`), indice unique sur Safari iOS. Refus mémorisé dans `localStorage` (`culture:install-dismissed`).
  Aperçu forcé : `?install-demo` (Chrome) ou `?install-demo=ios`.
