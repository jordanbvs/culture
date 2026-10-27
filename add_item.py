#!/usr/bin/env python3
"""
add_item.py — ajouter / retirer une recommandation dans data.json.

Exemples :
  python3 add_item.py add --category film --title "Anatomie d'une chute" \
      --creator "Justine Triet" --year 2023 --recommended-by "Léa" \
      --description "Un procès qui dissèque un couple." \
      --wiki "en:Anatomy of a Fall" --tags "Palme d'or,thriller"

  python3 add_item.py add ... --image-url https://upload.wikimedia.org/...jpg
  python3 add_item.py remove anatomie-d-une-chute
  python3 add_item.py list
  python3 add_item.py wipe            # vide data.json et images/ (repartir de zéro)

Sans dépendance externe (stdlib uniquement).
"""
import argparse, datetime as dt, json, os, re, sys, unicodedata, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data.json")
IMG_DIR = os.path.join(ROOT, "images")
UA = {"User-Agent": "RecosCatalog/1.0 (https://github.com/jbeauvais/recos; personal non-commercial use) python-urllib"}
CATEGORIES = ["film", "serie", "livre", "musique", "podcast", "expo", "spectacle", "jeu", "lieu", "site", "nourriture", "autre"]
STATUSES = ["à découvrir", "en cours", "découvert"]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "item"


def load():
    if not os.path.exists(DATA):
        return []
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def save(items):
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)


def _api(lang, **p):
    p["format"] = "json"
    return json.load(_get(f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(p)))


def _file_thumb(lang, filename, width=900):
    d = _api(lang, action="query", titles="File:" + filename, prop="imageinfo", iiprop="url", iiurlwidth=width)
    for p in d["query"]["pages"].values():
        ii = p.get("imageinfo")
        if ii:
            return ii[0].get("thumburl") or ii[0]["url"]


def resolve_wiki_image(spec):
    """'en:Anatomy of a Fall' -> URL de l'affiche/couverture (image de l'infobox)."""
    lang, title = spec.split(":", 1) if ":" in spec[:4] else ("en", spec)
    d = _api(lang, action="parse", page=title, prop="wikitext", redirects=1)
    wt = d["parse"]["wikitext"]["*"]
    m = re.search(r"\|\s*(?:image|cover|logo|image_file)\s*=\s*(?:\[\[)?(?:File:|Fichier:|Image:)?"
                  r"([^|\n\]]+\.(?:jpe?g|png|gif|svg|webp))", wt, re.I)
    if m:
        url = _file_thumb(lang, m.group(1).strip())
        if url:
            return url
    d = _api(lang, action="query", titles=title, prop="pageimages", piprop="name", redirects=1)
    for p in d["query"]["pages"].values():
        if p.get("pageimage"):
            return _file_thumb(lang, p["pageimage"])
    raise SystemExit(f"Aucune image trouvée pour {spec!r} — utilisez --image-url.")


def download(url, slug):
    path = urllib.parse.urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    os.makedirs(IMG_DIR, exist_ok=True)
    dest = os.path.join(IMG_DIR, slug + ext)
    url = url.split("?")[0]
    with _get(url) as r, open(dest, "wb") as f:
        f.write(r.read())
    return "images/" + slug + ext


def cmd_add(a):
    items = load()
    slug = a.id or slugify(a.title)
    if any(i["id"] == slug for i in items):
        raise SystemExit(f"L'id {slug!r} existe déjà.")
    image = None
    if a.image_file:
        image = a.image_file
    elif a.image_url:
        image = download(a.image_url, slug)
    elif a.wiki:
        image = download(resolve_wiki_image(a.wiki), slug)
    item = {
        "id": slug,
        "category": a.category,
        "title": a.title,
        "creator": a.creator,
        "year": a.year,
        "description": a.description,
        "image": image,
        "recommended_by": a.recommended_by,
        "date_added": a.date or dt.date.today().isoformat(),
        "status": a.status,
        "rating": a.rating if a.status == "découvert" else None,
        "tags": [t.strip() for t in (a.tags or "").split(",") if t.strip()],
        "link": a.link,
    }
    items.append(item)
    save(items)
    print(f"✓ ajouté : {slug} ({image or 'sans image'})")


def cmd_remove(a):
    items = load()
    keep = [i for i in items if i["id"] != a.id]
    if len(keep) == len(items):
        raise SystemExit(f"Id introuvable : {a.id}")
    for i in items:
        if i["id"] == a.id and i.get("image") and os.path.exists(os.path.join(ROOT, i["image"])):
            os.remove(os.path.join(ROOT, i["image"]))
    save(keep)
    print(f"✓ retiré : {a.id}")


def cmd_list(a):
    for i in load():
        print(f"{i['date_added']}  {i['category']:<10} {i['status']:<12} {i['id']}")


def cmd_wipe(a):
    save([])
    for f in os.listdir(IMG_DIR):
        os.remove(os.path.join(IMG_DIR, f))
    print("✓ data.json vidé, images/ vidé")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    ad = sub.add_parser("add")
    ad.add_argument("--category", required=True, choices=CATEGORIES)
    ad.add_argument("--title", required=True)
    ad.add_argument("--creator", default="")
    ad.add_argument("--year", type=int)
    ad.add_argument("--description", default="")
    ad.add_argument("--recommended-by", default="")
    ad.add_argument("--status", default="à découvrir", choices=STATUSES)
    ad.add_argument("--rating", type=int, choices=[1, 2, 3, 4, 5])
    ad.add_argument("--tags", help="séparés par des virgules")
    ad.add_argument("--link")
    ad.add_argument("--date", help="AAAA-MM-JJ (défaut : aujourd'hui)")
    ad.add_argument("--id", help="slug personnalisé")
    g = ad.add_mutually_exclusive_group()
    g.add_argument("--wiki", help="'en:Titre de page' — récupère l'image de l'infobox Wikipédia")
    g.add_argument("--image-url")
    g.add_argument("--image-file", help="chemin relatif déjà présent, ex. images/foo.jpg")
    ad.set_defaults(fn=cmd_add)
    rm = sub.add_parser("remove"); rm.add_argument("id"); rm.set_defaults(fn=cmd_remove)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    sub.add_parser("wipe").set_defaults(fn=cmd_wipe)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
