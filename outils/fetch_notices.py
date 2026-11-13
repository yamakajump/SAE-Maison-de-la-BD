# Construit un jeu de notices réelles depuis Open Library, à partir d'une liste d'ISBN.
import json, sys, urllib.request

ISBNS = """9782800117911 9782800121277 9782800129815 9782505019930 9782505061632 9782505063520
9782203340220 9782203340060 9782205049671 9782205049695 9782800100241 9782800100913 9782800100937
9782800121017 9782800106878 9782205069181 9782803604074 9782803605156 9782205037531 9782884710305""".split()

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "maison-bd-prototype/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""

author_cache = {}
def author_name(key):
    if key not in author_cache:
        st, body = get(f"https://openlibrary.org{key}.json")
        author_cache[key] = json.loads(body).get("name") if st == 200 else None
    return author_cache[key]

out = []
for isbn in ISBNS:
    st, body = get(f"https://openlibrary.org/isbn/{isbn}.json")
    if st != 200:
        print("absent", isbn, file=sys.stderr); continue
    ed = json.loads(body)
    authors = [author_name(a["key"]) for a in ed.get("authors", [])]
    if not authors and ed.get("works"):
        _, wb = get(f"https://openlibrary.org{ed['works'][0]['key']}.json")
        w = json.loads(wb)
        authors = [author_name(a["author"]["key"]) for a in w.get("authors", [])]
    cst, _ = get(f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false")
    out.append({
        "isbn": isbn,
        "title": ed.get("title"),
        "subtitle": ed.get("subtitle"),
        "series": ed.get("series"),
        "authors": [a for a in authors if a],
        "publishers": ed.get("publishers"),
        "publish_date": ed.get("publish_date"),
        "pages": ed.get("number_of_pages"),
        "has_cover": cst == 200,
    })
    print(json.dumps(out[-1], ensure_ascii=False), file=sys.stderr)

json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
