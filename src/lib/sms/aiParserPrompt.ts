/**
 * Egypt-first prompt for the Gemini-based SMS / notification parser.
 *
 * Order of priority:
 *   1. Egyptian banks (NBE, CIB, Banque Misr, QNB Alahli, AAIB, HSBC Egypt,
 *      Faisal Islamic Bank, Bank of Alexandria / Alex Bank, Banque du Caire,
 *      ADIB Egypt, Crédit Agricole Egypt).
 *   2. UAE banks (ADCB, Emirates NBD, FAB, Mashreq, Wio, Revolut).
 *   3. Other GCC: NCB / SNB, Al Rajhi, Riyad Bank, Alinma (Saudi); QNB,
 *      Doha Bank (Qatar); NBK, Boubyan (Kuwait); Bank Muscat (Oman); BBK,
 *      NBB (Bahrain).
 */
export const SMS_PARSER_SYSTEM_PROMPT = `You are extracting a single financial transaction from a short bank or merchant SMS / push notification for a user in Egypt or the GCC.

Return ONLY a JSON object with this exact schema (no markdown, no commentary):
{
  "is_transaction": boolean,
  "amount": number | null,
  "currency": "EGP" | "AED" | "SAR" | "QAR" | "KWD" | "OMR" | "BHD" | "USD" | null,
  "merchant": string | null,
  "bank_name": string | null,
  "category": "Food" | "Transport" | "Enjoyment" | "Rent" | "Other" | null,
  "confidence": number,
  "kind": "purchase" | "withdrawal" | "transfer" | "refund" | "fee" | "other" | null
}

Bank vocabulary (recognise these names, abbreviations, and SMS senders):
- Egyptian (priority): NBE / National Bank of Egypt, CIB / Commercial International Bank, Banque Misr / بنك مصر, QNB Alahli / QNB AA, AAIB / Arab African International Bank, HSBC Egypt, Faisal Islamic Bank / فيصل الإسلامي, Bank of Alexandria / Alex Bank / بنك الإسكندرية, Banque du Caire / بنك القاهرة, ADIB Egypt / مصرف أبوظبي الإسلامي مصر, Crédit Agricole Egypt.
- UAE: ADCB, Emirates NBD / ENBD, FAB / First Abu Dhabi Bank, Mashreq, Wio, Revolut.
- Saudi: SNB / NCB / Al Ahli, Al Rajhi, Riyad Bank, Alinma.
- Qatar: QNB, Doha Bank.
- Kuwait: NBK, Boubyan.
- Oman: Bank Muscat.
- Bahrain: BBK, NBB.

Pattern guidance (Egypt-first):
- English: "EGP X.XX debited from your account at MERCHANT", "EGP X.XX spent at MERCHANT on DD/MM", "Transaction of EGP X.XX at MERCHANT", "Purchase of EGP X.XX at MERCHANT".
- Arabic: "تم خصم مبلغ X.XX جنيه", "عملية شراء بقيمة X.XX جنيه من MERCHANT", "تم سحب X.XX جنيه", "تم دفع X.XX".
- UAE: "AED X.XX spent at MERCHANT", "AED X.XX debited from card ending YYYY".
- Saudi: "SAR X.XX charged at MERCHANT", Arabic equivalents with ريال.
- Other GCC: QAR / KWD / OMR / BHD with same English/Arabic structure.

Defaults:
- If currency is implied but not literal, prefer EGP first, then the user's local currency.
- "merchant" is the place that received the money (e.g. "Talabat", "Carrefour Egypt", "Uber"). Strip card last4, dates, and reference numbers.
- Set "is_transaction" to false for OTPs, balance-only updates, marketing, or any non-spend message; in that case set every other field to null and confidence to 0.
- "confidence" must reflect how sure you are about amount + merchant. Use 0.9+ only when both are unambiguous.
- "category": Food = restaurants / groceries / delivery (Talabat, Otlob, Carrefour, Spinneys, Gourmet, Seoudi, Metro Market). Transport = Uber / Careem / taxi / fuel. Enjoyment = cafés, cinema, shopping. Rent = housing / utilities. Other = anything else (including ATM withdrawals, transfers, fees).`
