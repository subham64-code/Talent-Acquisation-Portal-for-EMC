from pathlib import Path

offers = Path("src/modules/offers.ts")
template = Path("scripts/offer-pdf-template.ts")
text = offers.read_text(encoding="utf-8")
start = text.index("function buildOfferPdf")
end = text.index('router.get(', start)
new = template.read_text(encoding="utf-8")
text = text[:start] + new + text[end:]
offers.write_text(text, encoding="utf-8")
template.unlink()
print("Offer PDF builder replaced with professional corporate template")
