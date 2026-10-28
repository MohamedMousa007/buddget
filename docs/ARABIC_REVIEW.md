# Arabic review list (QA Round 2, T3 / T14 / T16 / W24 / X12)

Simple Modern Standard Arabic matching the existing copy. App stays LTR. Per the decision, these ship with the batch and the owner reviews wording afterwards. Source files: `src/lib/i18n/{voiceCopy,receiptCopy,savingsFormsCopy,systemPagesCopy,inlineCopy,catalogCopy}.ts`.

Function strings show a sample render (args 3, "X", "Y").

## New Arabic strings (304)

| Key | English | Arabic |
|---|---|---|
| `voice.listening` | Listening… speak your expense. | جارٍ الاستماع… قل مصروفك. |
| `voice.holdMic` | Hold mic to record | اضغط مطولاً على الميكروفون للتسجيل |
| `voice.releaseHint` | Release to transcribe · Drag to trash to cancel | ارفع إصبعك للتفريغ · اسحب إلى سلة المهملات للإلغاء |
| `voice.tryExamples` | Try "200 جنيه taxi", "90 EGP Talabat", or "120 dirhams Carrefour". | جرّب: "200 جنيه تاكسي" أو "90 EGP Talabat" أو "120 درهم Carrefour". |
| `voice.micRequired` |  (Microphone access required.) |  (يلزم السماح بالوصول إلى الميكروفون.) |
| `voice.cancel` | Cancel | إلغاء |
| `voice.micNeededTitle` | Microphone access needed | نحتاج إلى الوصول إلى الميكروفون |
| `voice.micNeededBody` | Allow microphone access so Buddget can hear your expense. | اسمح بالوصول إلى الميكروفون ليتمكن Buddget من سماع مصروفك. |
| `voice.allowMic` | Allow Microphone | السماح بالميكروفون |
| `voice.transcribing` | Transcribing your voice… | جارٍ تفريغ صوتك… |
| `voice.transcribingShort` | Transcribing… | جارٍ التفريغ… |
| `voice.openInChat` | Open in chat | فتح في المحادثة |
| `voice.askAgain` | Ask again | اسأل مرة أخرى |
| `voice.close` | Close | إغلاق |
| `voice.detailPrompt` | Could you add a bit more detail? | هل يمكنك إضافة تفاصيل أكثر؟ |
| `voice.answerByVoice` | Answer by voice | أجب بالصوت |
| `voice.recordingSaved` | Recording saved | تم حفظ التسجيل |
| `voice.offlineBody` | You’re offline right now, so we kept it on your device. When you’re back online, a chip will appear at the top of the app. Tap it to finish adding this expense. | أنت غير متصل الآن، لذلك حفظناه على جهازك. عند عودة الاتصال ستظهر شارة أعلى التطبيق. اضغط عليها لإكمال إضافة هذا المصروف. |
| `voice.offlineBodyShort` | Recording saved. You’re offline. Tap the chip at the top when you’re back online to finish it. | تم حفظ التسجيل. أنت غير متصل. اضغط على الشارة في الأعلى عند عودة الاتصال لإكماله. |
| `voice.done` | Done | تم |
| `voice.couldntCapture` | Couldn’t capture that | تعذّر التقاط ذلك |
| `voice.somethingWrong` | Something went wrong | حدث خطأ ما |
| `voice.errorFallback` | Something went wrong. Try again or close. | حدث خطأ ما. حاول مرة أخرى أو أغلق. |
| `voice.tryAgain` | Try again | حاول مرة أخرى |
| `voice.releaseToCancel` | Release to cancel | ارفع إصبعك للإلغاء |
| `voice.releaseToSave` | Release to save · drag up to cancel | ارفع إصبعك للحفظ · اسحب للأعلى للإلغاء |
| `voice.stages.record` | Recording | التسجيل |
| `voice.stages.transcribe` | Transcription | التفريغ |
| `voice.stages.extract` | Understanding | الفهم |
| `voice.stages.validate` | Checking | التحقق |
| `voice.stages.apply` | Saving | الحفظ |
| `voice.errors.stepFormat` | 3 step: X | خطوة 3: X |
| `voice.errors.micDenied` | Microphone access denied. Enable it in your device Settings. | تم رفض الوصول إلى الميكروفون. فعّله من إعدادات جهازك. |
| `voice.errors.micFallback` | Couldn’t access the microphone. Try again. | تعذّر الوصول إلى الميكروفون. حاول مرة أخرى. |
| `voice.errors.offline` | You’re offline. Voice needs an internet connection. Try again once you’re back online. | أنت غير متصل. الأوامر الصوتية تحتاج إلى اتصال بالإنترنت. حاول مرة أخرى عند عودة الاتصال. |
| `voice.errors.transcribeSlow` | Transcription took too long. Try again. | استغرق التفريغ وقتاً طويلاً. حاول مرة أخرى. |
| `voice.errors.extractSlow` | The assistant took too long. Try again. | استغرق المساعد وقتاً طويلاً. حاول مرة أخرى. |
| `voice.errors.noCatch` | Didn’t catch that. Try again in a quieter spot. | لم نسمع ذلك جيداً. حاول مرة أخرى في مكان أهدأ. |
| `voice.errors.serverUnreachable` | couldn’t reach the server | تعذّر الوصول إلى الخادم |
| `voice.errors.assistantNoReply` | the assistant didn’t respond | لم يستجب المساعد |
| `voice.errors.transcriptionFailed` | transcription failed (3) | فشل التفريغ (3) |
| `voice.errors.saveFallback` | Couldn’t save. Try again. | تعذّر الحفظ. حاول مرة أخرى. |
| `voice.recap.nothingToSave` | Nothing to save | لا شيء للحفظ |
| `voice.recap.transactionsCount` | 3 transactions | 3 معاملات |
| `voice.recap.confirmToSave` | Confirm to save | أكّد للحفظ |
| `voice.recap.saveAll` | Save all | حفظ الكل |
| `voice.recap.save` | Save | حفظ |
| `voice.recap.redo` | Redo | إعادة |
| `voice.recap.amount` | Amount | المبلغ |
| `voice.recap.currency` | Currency | العملة |
| `voice.recap.category` | Category | الفئة |
| `voice.recap.paymentMethod` | Payment method | طريقة الدفع |
| `voice.recap.actionLabels.add_expense` | Expense | مصروف |
| `voice.recap.actionLabels.add_income` | Income | دخل |
| `voice.recap.actionLabels.add_debt` | Debt | دين |
| `voice.recap.actionLabels.add_debt_payment` | Debt payment | دفعة دين |
| `voice.recap.actionLabels.deposit_savings` | Savings deposit | إيداع في المدخرات |
| `voice.recap.actionLabels.withdraw_savings` | Savings withdrawal | سحب من المدخرات |
| `voice.recap.actionLabels.add_savings_account` | Savings account | حساب مدخرات |
| `voice.recap.actionLabels.add_payment_method` | Payment method | طريقة دفع |
| `voice.recap.fieldLabels.source` | Source | المصدر |
| `voice.recap.fieldLabels.debtName` | Debt name | اسم الدين |
| `voice.recap.fieldLabels.person` | Person | الشخص |
| `voice.recap.fieldLabels.account` | Account | الحساب |
| `voice.recap.fieldLabels.accountName` | Account name | اسم الحساب |
| `voice.recap.fieldLabels.name` | Name | الاسم |
| `voice.recap.fieldLabels.description` | Description | الوصف |
| `receiptScan.errors.unavailable` | AI scanning is temporarily offline. Set up the expense manually or try again in a moment. | المسح بالذكاء الاصطناعي متوقف مؤقتاً. أدخل المصروف يدوياً أو حاول بعد قليل. |
| `receiptScan.errors.unreadable` | We had trouble reading this receipt. Make sure the total and merchant are clearly visible, then try again. | واجهنا صعوبة في قراءة هذا الإيصال. تأكد من وضوح الإجمالي واسم المتجر ثم حاول مرة أخرى. |
| `receiptScan.errors.limitReached` | Receipt scanning limit reached. Try again in a moment. | تم الوصول إلى حد مسح الإيصالات. حاول بعد قليل. |
| `receiptScan.errors.signInRequired` | Sign in to use receipt scanning. | سجّل الدخول لاستخدام مسح الإيصالات. |
| `receiptScan.errors.offline` | You’re offline. Receipt scanning needs an internet connection. Try again once you’re back online. | أنت غير متصل. مسح الإيصالات يحتاج إلى اتصال بالإنترنت. حاول مرة أخرى عند عودة الاتصال. |
| `receiptScan.errors.networkLost` | Network connection lost. Check your internet and try again. | انقطع الاتصال بالشبكة. تحقق من الإنترنت وحاول مرة أخرى. |
| `receiptScan.errors.scanFailed` | Scan failed (3). Try again. | فشل المسح (3). حاول مرة أخرى. |
| `receiptScan.errors.scanFallback` | Couldn’t scan that receipt. Try again. | تعذّر مسح هذا الإيصال. حاول مرة أخرى. |
| `receiptScan.errors.scannerFallback` | Couldn’t open the scanner. Try again. | تعذّر فتح الماسح. حاول مرة أخرى. |
| `receiptScan.errors.storedImageUnreadable` | Couldn’t read the stored receipt image. | تعذّرت قراءة صورة الإيصال المحفوظة. |
| `receiptScan.openingCamera` | Opening camera… | جارٍ فتح الكاميرا… |
| `receiptScan.openingCameraHint` | Line up your receipt and capture it. | وجّه الكاميرا نحو الإيصال والتقطه. |
| `receiptScan.reading` | Reading your receipt… | جارٍ قراءة الإيصال… |
| `receiptScan.readingHint` | Pulling out the merchant, total, and items. | نستخرج اسم المتجر والإجمالي والبنود. |
| `receiptScan.captured` | Receipt captured | تم التقاط الإيصال |
| `receiptScan.capturedOffline` | You’re offline right now, so we saved the photo on your device. When you’re back online, a chip will appear at the top of the app. Tap it to finish adding this receipt. | أنت غير متصل الآن، لذلك حفظنا الصورة على جهازك. عند عودة الاتصال ستظهر شارة أعلى التطبيق. اضغط عليها لإكمال إضافة هذا الإيصال. |
| `receiptScan.done` | Done | تم |
| `receiptScan.notReceiptTitle` | That doesn’t look like a receipt | لا يبدو هذا إيصالاً |
| `receiptScan.notReceiptBody` | We couldn’t find a total or merchant. Point the camera at a printed receipt, or pick a clearer photo. | لم نجد إجمالياً أو اسم متجر. وجّه الكاميرا نحو إيصال مطبوع أو اختر صورة أوضح. |
| `receiptScan.scanAgain` | Scan again | مسح مرة أخرى |
| `receiptScan.chooseGallery` | Choose from gallery | اختيار من المعرض |
| `receiptScan.tryAgainTitle` | Let’s try that again | لنحاول مرة أخرى |
| `receiptScan.tryAgain` | Try again | حاول مرة أخرى |
| `receiptScan.idlePrompt` | Scan a receipt to add it as an expense. | امسح إيصالاً لإضافته كمصروف. |
| `receiptScan.scan` | Scan | مسح |
| `receiptScan.gallery` | Gallery | المعرض |
| `receiptScan.reviewTitle` | Review & save | راجع واحفظ |
| `receiptScan.previewAlt` | Receipt preview | معاينة الإيصال |
| `receiptScan.receiptAlt` | Receipt | الإيصال |
| `receiptScan.amount` | Amount | المبلغ |
| `receiptScan.currency` | Currency | العملة |
| `receiptScan.merchant` | Merchant | المتجر |
| `receiptScan.merchantPlaceholder` | Where you spent | أين أنفقت |
| `receiptScan.category` | Category | الفئة |
| `receiptScan.date` | Date | التاريخ |
| `receiptScan.saveExpense` | Save expense | حفظ المصروف |
| `receiptScan.rescan` | Rescan | إعادة المسح |
| `receiptScan.breakdown` | Breakdown | التفاصيل |
| `receiptScan.unassigned` | 3 unassigned. It will be saved under the unread items so the breakdown matches the total. | 3 غير موزّع. سيُحفظ ضمن البنود غير المقروءة لتطابق التفاصيل الإجمالي. |
| `receiptScan.mismatch` | Breakdown sums to 3 but the total reads X. The total is what gets saved. | مجموع التفاصيل 3 لكن الإجمالي X. الإجمالي هو ما سيُحفظ. |
| `savingsForms.systemNames.monthlySavings` | Monthly Savings | المدخرات الشهرية |
| `savingsForms.identity.types.bank` | Bank account | حساب بنكي |
| `savingsForms.identity.types.cash` | Cash | نقد |
| `savingsForms.identity.types.gold` | Gold | ذهب |
| `savingsForms.identity.types.stablecoin` | Stablecoin | عملة مستقرة |
| `savingsForms.identity.types.vault` | Monthly Savings | المدخرات الشهرية |
| `savingsForms.identity.matures` | matures 3 X | يحين استحقاقه 3 X |
| `savingsForms.pocketKinds.bank.label` | Bank account | حساب بنكي |
| `savingsForms.pocketKinds.bank.sub` | Current or savings | الحساب الجاري أو التوفير |
| `savingsForms.pocketKinds.wallet.label` | Mobile wallet | محفظة إلكترونية |
| `savingsForms.pocketKinds.wallet.sub` | Vodafone Cash, InstaPay | فودافون كاش، إنستاباي |
| `savingsForms.pocketKinds.cash.label` | Cash | نقد |
| `savingsForms.pocketKinds.cash.sub` | At home or in a safe | في المنزل أو في خزنة |
| `savingsForms.pocketKinds.certificate.label` | Certificate | شهادة ادخار |
| `savingsForms.pocketKinds.certificate.sub` | Fixed term, matures | مدة ثابتة وتاريخ استحقاق |
| `savingsForms.pocketKinds.stablecoin.label` | Stablecoin | عملة مستقرة |
| `savingsForms.pocketKinds.stablecoin.sub` | USDT and friends | مثل USDT |
| `savingsForms.pocketKinds.other.label` | Something else | شيء آخر |
| `savingsForms.pocketKinds.other.sub` | Name it, pick an icon | سمّه واختر أيقونة |
| `savingsForms.pocket.newTitle` | (fn) | 3 جديد |
| `savingsForms.pocket.linked` | Linked | مرتبط |
| `savingsForms.pocket.newPocket` | Your new pocket | جيبك الجديد |
| `savingsForms.pocket.provider` | Provider | الجهة |
| `savingsForms.pocket.other` | Other | أخرى |
| `savingsForms.pocket.last4` | Last 4 digits | آخر 4 أرقام |
| `savingsForms.pocket.maturesOn` | Matures on | تاريخ الاستحقاق |
| `savingsForms.pocket.pocketName` | Pocket name | اسم الجيب |
| `savingsForms.pocket.inItNow` | What’s in it now | ما فيها الآن |
| `savingsForms.pocket.currency` | Currency | العملة |
| `savingsForms.pocket.colour` | Colour | اللون |
| `savingsForms.pocket.alsoPayment` | Also add as a payment method | إضافتها أيضاً كطريقة دفع |
| `savingsForms.pocket.alsoPaymentSub` | So you can spend from it too | لتتمكن من الإنفاق منها أيضاً |
| `savingsForms.pocket.create` | Create pocket | إنشاء الجيب |
| `savingsForms.zakat.title` | Zakat | الزكاة |
| `savingsForms.zakat.due` | Zakat is due | الزكاة واجبة |
| `savingsForms.zakat.notDue` | No zakat due | لا زكاة مستحقة |
| `savingsForms.zakat.zakatableLine` | 3 × X Y zakatable | 3 × X Y مال زكوي |
| `savingsForms.zakat.underLine` | You are 3 X under the line | أنت دون الحد بمقدار 3 X |
| `savingsForms.zakat.nisab` | Nisab · 3 X | النصاب · 3 X |
| `savingsForms.zakat.hawlEnds` | Hawl ends 3 | ينتهي الحول 3 |
| `savingsForms.zakat.whatCounts` | What counts | ما يُحتسب |
| `savingsForms.zakat.cash` | Cash & savings | النقد والمدخرات |
| `savingsForms.zakat.cashSub` | Every pocket you hold | كل المحافظ التي تملكها |
| `savingsForms.zakat.gold` | Gold | الذهب |
| `savingsForms.zakat.goldSub` | At today’s sell price | بسعر البيع اليوم |
| `savingsForms.zakat.crypto` | Crypto | العملات الرقمية |
| `savingsForms.zakat.cryptoSub` | Treated like cash | تُعامل مثل النقد |
| `savingsForms.zakat.stocks` | Stocks | الأسهم |
| `savingsForms.zakat.stocksSub` | For trading · 100% counted | للمتاجرة · 100% تُحتسب |
| `savingsForms.zakat.property` | Property | العقارات |
| `savingsForms.zakat.propertySub` | Not counted — only rent you kept | لا تُحتسب، فقط الإيجار الذي ادّخرته |
| `savingsForms.zakat.notCounted` | Not counted | لا تُحتسب |
| `savingsForms.zakat.debts` | Debts due this year | ديون مستحقة هذا العام |
| `savingsForms.zakat.debtsSub` | Subtracted from your wealth | تُخصم من ثروتك |
| `savingsForms.zakat.zakatableWealth` | Zakatable wealth | المال الزكوي |
| `savingsForms.zakat.stockHold` | How you hold stocks | كيف تحتفظ بالأسهم |
| `savingsForms.zakat.longTerm` | Long-term | طويلة الأجل |
| `savingsForms.zakat.longTermSub` | 30% counted | 30% تُحتسب |
| `savingsForms.zakat.forTrading` | For trading | للمتاجرة |
| `savingsForms.zakat.forTradingSub` | 100% counted | 100% تُحتسب |
| `savingsForms.zakat.explainer` | Zakat is 2.5% of the wealth you have held for one lunar year above nisab. A home you live in and land you rent out are not counted — only the rent you kept. Buddget follows the majority view; check anything unusual with someone you trust. | الزكاة هي 2.5% من المال الذي مضى عليه عام هجري كامل وبلغ النصاب. لا يُحتسب المنزل الذي تسكنه ولا الأرض المؤجّرة، بل الإيجار الذي ادّخرته فقط. يتبع Buddget رأي الجمهور، فاسأل من تثق به في أي حالة غير معتادة. |
| `savingsForms.asset.titles.gold` | Add gold | إضافة ذهب |
| `savingsForms.asset.titles.crypto` | Add crypto | إضافة عملة رقمية |
| `savingsForms.asset.titles.stock` | Add a position | إضافة مركز استثماري |
| `savingsForms.asset.titles.property` | Add property | إضافة عقار |
| `savingsForms.asset.unitSuffix.grams` | g | جم |
| `savingsForms.asset.unitSuffix.pounds` | pounds | جنيهات |
| `savingsForms.asset.unitSuffix.ounces` | oz | أونصة |
| `savingsForms.asset.karat` | Karat | العيار |
| `savingsForms.asset.pure` | 3 pure | نقاء 3 |
| `savingsForms.asset.perGram` | 3/g | 3/جم |
| `savingsForms.asset.countedAs` | Counted as | يُحتسب بوحدة |
| `savingsForms.asset.grams` | Grams | جرامات |
| `savingsForms.asset.goldPounds` | Gold pounds | جنيهات ذهب |
| `savingsForms.asset.ounces` | Ounces | أونصات |
| `savingsForms.asset.howMuch` | How much | الكمية |
| `savingsForms.asset.rowWillSay` | = 3 g. Your row will say “X Y”. | = 3 جم. سيظهر في القائمة “X Y”. |
| `savingsForms.asset.coin` | Coin | عملة معدنية |
| `savingsForms.asset.livePrice` | live price | سعر مباشر |
| `savingsForms.asset.other` | Other | أخرى |
| `savingsForms.asset.typeIt` | type it | اكتبها |
| `savingsForms.asset.symbol` | Symbol | الرمز |
| `savingsForms.asset.coins` | coins | عملات |
| `savingsForms.asset.ticker` | Ticker | رمز السهم |
| `savingsForms.asset.shares` | Shares | الأسهم |
| `savingsForms.asset.size` | Size | المساحة |
| `savingsForms.asset.yourShare` | Your share | حصتك |
| `savingsForms.asset.shopWouldPay` | What a shop would pay you today | ما قد يدفعه محل لك اليوم |
| `savingsForms.asset.worthToday` | What it is worth today | قيمته اليوم |
| `savingsForms.asset.liveValuation` | Live valuation | تقييم مباشر |
| `savingsForms.asset.priceRefreshing` | Live price refreshing. The value will appear shortly. | جارٍ تحديث السعر المباشر. ستظهر القيمة قريباً. |
| `savingsForms.asset.moneySource` | Where did the money come from? | من أين جاء المال؟ |
| `savingsForms.asset.total` | Total | الإجمالي |
| `savingsForms.asset.addGold` | Add 3 X of Yk | إضافة 3 X من عيار Y |
| `savingsForms.asset.addInvestment` | Add investment | إضافة استثمار |
| `systemPages.routeError.title` | Something went wrong | حدث خطأ ما |
| `systemPages.routeError.retry` | Try again | حاول مرة أخرى |
| `systemPages.routeError.report` | Report 3 | البلاغ 3 |
| `systemPages.rootError.title` | Buddget hit a problem | واجه Buddget مشكلة |
| `systemPages.rootError.body` | Your data is safe. Try again, and if it keeps happening, quote the report number to support. | بياناتك بأمان. حاول مرة أخرى، وإذا تكرر الأمر فاذكر رقم البلاغ للدعم. |
| `systemPages.rootError.retry` | Try again | حاول مرة أخرى |
| `systemPages.rootError.report` | Report 3 | البلاغ 3 |
| `systemPages.offline.title` | You’re offline | أنت غير متصل |
| `systemPages.offline.body` | Check your connection and try again. | تحقق من اتصالك وحاول مرة أخرى. |
| `systemPages.offline.retry` | Try again | حاول مرة أخرى |
| `systemPages.iosSmsSetup.tokenMissing` | We couldn’t generate a setup token for your account. Reload the page or check your network connection. | تعذّر إنشاء رمز الإعداد لحسابك. أعد تحميل الصفحة أو تحقق من اتصالك بالشبكة. |
| `systemPages.iosSmsSetup.bearerToken` | Your bearer token | رمز الوصول الخاص بك |
| `systemPages.iosSmsSetup.hide` | Hide | إخفاء |
| `systemPages.iosSmsSetup.reveal` | Reveal | إظهار |
| `systemPages.iosSmsSetup.copied` | Copied | تم النسخ |
| `systemPages.iosSmsSetup.copy` | Copy | نسخ |
| `systemPages.iosSmsSetup.tokenWarning` | Treat this like a password. Anyone with it can post SMS to your account. | تعامل معه كما تتعامل مع كلمة المرور. أي شخص يملكه يمكنه إرسال رسائل SMS إلى حسابك. |
| `systemPages.iosSmsSetup.parseEndpoint` | AI parse endpoint | عنوان التحليل بالذكاء الاصطناعي |
| `systemPages.iosSmsSetup.ingestEndpoint` | Regex ingest endpoint | عنوان الاستقبال بالتعبيرات النمطية |
| `inlineCopy.payCycle.title` | Pay cycle | دورة الراتب |
| `inlineCopy.payCycle.question` | My month starts on day | يبدأ شهري في اليوم |
| `inlineCopy.payCycle.hint` | Usually the day your salary lands. | غالباً يوم وصول الراتب. |
| `inlineCopy.payCycle.earlier` | Earlier day | يوم أبكر |
| `inlineCopy.payCycle.later` | Later day | يوم أبعد |
| `inlineCopy.payCycle.today` | today | اليوم |
| `inlineCopy.payCycle.current` | Your current cycle | دورتك الحالية |
| `inlineCopy.payCycle.note` | Past entries keep their dates; your months are cut differently from now on. | تحتفظ الإدخالات السابقة بتواريخها، وتُقسَّم شهورك بشكل مختلف من الآن فصاعداً. |
| `inlineCopy.payCycle.close` | Close | إغلاق |
| `inlineCopy.currencyDual.title` | Currencies | العملات |
| `inlineCopy.currencyDual.main` | Main | الأساسية |
| `inlineCopy.currencyDual.second` | Second | الثانية |
| `inlineCopy.currencyDual.off` | Off | إيقاف |
| `inlineCopy.currencyDual.offHint` | Amounts show in your main currency only | تظهر المبالغ بالعملة الأساسية فقط |
| `inlineCopy.currencyDual.previewTitle` | How a second currency shows | كيف تظهر العملة الثانية |
| `inlineCopy.currencyDual.sampleTxn` | Groceries | بقالة |
| `inlineCopy.currencyDual.previewOff` | Pick a currency below and every amount in Flow and on your heroes shows its equivalent underneath. | اختر عملة من الأسفل ليظهر مقابل كل مبلغ في التدفق وعلى شاشاتك الرئيسية تحته. |
| `inlineCopy.currencyDual.close` | Close | إغلاق |
| `inlineCopy.currencyDual.tabs` | Currency to change | العملة المراد تغييرها |
| `inlineCopy.currencyPicker.title` | Currency | العملة |
| `inlineCopy.currencyPicker.close` | Close | إغلاق |
| `inlineCopy.currencyPicker.searchPlaceholder` | Search currency or country | ابحث عن عملة أو دولة |
| `inlineCopy.currencyPicker.searchAria` | Search currency | بحث عن عملة |
| `inlineCopy.currencyPicker.noMatch` | No currency matches “3” | لا توجد عملة تطابق “3” |
| `inlineCopy.currencyPicker.common` | Common | الأكثر استخداماً |
| `inlineCopy.currencyPicker.all` | All currencies | كل العملات |
| `inlineCopy.yearPicker.typeYear` | Type a year… | اكتب سنة… |
| `inlineCopy.yearPicker.noMatch` | No matching year | لا توجد سنة مطابقة |
| `inlineCopy.buddgyContinue` | Continue | أكمل |
| `inlineCopy.memoryWords.household.solo` | Just me | أنا فقط |
| `inlineCopy.memoryWords.household.couple` | Couple | زوجان |
| `inlineCopy.memoryWords.household.family` | Family | عائلة |
| `inlineCopy.memoryWords.food.everyday` | Every day | كل يوم |
| `inlineCopy.memoryWords.food.mostdays` | Most days | معظم الأيام |
| `inlineCopy.memoryWords.food.sometimes` | Sometimes | أحياناً |
| `inlineCopy.memoryWords.food.rarely` | Rarely | نادراً |
| `inlineCopy.memoryWords.transport.public` | Public transport | مواصلات عامة |
| `inlineCopy.memoryWords.transport.car` | Car | سيارة |
| `inlineCopy.memoryWords.transport.taxi` | Taxi | تاكسي |
| `inlineCopy.memoryWords.transport.walk` | Walking | مشياً |
| `inlineCopy.memoryWords.tier.minimal` | Minimal | بسيط |
| `inlineCopy.memoryWords.tier.balanced` | Balanced | متوازن |
| `inlineCopy.memoryWords.tier.comfortable` | Comfortable | مريح |
| `inlineCopy.memoryWords.housing.rent` | Renting | إيجار |
| `inlineCopy.memoryWords.housing.own` | Own home | ملك |
| `inlineCopy.memoryWords.housing.family` | With family | مع العائلة |
| `inlineCopy.memoryWords.housing.company` | Company housing | سكن الشركة |
| `inlineCopy.memoryWords.stability.fixed` | Fixed | ثابت |
| `inlineCopy.memoryWords.stability.variable` | Variable | متغير |
| `inlineCopy.memoryWords.stability.mixed` | Mixed | مختلط |
| `inlineCopy.memoryWords.rent` | Rent | الإيجار |
| `inlineCopy.memoryWords.housingLabel` | Housing | السكن |
| `inlineCopy.memoryWords.dependents` | Dependents | المعالون |
| `inlineCopy.memoryWords.supports` | Supports others | تعول آخرين |
| `inlineCopy.memoryWords.income` | Income | الدخل |
| `inlineCopy.memoryWords.car` | Has a car | لديك سيارة |
| `inlineCopy.memoryWords.lean` | Saving vs comfort | الادخار مقابل الراحة |
| `inlineCopy.memoryWords.invest` | Interested in investing | مهتم بالاستثمار |
| `inlineCopy.memoryWords.yes` | Yes | نعم |
| `inlineCopy.memoryWords.no` | No | لا |
| `inlineCopy.memoryWords.notSet` | Not set | غير محدد |
| `inlineCopy.memoryWords.kinds.fact` | Facts | حقائق |
| `inlineCopy.memoryWords.kinds.preference` | Preferences | تفضيلات |
| `inlineCopy.memoryWords.kinds.constraint` | Limits | حدود |
| `catalogs.goalNames.emergency_fund` | Emergency Fund | صندوق الطوارئ |
| `catalogs.goalNames.house` | House Down Payment | دفعة مقدمة لمنزل |
| `catalogs.goalNames.car` | New Car | سيارة جديدة |
| `catalogs.goalNames.vacation` | Vacation | إجازة |
| `catalogs.goalNames.education` | Education | التعليم |
| `catalogs.goalNames.wedding` | Wedding | الزواج |
| `catalogs.goalNames.phone_device` | Phone / Device | هاتف / جهاز |
| `catalogs.goalNames.family_support` | Family Support | دعم الأسرة |
| `catalogs.goalNames.sadaqah_charity` | Sadaqah | صدقة |
| `catalogs.goalNames.gift` | Gift | هدية |
| `catalogs.goalNames.investment` | Investments | الاستثمار |
| `catalogs.goalNames.debt_freedom` | Debt Freedom | التحرر من الديون |
| `catalogs.goalNames.quality_of_life` | Quality of Life | جودة الحياة |
| `catalogs.goalNames.spending_control` | Spending Control | ضبط الإنفاق |
| `catalogs.goalNames.retirement` | Retirement | التقاعد |
| `catalogs.goalNames.business` | Business | مشروع |
| `catalogs.goalNames.custom` | My Goal | هدفي |
| `catalogs.creditCardGoalName` | Credit card | بطاقة ائتمان |
| `catalogs.goalPocketName` | 3 pocket | جيب 3 |

