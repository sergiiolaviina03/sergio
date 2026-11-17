// Renderiza niza.html → Niza_20-23_noviembre_2026.pdf (+ capturas opcionales)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'niza.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, 'Niza_20-23_noviembre_2026.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (process.argv[2]) {
    await p.emulateMedia({ media: 'print' });
    await p.setViewportSize({ width: 794, height: 1123 });
    const pages = await p.$$('section.page');
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(process.argv[2], `p${i + 1}.png`) });
  }
  await b.close();
})();
