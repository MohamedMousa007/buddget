# Egyptian Bank & Fintech SMS Template Research

Compiled June 2026 from 75+ web/GitHub searches. Confidence scale:
**high** = verbatim from a real user capture or our own `sms_parse_log`;
**medium** = reconstructed from a real user's parser regexes; **low** = inferred.
Only **high**-confidence patterns ship `verified: true` in `src/lib/sms/patterns/`.

Gold-mine sources (real captured SMS in open-source Egyptian finance apps):
- [pennywiseai-tracker issues #106/#231](https://github.com/sarim2000/pennywiseai-tracker) — real CIB + HSBC user submissions
- [FinFast CIBParser.swift](https://github.com/CyberDemon73/FinFast) — device-captured CIB Arabic templates
- [money_tracking test fixtures](https://github.com/yasmenhosam412-yas/money_tracking) — real Vodafone Cash + bank-19123 captures
- [lifeOS process-sms parser](https://github.com/ghassanelgendy/lifeOS) — regexes built against a real NBE/QNB/HSBC inbox
- [homelab actual-bridge fixtures](https://github.com/fahdarafat/homelab) — HSBC credit card fixtures
- [Monyvi sender registry](https://github.com/Msamir22/Monyvi) — Egyptian sender-ID list (fixtures synthetic — used for sender IDs only)

## HSBC Egypt — sender `HSBC` (official) — HIGH
- IPN out: `Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 3.50 on 10-06-2026 02:16 to SALMA SAMY ELSAYED with reference 3f5b5478. …` (own capture)
- IPN in: same with `was credited with IPN inward transfer … from NAME with reference` (own capture)
- Account purchase: `Your HSBC Account ****0001 was debited EGP 250.00 for purchase at Carrefour Egypt on 09-06-2026` (own capture)
- Credit card: `Your Credit Card ending with * 1234 has been used for EGP 1339.50 on 27/05/2026 at WE-FBB-Pre. Your available limit is EGP 100.00` (homelab fixture, corroborated by masked real-user report in pennywiseai #231)
- Statement-style debit (`From HSBC: 13SEP25 MERCHANT Purchase … amount- EGP`) — medium, disabled.

## CIB — sender `CIB` (hotline 19666) — HIGH
- Credit card EN: `Your credit card ending with#8016 was charged for EGP 118.00 at SAOOD MARKET on 24/11/25  at 18:27. Card available limit is …` / newer `Your credit card #8810 was charged for USD 22.80 at ANTHROPIC CLAU on 01/06/26 at 15:26.`
- Debit card POS/Apple Pay AR: `تم خصم EGP 10.00 من بطاقة الخصم المباشر # **2326 باستخدام Apple Pay عند CITYSTARS FOR MANAGEME في 23/05/26 16:24 الرصيد المتاح EGP2700.03.`
- ATM AR: `تم سحب مبلغ EGP 100.00 من بطاقة الخصم المباشر المنتهية بـ **2326 من BDC HORYA في 19/05/26 19:55 ، الرصيد المتاح EGP 200.11`
- IPN out AR: `يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 1000.00 جم من حسابك المنتهي بـ ****1065 برقم مرجعي 819a53fa بتاريخ 26-05-2026 19:35 للمزيد، برجاء الاتصال بـ 19666`
- IPN in AR: `… بمبلغ 10.00 جم إلى حسابك المنتهي بـ ********1065 من KARIM MOHAMED MORSI ISM برقم مرجعي … بتاريخ …`
- Refund EN: `The transaction on your credit card#8016 from ORACLE IRELAND with EUR .93 … has been refunded.`
- Direction markers: `من حسابك` = out, `إلى حسابك` = in. IPN amounts in `جم`, card amounts in `EGP`.

## Vodafone Cash — sender `VF-Cash` — HIGH
- Receive: `تم استلام مبلغ 6000 جنيه من رقم 01094490330 المسجل بإسم Mohamed S Amer على رقم محفظتك 01024193022. رصيدك الحالي: 6004.88 جنيه …`
- Cash-out: `تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه. …`
- Balance-only (reject): `رصيد حسابك فى فودافون كاش الحالي6004.88 جنيه؛ …`
- Date format quirk: `HH:mm YY-MM-DD` (e.g. `00:25 26-04-05`).

## Generic bank card (hotline 19123, sender unconfirmed) — HIGH (real captures)
- Card purchase EN: `You have a Trx on your Card no. XXXX2939 from Talabat for EGP  204.16 on 19-May at 05:06  GMT+3 your available balance is 276.10 …`
- Deposit AR: `تم إيداع EGP 7900 إلى حساب رقم #0014 يوم 06/04/2026 13:24 المتاح 220157.61 EGP للمزيد اتصل ب 19123`
- IPN out AR: `تم تحويل لحظى بمبلغ 200 إلى  رقم مرجعى BEC93BC في 17/05/2026 04:54 للمزيد اتصل ب 19123`
Shipped with empty senderIds (matched in the fallback pass).

## NBE — sender `NBE` / `BanK-AlAhly` — MEDIUM (reconstructed, disabled)
- POS AR: `تم خصم <amount> … عند <MERCHANT> يوم DD-MM الساعه HH:MM … المتاح <balance>`
- IPN in: `تم إضافة تحويل لحظي لحسابكم … من <NAME> … رقم مرجعي <ref>`
- IPN out: `تم تنفيذ تحويل لحظي من حسابكم رقم NNNN بمبلغ <amount> جم إلى <NAME> رقم مرجعي <ref>`
- ATM merchant slot: `NBE ATM<number>`; declined begins `ناسف لعدم إتمام`.

## QNB Alahli — sender `QNB` — MEDIUM (reconstructed, disabled)
- Purchase: `… Successful transaction of EGP <amount> @ <MERCHANT>, your available …`
- IPN out/in: `IPN transfer sent/received with amount EGP <amount> … Ref# <ref>`

## AAIB — sender `AAIB` — MEDIUM-LOW (disabled)
- `AAIB: Debit EGP 380.00 from A/C XXXX5678 at SEOUDI MARKET. Bal: …` (FinFast dev approximation)

## No reliable samples found (route via AI, collect from real users)
Banque Misr, ADIB, AlexBank (`AlexBank`/`AlexAlerts`), Banque du Caire (`BDC`),
Faisal (`FAISAL BANK`), Crédit Agricole (`caegypt`), Emirates NBD Egypt (`EmiratesNBD`),
Mashreq (`Mashreq-EGY`), ABK, NBK Egypt, SAIB, Orange Money (`OrangeCash`),
Etisalat/e& money, WE Pay, Fawry, ValU, Telda (push-only), Khazna, Halan, PayMob.
Sender IDs above are from the Monyvi registry + Egyptian dev sender lists — use for
routing once real body samples arrive via the admin SMS Tracked audit loop.

## Gulf (GCC) banks — added June 2026
Source: [pennywiseai-tracker](https://github.com/sarim2000/pennywiseai-tracker)
per-bank Kotlin parser tests (real captured bodies) + [bank-al-bilad-sms-parser](https://github.com/obahareth/bank-al-bilad-sms-parser).
KSA banks are Arabic RTL; UAE banks are English. The currency token is the Latin
ISO code (`SAR`/`AED`) even inside Arabic bodies. Dates are per-bank inconsistent
(`DD/MM/YY`, `HH:MM DD/MM/YY`, `DD-MMM-YYYY hh:mm AM/PM`) → not globally parsed.

### Emirates NBD (UAE) — sender `EmiratesNBD`/`ENBD` — HIGH (shipped)
- Card purchase EN: `Purchase of AED 27.74 with Credit Card ending 9074 at Keeta, Dubai. Avl Cr. Limit is AED 30,978.13`
- Account debit EN: `AED 500.00 debited from A/C xxxx1234 on 24-Dec-25. Avl Bal is AED 15,234.50`
- Account credit EN: `AED 2,500.00 credited to A/C xxxx5678 on 24-Dec-25. Available Balance: AED 25,750.00`

### Mashreq (UAE) — sender `Mashreq` (NEO) — HIGH (shipped)
- Debit card EN: `Thank you for using NEO VISA Debit Card Card ending 1234 for AED 5.99 at CARREFOUR on 26-AUG-2025 10:25 PM. Available Balance is AED 1,480.15`

### SNB / AlAhli (KSA) — sender `SNB-AlAhli`/`AlAhliBank` — HIGH (shipped)
- POS purchase AR (multi-line): `شراء نقاط بيع SamsungPay\nبـSAR 19.45\nمن filwah al\nمدى *2342\nفي 07:53 03/04/26`

### Researched, NOT shipped (medium/no sample — route via AI until real captures)
- **Al Rajhi** (KSA) `AlRajhiBank` — MEDIUM: `شراء…بـSAR <amt> لـ<m>`, `سحب:صراف آلي…مبلغ:SAR <amt>`, `حوالة محلية واردة…مبلغ:SAR <amt> من:<s>` (parser templates, not full bodies).
- **Bank Albilad** (KSA) — MEDIUM: labeled layout `لدى: <m>` / `مبلغ: N.NN SAR` / `بطاقة: **NNNN;مدى`.
- **FAB** (UAE) `FAB`/`FABBANK` — MEDIUM: types `Credit/Debit Card Purchase`, card `Card XXXXNNNN`, `AED <amt>` (no full body).
- **ADCB** (UAE) — LOW: `was used for` / `withdrawn from`, card `XXX0830`.
- **Riyad Bank, DIB, NBK, KFH, QNB** — NO credible public sample found; collect via the admin SMS Tracked audit loop.

## Cross-bank parse notes
- Currency tokens: `EGP`, `جم`, `جنيه/جنية`, `LE`. Balance markers: `الرصيد المتاح`,
  `رصيدك الحالي`, `available limit` (credit cards report limit, not balance).
- Hotlines fingerprint the bank: CIB 19666, NBE 19623, QNB 19700 — never trust alone (phishing vector).
- InstaPay wording is bank-specific, not network-uniform.
