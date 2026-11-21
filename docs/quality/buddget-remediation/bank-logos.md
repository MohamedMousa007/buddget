# Bank logos (BDG-024)

These are official bank marks. They show on the account squircle (`BrandMark`) and in the provider picker.
The files are in `public/logos/banks/<catalogue-id>.svg|png`; `src/lib/payment/bankLogos.ts` maps them.

How they were sourced (2026-11-21):

- Step 18b: the owner supplied files for 20 existing banks and six new UAE catalogue brands (`sib`, `emiratesislamic`, `ajman`, `nbf`, `emiratesinvestment`, `alhilal`). Their rows say "Supplied by the owner". They went through the same sanitiser and tile check; three were cropped to the emblem or pruned as noted.
- Three files come from the banks' own websites (`aaib`, `aalex`, `ilabank`).
- The rest come from each bank's English Wikipedia infobox logo or from a Wikimedia Commons search.
- 21 bank homepages were probed:
  - which ones: the 14 banks with no Wikipedia or Commons file, and the 7 whose file was a very wide wordmark;
  - what was read: icon links, the web manifest, `og:image`, and header SVG references;
  - what blocked the rest: several pages build their header with script, and others only offer small favicons or marketing images.
- Accepted: SVG originals, or rasters at least 512 px wide at the source.
- Nothing was upscaled, redrawn or recoloured.
- PNGs were trimmed of empty margins and capped at 512 px.
- Every SVG went through a sanitiser:
  - it rejects a DOCTYPE, entities and embedded base64 rasters;
  - it strips `script`, `foreignObject`, `image`, metadata, editor namespaces, `on*` attributes, external `href` and external `url()`;
  - `bankLogos.test.ts` checks the shipped files again.
- Every file was rendered and checked by eye: it shows the right bank and reads on white.
- Not checked: whether each mark is the bank's current one. Only the three files taken from the banks' own sites are confirmed current.
- Every file was also checked as a 44 pt tile. Wordmarks wider than 4:1 could not be read there, so they were left out (listed below).
- No SVG uses live text, so fonts cannot change how a logo renders.
- Licence notes: "Fair use" files are hosted on English Wikipedia as non-free logos. Like the website assets, they are the banks' trademarks. They are used only to identify the user's own account (nominative use), never to imply endorsement.

