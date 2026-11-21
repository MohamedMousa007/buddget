# Bank logos (BDG-024)

Official bank marks shown on the account squircle (`BrandMark`) and in the provider picker. The files are in `public/logos/banks/<catalogue-id>.svg|png`, and `src/lib/payment/bankLogos.ts` maps them.

How they were sourced (2026-11-21):
- Each bank's English Wikipedia infobox logo was checked first, then a Wikimedia Commons search. Every file below comes from one of those two.
- Bank websites were tried where practical. The ones checked build their header with script and returned no logo in the HTML.
- Accepted: SVG originals, or rasters at least 512 px wide at source. Nothing was upscaled, redrawn or recoloured. PNGs were trimmed of empty margins and capped at 512 px.
- Every SVG went through a sanitiser:
  - It rejects a DOCTYPE, entities and embedded base64 rasters.
  - It strips `script`, `foreignObject`, `image`, metadata, editor namespaces, `on*` attributes, external `href` and external `url()`.
  - `bankLogos.test.ts` checks the shipped files again.
- Every file was rendered and checked by eye: the right bank, the current mark, readable on white.
- Licence notes: "Fair use" files are hosted on English Wikipedia as non-free logos. They are the banks' trademarks and are used here only to identify the user's own account (nominative use). They are not shown to imply endorsement.

| Catalogue id | File | Bytes | Source file | Source URL | Licence on source | Note |
|---|---|---|---|---|---|---|
| `aalex` | `aalex.svg` | 72366 | File:Alex Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Alex_Bank_Logo.svg | Public domain (Commons) |  |
| `adcb` | `adcb.svg` | 28954 | File:Abu Dhabi Commercial Bank logo.svg | https://commons.wikimedia.org/wiki/File:Abu_Dhabi_Commercial_Bank_logo.svg | Public domain (Commons) |  |
| `albarakaeg` | `albarakaeg.svg` | 7317 | File:Al Baraka Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Al_Baraka_Bank_Logo.svg | CC BY-SA 4.0 (Commons) | Al Baraka mark, used by Al Baraka Bank Egypt. |
| `albilad` | `albilad.svg` | 9399 | File:Bank Albilad Logo.svg | https://en.wikipedia.org/wiki/File:Bank_Albilad_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `alinma` | `alinma.svg` | 3010 | File:Alinma Bank Logo.svg | https://en.wikipedia.org/wiki/File:Alinma_Bank_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `aljazira` | `aljazira.png` | 26551 | File:Bank Aljazira New Logo.png | https://commons.wikimedia.org/wiki/File:Bank_Aljazira_New_Logo.png | CC BY-SA 4.0 (Commons) | Bank AlJazira mark from 2023. Margins trimmed, resized to 512 px wide. |
| `alrajhi` | `alrajhi.svg` | 17524 | File:Al Rajhi Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Al_Rajhi_Bank_Logo.svg | Public domain (Commons) |  |
| `anb` | `anb.svg` | 1797 | File:Arab National Bank Logo.svg | https://en.wikipedia.org/wiki/File:Arab_National_Bank_Logo.svg | PD (English Wikipedia) |  |
| `bankdhofar` | `bankdhofar.png` | 27297 | File:BankDhofar Logo.jpg | https://commons.wikimedia.org/wiki/File:BankDhofar_Logo.jpg | CC BY-SA 4.0 (Commons) | Source JPEG 2480 px. White margins trimmed, resized to 512 px tall, saved as PNG. |
| `bankmuscat` | `bankmuscat.svg` | 25744 | File:Bank_Muscat_logo.svg | https://en.wikipedia.org/wiki/File:Bank_Muscat_logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `banqueducaire` | `banqueducaire.svg` | 35164 | File:Banque du caire Logo.svg | https://commons.wikimedia.org/wiki/File:Banque_du_caire_Logo.svg | Public domain (Commons) |  |
| `banquemisr` | `banquemisr.svg` | 118568 | File:Banque Misr.svg | https://commons.wikimedia.org/wiki/File:Banque_Misr.svg | Public domain (Commons) |  |
| `bbk` | `bbk.png` | 29763 | File:BBK Logo.png | https://commons.wikimedia.org/wiki/File:BBK_Logo.png | CC BY-SA 4.0 (Commons) | Source PNG 1080 px. Margins trimmed, resized to 512 px wide. |
| `boubyan` | `boubyan.svg` | 17881 | File:BoubyanBankLogo (1).svg | https://commons.wikimedia.org/wiki/File:BoubyanBankLogo_(1).svg | CC BY-SA 4.0 (Commons) |  |
| `burgan` | `burgan.svg` | 2740 | File:Burgan Bank logo.svg | https://commons.wikimedia.org/wiki/File:Burgan_Bank_logo.svg | Public domain (Commons) |  |
| `cbd` | `cbd.svg` | 26633 | File:Commercial_Bank_of_Dubai_logo.svg | https://en.wikipedia.org/wiki/File:Commercial_Bank_of_Dubai_logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `cbq` | `cbq.png` | 29555 | File:Cbq.qa-logo.png | https://commons.wikimedia.org/wiki/File:Cbq.qa-logo.png | Public domain (Commons) | Source PNG 622 px. Margins trimmed, resized to 512 px wide. |
| `cib` | `cib.svg` | 1744 | File:Cib Logo.svg | https://commons.wikimedia.org/wiki/File:Cib_Logo.svg | Public domain (Commons) |  |
| `d360` | `d360.svg` | 2345 | File:D360 Bank.svg | https://commons.wikimedia.org/wiki/File:D360_Bank.svg | CC BY 2.5 (Commons) |  |
| `enbd` | `enbd.png` | 42583 | File:Lg-67a9470992e1d-Emirates-NBD.png | https://en.wikipedia.org/wiki/File:Lg-67a9470992e1d-Emirates-NBD.png | Fair use (English Wikipedia, non-free logo) | Source PNG 574 px. Margins trimmed, resized to 512 px wide. |
| `fab` | `fab.svg` | 20915 | File:First Abu Dhabi Bank Logo.svg | https://commons.wikimedia.org/wiki/File:First_Abu_Dhabi_Bank_Logo.svg | Public domain (Commons) |  |
| `gulfbank` | `gulfbank.svg` | 7984 | File:Gulf Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Gulf_Bank_Logo.svg | Public domain (Commons) |  |
| `hsbceg` | `hsbceg.svg` | 1372 | File:HSBC_logo_(2018).svg | https://commons.wikimedia.org/wiki/File:HSBC_logo_(2018).svg | Public domain (Commons) | HSBC group mark (2018), used by HSBC Egypt. |
| `kfh` | `kfh.svg` | 5419 | File:Kuwait_Finance_House_logo.svg | https://en.wikipedia.org/wiki/File:Kuwait_Finance_House_logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `mashreq` | `mashreq.svg` | 11267 | File:Mashreq logo 2022.svg | https://en.wikipedia.org/wiki/File:Mashreq_logo_2022.svg | PD (English Wikipedia) |  |
| `nbb` | `nbb.svg` | 6803 | File:National Bank of Bahrain Logo.svg | https://commons.wikimedia.org/wiki/File:National_Bank_of_Bahrain_Logo.svg | Public domain (Commons) |  |
| `nbe` | `nbe.svg` | 114314 | File:National Bank of Egypt.svg | https://commons.wikimedia.org/wiki/File:National_Bank_of_Egypt.svg | Public domain (Commons) |  |
| `nbk` | `nbk.svg` | 3527 | File:NBK.svg | https://commons.wikimedia.org/wiki/File:NBK.svg | Public domain (Commons) |  |
| `qib` | `qib.svg` | 61573 | File:Logo Qatar Islamic Bank.svg | https://commons.wikimedia.org/wiki/File:Logo_Qatar_Islamic_Bank.svg | Public domain (Commons) |  |
| `qnb` | `qnb.svg` | 4592 | File:QNB Logo.svg | https://commons.wikimedia.org/wiki/File:QNB_Logo.svg | Public domain (Commons) |  |
| `qnbeg` | `qnbeg.svg` | 4592 | File:QNB Logo.svg | https://commons.wikimedia.org/wiki/File:QNB_Logo.svg | Public domain (Commons) | QNB Alahli now trades as QNB; same mark as `qnb`. |
| `riyadbank` | `riyadbank.svg` | 5025 | File:Riyad Bank Logo.svg | https://en.wikipedia.org/wiki/File:Riyad_Bank_Logo.svg | Fair use (English Wikipedia, non-free logo) |  |
| `sabb` | `sabb.svg` | 3308 | File:SAB logo (since 2023).svg | https://commons.wikimedia.org/wiki/File:SAB_logo_(since_2023).svg | Public domain (Commons) | Current SAB (Saudi Awwal Bank) mark; SABB renamed in 2023. The catalogue name is still "SABB". |
| `snb` | `snb.svg` | 33537 | File:Saudi National Bank Logo.svg | https://commons.wikimedia.org/wiki/File:Saudi_National_Bank_Logo.svg | Public domain (Commons) |  |