## Existing Arabic strings re-worded to follow the glossary

| What | Key | English now | Arabic now |
|---|---|---|---|
| common/expenses/income… confirmDelete* (glossary: Delete = permanent) | `confirmDeleteExpense, expenses.confirmDelete` | Delete this expense? This can’t be undone. | هل تريد حذف هذا المصروف؟ لا يمكن التراجع عن هذا. |
| confirmRemoveGoal (glossary) | `debts.confirmRemoveGoal` | Delete this payoff goal and any linked reminder schedule? | حذف هدف السداد وأي تذكير مرتبط به؟ |
| errorFallback / errorUpdateFailed (one calm error tone) | `auth/profile` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. |
| paidFailed | `moneyFlows.paidFailed` | Couldn’t record this payment. Try again. | تعذّر تسجيل هذه الدفعة. حاول مرة أخرى. |
| aiEvalError | `budget.aiEvalError` | Couldn’t evaluate the plan right now. Try again. | تعذّر تقييم الخطة الآن. حاول مرة أخرى. |

## Egyptian dialect replaced by MSA (T14)

| Old (dialect) | New (MSA) |
|---|---|
| شهري بيبدأ يوم | يبدأ شهري في اليوم |
| النهاردة | اليوم |
| إزاي بتظهر العملة الثانية | كيف تظهر العملة الثانية |
| اختار عملة من تحت وكل مبلغ في فلو … هيظهر تحته المقابل | اختر عملة من الأسفل ليظهر مقابل كل مبلغ في التدفق … تحته |
| كمّل (Buddgy continue) | أكمل |