| Catalogue id | File | Bytes | Source file | Source URL | Licence on source | Note |
|---|---|---|---|---|---|---|
| `aaib` | `aaib.svg` | 5133 | favicon.svg (bank website) | https://www.aaib.com/images/favicon.svg | Bank website asset (trademark) | Emblem-only mark from the bank site. |
| `aalex` | `aalex.svg` | 26813 | ALEXBANK_Short_Color.svg (bank website CDN) | https://res.cloudinary.com/alex-bank/image/upload/prod/publicportal/bank-logo/ALEXBANK/SVG/ALEXBANK_Short_Color.svg | Bank website asset (trademark) | Short colour lockup from the bank site. It replaces the 10:1 Commons wordmark, which could not be read in a square tile. |
| `albarakaeg` | `albarakaeg.svg` | 7317 | File:Al Baraka Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Al_Baraka_Bank_Logo.svg | CC BY-SA 4.0 (Commons) | Al Baraka mark, used by Al Baraka Bank Egypt. |
| `albilad` | `albilad.svg` | 9399 | File:Bank Albilad Logo.svg | https://en.wikipedia.org/wiki/File:Bank_Albilad_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `alinma` | `alinma.svg` | 3010 | File:Alinma Bank Logo.svg | https://en.wikipedia.org/wiki/File:Alinma_Bank_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `alrajhi` | `alrajhi.svg` | 17524 | File:Al Rajhi Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Al_Rajhi_Bank_Logo.svg | Public domain (Commons) |  |
| `anb` | `anb.svg` | 1797 | File:Arab National Bank Logo.svg | https://en.wikipedia.org/wiki/File:Arab_National_Bank_Logo.svg | PD (English Wikipedia) |  |
| `bankdhofar` | `bankdhofar.png` | 27297 | File:BankDhofar Logo.jpg | https://commons.wikimedia.org/wiki/File:BankDhofar_Logo.jpg | CC BY-SA 4.0 (Commons) | Source: a 2480 px JPEG. White margins trimmed, resized to 512 px tall, saved as PNG. |
| `banquemisr` | `banquemisr.svg` | 118568 | File:Banque Misr.svg | https://commons.wikimedia.org/wiki/File:Banque_Misr.svg | Public domain (Commons) |  |
| `bbk` | `bbk.png` | 29763 | File:BBK Logo.png | https://commons.wikimedia.org/wiki/File:BBK_Logo.png | CC BY-SA 4.0 (Commons) | Source: a 1080 px PNG. Margins trimmed, resized to 512 px wide. |
| `boubyan` | `boubyan.svg` | 17881 | File:BoubyanBankLogo (1).svg | https://commons.wikimedia.org/wiki/File:BoubyanBankLogo_(1).svg | CC BY-SA 4.0 (Commons) |  |
| `burgan` | `burgan.svg` | 2740 | File:Burgan Bank logo.svg | https://commons.wikimedia.org/wiki/File:Burgan_Bank_logo.svg | Public domain (Commons) |  |
| `cbq` | `cbq.png` | 29555 | File:Cbq.qa-logo.png | https://commons.wikimedia.org/wiki/File:Cbq.qa-logo.png | Public domain (Commons) | Source: a 622 px PNG. Margins trimmed, resized to 512 px wide. |
| `cib` | `cib.svg` | 1744 | File:Cib Logo.svg | https://commons.wikimedia.org/wiki/File:Cib_Logo.svg | Public domain (Commons) |  |
| `d360` | `d360.svg` | 2345 | File:D360 Bank.svg | https://commons.wikimedia.org/wiki/File:D360_Bank.svg | CC BY 2.5 (Commons) |  |
| `hsbceg` | `hsbceg.svg` | 1372 | File:HSBC_logo_(2018).svg | https://commons.wikimedia.org/wiki/File:HSBC_logo_(2018).svg | Public domain (Commons) | HSBC group mark (2018), used by HSBC Egypt. |
| `ilabank` | `ilabank.png` | 11799 | icon-512x512.png (bank web manifest) | https://www.ilabank.com/icons/icon-512x512.png | Bank website asset (trademark) | App icon from the bank web manifest, 512 px. |
| `kfh` | `kfh.svg` | 5419 | File:Kuwait_Finance_House_logo.svg | https://en.wikipedia.org/wiki/File:Kuwait_Finance_House_logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `nbb` | `nbb.svg` | 6803 | File:National Bank of Bahrain Logo.svg | https://commons.wikimedia.org/wiki/File:National_Bank_of_Bahrain_Logo.svg | Public domain (Commons) |  |
| `nbe` | `nbe.svg` | 114314 | File:National Bank of Egypt.svg | https://commons.wikimedia.org/wiki/File:National_Bank_of_Egypt.svg | Public domain (Commons) |  |
| `nbk` | `nbk.svg` | 3527 | File:NBK.svg | https://commons.wikimedia.org/wiki/File:NBK.svg | Public domain (Commons) |  |
| `qib` | `qib.svg` | 61573 | File:Logo Qatar Islamic Bank.svg | https://commons.wikimedia.org/wiki/File:Logo_Qatar_Islamic_Bank.svg | Public domain (Commons) |  |
| `qnb` | `qnb.svg` | 4592 | File:QNB Logo.svg | https://commons.wikimedia.org/wiki/File:QNB_Logo.svg | Public domain (Commons) |  |
| `qnbeg` | `qnbeg.svg` | 4592 | File:QNB Logo.svg | https://commons.wikimedia.org/wiki/File:QNB_Logo.svg | Public domain (Commons) | QNB Alahli now trades as QNB, so it shares the `qnb` mark. |
| `riyadbank` | `riyadbank.svg` | 5025 | File:Riyad Bank Logo.svg | https://en.wikipedia.org/wiki/File:Riyad_Bank_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `sabb` | `sabb.svg` | 3308 | File:SAB logo (since 2023).svg | https://commons.wikimedia.org/wiki/File:SAB_logo_(since_2023).svg | Public domain (Commons) | Current SAB (Saudi Awwal Bank) mark. SABB was renamed in 2023; the catalogue name is still "SABB". |
| `snb` | `snb.svg` | 33537 | File:Saudi National Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Saudi_National_Bank_Logo.svg | Public domain (Commons) |  |
| `adcb` | `adcb.svg` | 24381 | ADCB.svg | — | Supplied by the owner (2026-11-21) | Replaces the Commons file. The source carried an unused 2404×1803 base64 PNG in `<defs>` (3.2 MB); the sanitiser dropped it, the vector paths are the logo. |
| `adib` | `adib.png` | 45171 | ADIB.jpeg | — | Supplied by the owner (2026-11-21) | 375 px JPEG saved as PNG, resized to 256 px. |
| `adibeg` | `adib.png` | 45171 | ADIB.jpeg (same file) | — | Supplied by the owner (2026-11-21) | Shares `adib.png`: ADIB Egypt uses the ADIB mark. |
| `bisb` | `bisb.png` | 31177 | Bahrain Islamic Bank (BisB).png | — | Supplied by the owner (2026-11-21) | 1024 px PNG resized to 512 px. |
| `dib` | `dib.png` | 24116 | DIB.png | — | Supplied by the owner (2026-11-21) | 270×88, kept as supplied (3.1:1). |
| `dohabank` | `dohabank.png` | 15564 | Doha bank.png | — | Supplied by the owner (2026-11-21) | 300×84, kept as supplied (3.6:1). |
| `emiratesislamic` | `emiratesislamic.svg` | 901 | emiarates islamic bank.svg | — | Supplied by the owner (2026-11-21) | New catalogue brand. Cropped to the "EI" emblem: the full lockup is 6.2:1 and cannot be read in the tile. |
| `enbd` | `enbd.svg` | 4483 | NBD UAE.zip → Emirates_NBD_id2C-FiT09_0.svg | — | Supplied by the owner (2026-11-21) | Replaces `enbd.png`. The zip also held an 800×210 PNG of the same mark; the SVG was used. |
| `fab` | `fab.svg` | 29410 | FAB UAE .svg | — | Supplied by the owner (2026-11-21) | Replaces the Commons file. 248 of 251 unreferenced glyph `<symbol>`s pruned (199 KB → 29 KB). |
| `faisaleg` | `faisaleg.svg` | 35043 | Faisal islamic bank logo.svg | — | Supplied by the owner (2026-11-21) |  |
| `liv` | `liv.png` | 37797 | liv-logo-festivel.png | — | Supplied by the owner (2026-11-21) | 773×540 PNG resized to 512 px. Yellow on white: check legibility on device. |
| `mashreq` | `mashreq.png` | 47623 | MAshreq.jpeg | — | Supplied by the owner (2026-11-21) | 400 px JPEG saved as PNG, resized to 256 px. The supplied image carries a UAE flag ribbon (national-day art). |
| `nbo` | `nbo.png` | 39485 | NBO.jpeg | — | Supplied by the owner (2026-11-21) | 400 px JPEG saved as PNG, resized to 256 px. |
| `rakbank` | `rakbank.png` | 1906 | RAKbank.png | — | Supplied by the owner (2026-11-21) | Cropped to the red emblem (243×243): the wordmark is white on transparent (invisible on the white tile) and the lockup is 6.5:1. |
| `sib` | `sib.png` | 59226 | Sharjah islamic bank.jpeg | — | Supplied by the owner (2026-11-21) | New catalogue brand. 400 px JPEG saved as PNG, resized to 256 px. |
| `wio` | `wio.png` | 6932 | Wio Bank.png | — | Supplied by the owner (2026-11-21) | 300 px, kept as supplied. |
| `gulfbank` | `gulfbank.png` | 27082 | Gulf bank.png | — | Supplied by the owner (2026-11-21) | 600 px square JPEG-in-PNG; white margins trimmed, 512×107 (4.8:1, wide). |
| `cbd` | `cbd.png` | 34528 | Commercial-Bank-of-Dubai.png | — | Supplied by the owner (2026-11-21) | 2884×610; margins trimmed, resized to 512×124 (4.1:1, wide). |
| `aljazira` | `aljazira.png` | 21037 | Bank Aljazira.jpeg | — | Supplied by the owner (2026-11-21) | 200 px JPEG saved as PNG, not upscaled. Full-bleed dark tile. |
| `banqueducaire` | `banqueducaire.png` | 28578 | Banque_du_caire_Logo.svg.webp | — | Supplied by the owner (2026-11-21) | WebP (1920×457) converted to PNG, margins trimmed, 512×137. |
| `bankmuscat` | `bankmuscat.svg` | 26223 | Bank Muscat.svg | — | Supplied by the owner (2026-11-21) | Sanitised SVG, 4.1:1 (wide). |
| `ajman` | `ajman.png` | 43139 | Ajman-Bank.png | — | Supplied by the owner (2026-11-21) | New catalogue brand. 1903×665; margins trimmed, 512×192. |
| `nbf` | `nbf.png` | 57402 | National-Bank-of-Fujairah-(NBF).png | — | Supplied by the owner (2026-11-21) | New catalogue brand. 2379×1833; margins trimmed, 512×400. |
| `emiratesinvestment` | `emiratesinvestment.png` | 38095 | Emirates-Investment-Bank.png | — | Supplied by the owner (2026-11-21) | New catalogue brand. 3232×2002; margins trimmed, 512×325. |
| `alhilal` | `alhilal.png` | 32981 | Al-Hilal-Bank.png | — | Supplied by the owner (2026-11-21) | New catalogue brand (part of ADCB, kept separate at the owner's request). 2648×670; margins trimmed, 512×144. |

## Official file found but too wide for the square tile

None left: the owner supplied files for all five in step 18b (rows above). Gulf Bank (4.8:1), CBD (4.1:1) and Bank Muscat (4.1:1) are still wide lockups; they ship because the owner supplied them, and they read mainly by their emblem.

## Skipped (no usable file; these keep today's monogram)

| Catalogue id | Bank | Why |
|---|---|---|
| `weyay` | Weyay | The owner supplied `weyay-logo-new-en-resized.svg` (step 18b), but it is the light-on-dark variant: wordmark `#eeebe5` and part of the emblem are near-invisible on the white tile, and recolouring is not allowed. Needs a dark-on-light file. |

Wallets, BNPL brands and card schemes are catalogue brands, so they are in scope. This pass did not cover them; it covered the `bank_account` brands (53 after step 18b; Zand was removed from the catalogue). BNPL provider logos already live in `public/providers/` (`ProviderBadge`).

To add a bank:
1. Put an official SVG, or a PNG of at least 512 px, at `public/logos/banks/<id>.svg|png`.
2. Sanitise it as described above.
3. Add the id to `BANK_LOGO_FILES`.
4. Add a row to this file.