## Skipped (no file; these keep today's monogram)

| Catalogue id | Bank | Why |
|---|---|---|
| `aaib` | Arab African International Bank | No logo on Wikipedia or Commons. The site builds its header with script. |
| `faisaleg` | Faisal Islamic Bank of Egypt | Only a 120 px raster. The Commons hit is the Sudan bank, a different entity. |
| `adibeg` | ADIB Egypt | The only ADIB SVG wraps an embedded raster, so it was rejected. |
| `adib` | ADIB | Same file as `adibeg`; rejected. |
| `dib` | Dubai Islamic Bank | Only a 397 px raster. |
| `rakbank` | RAKBANK | Only a GIF of the old "Simply Better" lockup, not the current mark. |
| `liv` | Liv | No official file found. |
| `wio` | Wio Bank | No official file found. |
| `zand` | Zand | No official file found. |
| `weyay` | Weyay | No official file found. |
| `dohabank` | Doha Bank | No official file found. |
| `ilabank` | ila Bank | No official file found. |
| `bisb` | Bahrain Islamic Bank | No official file found. |
| `nbo` | National Bank of Oman | Only a 172 px GIF. |

Wallets, BNPL brands and card schemes are out of this pass, which covers the 48 `bank_account` brands. BNPL provider logos already live in `public/providers/` (`ProviderBadge`).

To add a bank: put an official SVG (or a PNG of at least 512 px) at `public/logos/banks/<id>.svg|png`, sanitise it as described above, add the id to `BANK_LOGO_FILES`, and add a row here.
