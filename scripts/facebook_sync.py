#!/usr/bin/env python3
"""
Sincroniza la Página de Facebook de la Plataforma con la página web.

Lee las publicaciones con la Graph API de Meta, descarga las fotos a img/fb-auto/
(las direcciones de fotos de Facebook caducan) y guarda todo en data/facebook.json.
El archivo acumula el historial: las publicaciones viejas no se borran.

Variables de entorno (se configuran como "secretos" en GitHub):
  FB_PAGE_TOKEN  -> token de acceso de la Página (obligatorio)
  FB_PAGE_ID     -> ID de la Página (por defecto 536756083334696)
  GRAPH_VERSION  -> versión de la Graph API (por defecto v27.0)
  FB_DESDE       -> en la primera carga, traer publicaciones desde esta fecha (por defecto 2026-01-01)
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "facebook.json")
IMGDIR = os.path.join(ROOT, "img", "fb-auto")
TOKEN = os.environ.get("FB_PAGE_TOKEN", "").strip()
PAGE = os.environ.get("FB_PAGE_ID", "536756083334696").strip()
VER = os.environ.get("GRAPH_VERSION", "v27.0").strip()
BASE = os.environ.get("GRAPH_BASE", "https://graph.facebook.com").rstrip("/")
DESDE = os.environ.get("FB_DESDE", "2026-01-01").strip()
MAX_FOTOS = 10

FIELDS = ("id,message,created_time,permalink_url,full_picture,status_type,"
          "attachments{type,media_type,media,url,title,description,"
          "subattachments.limit(20){type,media_type,media,url}}")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "pmj-riosucio-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def bajar(url, destino):
    if os.path.exists(destino):
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pmj-riosucio-sync"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if len(data) < 1000:
            return False
        with open(destino, "wb") as f:
            f.write(data)
        return True
    except Exception as e:
        print("  no se pudo bajar una foto:", e)
        return False


def fotos_de(post):
    urls = []
    for att in (post.get("attachments") or {}).get("data", []):
        subs = (att.get("subattachments") or {}).get("data", [])
        for s in (subs or [att]):
            img = ((s.get("media") or {}).get("image") or {}).get("src")
            if img and img not in urls:
                urls.append(img)
    if not urls and post.get("full_picture"):
        urls.append(post["full_picture"])
    return urls[:MAX_FOTOS]


def main():
    if not TOKEN:
        print("Falta FB_PAGE_TOKEN. Configúralo en GitHub > Settings > Secrets and variables > Actions.")
        sys.exit(1)
    os.makedirs(IMGDIR, exist_ok=True)
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    try:
        actual = json.load(open(DATA, encoding="utf-8"))
    except Exception:
        actual = {"posts": []}
    por_id = {p["id"]: p for p in actual.get("posts", [])}
    primera_vez = not por_id

    params = {"fields": FIELDS, "limit": 25, "access_token": TOKEN}
    url = f"{BASE}/{VER}/{PAGE}/posts?" + urllib.parse.urlencode(params)
    nuevos, paginas = 0, 0
    while url and paginas < (20 if primera_vez else 2):
        paginas += 1
        try:
            res = get(url)
        except urllib.error.HTTPError as e:
            print("Error de la Graph API:", e.code, e.read().decode("utf-8", "ignore")[:500])
            sys.exit(1)
        parar = False
        for p in res.get("data", []):
            if p.get("created_time", "") < DESDE:
                parar = True
                break
            texto = p.get("message") or ""
            fotos = fotos_de(p)
            locales = []
            for i, u in enumerate(fotos):
                nombre = f"{p['id'].replace('_', '-')}-{i}.jpg"
                if bajar(u, os.path.join(IMGDIR, nombre)):
                    locales.append(f"img/fb-auto/{nombre}")
            if not texto and not locales:
                continue
            if p["id"] not in por_id:
                nuevos += 1
            por_id[p["id"]] = {
                "id": p["id"],
                "timestamp": p.get("created_time"),
                "permalink": p.get("permalink_url") or f"https://www.facebook.com/{p['id']}",
                "caption": texto,
                "hashtags": re.findall(r"#([\wÀ-ɏ]+)", texto),
                "images": locales,
                "tipo": p.get("status_type", ""),
            }
        url = None if parar else (res.get("paging") or {}).get("next")
        time.sleep(0.5)

    posts = sorted(por_id.values(), key=lambda x: x.get("timestamp") or "", reverse=True)
    salida = {"fuente": "Facebook", "pagina": PAGE,
              "actualizado": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "posts": posts}
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f"Listo: {nuevos} publicaciones nuevas, {len(posts)} en total.")


if __name__ == "__main__":
    main()
