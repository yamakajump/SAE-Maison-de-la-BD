# Capture chaque écran du prototype en 1366 x 768 (l'écran de Martine).
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/"
OUT = Path(__file__).parent / "captures"
OUT.mkdir(exist_ok=True)

def shot(page, name, full=True, wait=1500):
    page.wait_for_timeout(wait)  # laisse charger les couvertures
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("ok", name)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/")
    page.evaluate("localStorage.clear(); localStorage.setItem('mbd-proto-v5', JSON.stringify({...seedState(), userId: null}))")
    page.reload()

    # Public : sans connexion
    shot(page, "01-accueil-public")
    page.fill(".search input", "tor gal")
    shot(page, "02-suggestions", full=False)
    for i, q in enumerate(["Gaston des années 70", "thorgal 5", "ligne claire", "Van Hamme"], 3):
        page.goto(BASE + "#/recherche?q=" + quote(q))
        shot(page, f"0{i}-recherche-{q.split()[0].lower()}")
    page.goto(BASE + "#/recherche?theme=sf")
    shot(page, "06b-theme-sf", full=False)
    page.goto(BASE + "#/recherche?q=xyzzy")
    shot(page, "07-aucun-resultat", full=False)
    page.goto(BASE + "#/notice/1")
    shot(page, "08-notice-album-public")
    page.goto(BASE + "#/notice/20?q=ligne%20claire")
    shot(page, "09-notice-revue")

    # Connexion
    page.goto(BASE + "#/")
    page.click("#login")
    shot(page, "10-connexion", full=False, wait=400)
    page.click("[data-uid='1']")
    shot(page, "11-accueil-equipe")
    page.goto(BASE + "#/notice/1")
    shot(page, "12-notice-equipe", full=False)

    page.goto(BASE + "#/scan")
    shot(page, "13-scan-vide", full=False, wait=500)
    dup = page.evaluate("state.notices[0].isbn")
    for code in ["9782800100951", dup, "9782205049718"]:
        page.keyboard.type(code)
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
    page.wait_for_timeout(6000)
    shot(page, "14-scan-file", full=False)
    page.click(".qcard [data-edit]")
    shot(page, "15-scan-completer", full=False, wait=900)
    page.click("body", position={"x": 5, "y": 400})
    shot(page, "16-scan-pause", full=False, wait=300)

    page.goto(BASE + "#/completer")
    shot(page, "17-a-completer", full=False)
    page.goto(BASE + "#/notice/nouvelle?type=revue")
    shot(page, "18-nouvelle-revue")
    page.goto(BASE + "#/comptes")
    shot(page, "19-comptes", full=False)

    # Thème sombre, par le bouton de l'en-tête
    page.goto(BASE + "#/")
    page.click("#theme")
    shot(page, "20-accueil-sombre")
    page.goto(BASE + "#/notice/20?q=ligne%20claire")
    shot(page, "21-notice-sombre", full=False)
    page.goto(BASE + "#/recherche?q=thorgal")
    shot(page, "22-recherche-sombre", full=False)
    page.click("#theme")

    print("erreurs JS :", errors or "aucune")
    browser.close()
