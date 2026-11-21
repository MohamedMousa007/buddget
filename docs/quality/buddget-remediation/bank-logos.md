# Bank logos (BDG-024)

These are official bank marks. They show on the account squircle (`BrandMark`) and in the provider picker.
The files are in `public/logos/banks/<catalogue-id>.svg|png`; `src/lib/payment/bankLogos.ts` maps them.

How they were sourced (2026-11-21):

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
| `adcb` | `adcb.svg` | 28954 | File:Abu Dhabi Commercial Bank logo.svg | https://commons.wikimedia.org/wiki/File:Abu_Dhabi_Commercial_Bank_logo.svg | Public domain (Commons) |  |
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
| `enbd` | `enbd.png` | 42583 | File:Lg-67a9470992e1d-Emirates-NBD.png | https://en.wikipedia.org/wiki/File:Lg-67a9470992e1d-Emirates-NBD.png | Fair use (English Wikipedia, non-free logo) | Source: a 574 px PNG. Margins trimmed, resized to 512 px wide. |
| `fab` | `fab.svg` | 20915 | File:First Abu Dhabi Bank Logo.svg | https://commons.wikimedia.org/wiki/File:First_Abu_Dhabi_Bank_Logo.svg | Public domain (Commons) |  |
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

## Official file found but too wide for the square tile

These are not shipped and keep the monogram. Each needs an emblem-only official file, or the owner's decision to crop to the emblem.

| Catalogue id | Source URL | Licence on source |
|---|---|---|
| `aljazira` | https://commons.wikimedia.org/wiki/File:Bank_Aljazira_New_Logo.png | CC BY-SA 4.0 (Commons) |
| `bankmuscat` | https://en.wikipedia.org/wiki/File:Bank_Muscat_logo.svg | Fair use (English Wikipedia, non-free logo) |
| `banqueducaire` | https://commons.wikimedia.org/wiki/File:Banque_du_caire_Logo.svg | Public domain (Commons) |
| `cbd` | https://en.wikipedia.org/wiki/File:Commercial_Bank_of_Dubai_logo.svg | Fair use (English Wikipedia, non-free logo) |
| `gulfbank` | https://commons.wikimedia.org/wiki/File:Gulf_Bank_Logo.svg | Public domain (Commons) |
| `mashreq` | https://en.wikipedia.org/wiki/File:Mashreq_logo_2022.svg | PD (English Wikipedia) |

## Skipped (no usable file; these keep today's monogram)

| Catalogue id | Bank | Why |
|---|---|---|
| `faisaleg` | Faisal Islamic Bank of Egypt | Only a 120 px raster. The Commons hit is the Sudan bank, a different entity. The site offers no logo. |
| `adibeg` | ADIB Egypt | The only ADIB SVG wraps an embedded raster, so it was rejected. |
| `adib` | ADIB | Same file as `adibeg`, rejected. The site exposes no logo file. |
| `dib` | Dubai Islamic Bank | Only a 397 px raster. The site offers only a 50th-anniversary social image. |
| `rakbank` | RAKBANK | Only a GIF of the old "Simply Better" lockup. The site exposes no logo file. |
| `liv` | Liv | The logo URL on its site returns an HTML page to scripts. |
| `wio` | Wio Bank | The site offers only a small icon and a marketing image. |
| `zand` | Zand | The site offers only a 96 px favicon and a marketing image. |
| `weyay` | Weyay | No file on Commons; the site did not respond. |
| `dohabank` | Doha Bank | No file on Commons; the site did not respond. |
| `bisb` | Bahrain Islamic Bank | The logo URL on its site returns an HTML page to scripts. |
| `nbo` | National Bank of Oman | Only a 172 px GIF on Commons and 192 px icons on the site. |

Wallets, BNPL brands and card schemes are catalogue brands, so they are in scope. This pass did not cover them; it covered the 48 `bank_account` brands. BNPL provider logos already live in `public/providers/` (`ProviderBadge`).

To add a bank:
1. Put an official SVG, or a PNG of at least 512 px, at `public/logos/banks/<id>.svg|png`.
2. Sanitise it as described above.
3. Add the id to `BANK_LOGO_FILES`.
4. Add a row to this file.
