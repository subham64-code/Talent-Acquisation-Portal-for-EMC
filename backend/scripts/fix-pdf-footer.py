from pathlib import Path
p = Path('D:/t-a-p/emc-hr/emc-carrer/backend/src/modules/offers.ts')
s = p.read_text(encoding='utf-8')
n = 0
old = "    let pageIndex = 1;\r\n\r\n    const drawFooter = () => {\r\n"
new = "    doc.page.margins.bottom = 0;\r\n\r\n    const drawFooter = () => {\r\n"
s2 = s.replace(old, new); n += s.count(old) - s2.count(old) if False else 0
s = s2
old = "    doc.on(\"pageAdded\", drawFooter);\r\n    drawFooter();\r\n\r\n    const addPage = () => {\r\n      pageIndex += 1;\r\n      doc.addPage();\r\n      drawFooter();\r\n    };\r\n\r\n"
new = ""
removed = s.count(old)
s = s.replace(old, new)
n += removed
old = "    if (y > doc.page.height - 210) {\r\n      addPage();\r\n      y = 62;\r\n    }\r\n"
removed = s.count(old)
s = s.replace(old, "")
n += removed
old = "    doc.font(\"Helvetica-Bold\").fontSize(9).text(\"Encl.: As above\", left, y + 142);\r\n\r\n    doc.end();\r\n"
new = "    doc.font(\"Helvetica-Bold\").fontSize(9).text(\"Encl.: As above\", left, y + 142);\r\n\r\n    const pageCount = doc.bufferedPageCount;\r\n    for (let i = 0; i < pageCount; i += 1) {\r\n      doc.switchToPage(i);\r\n      drawFooter();\r\n    }\r\n\r\n    doc.end();\r\n"
removed = s.count(old)
s = s.replace(old, new)
n += removed
s = s.replace("export function buildOfferPdf", "function buildOfferPdf")
p.write_text(s, encoding='utf-8')
print('replacements', n, 'pageCount', s.count('bufferedPageCount'))
