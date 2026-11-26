// Legal texts: Privacy Policy, Terms of Use, account deletion. Uzbek first, full English version
// below (Google Play reviewers read English). Update LEGAL_UPDATED whenever the text changes.

export const LEGAL_UPDATED = "2026-11-25";
export const OPERATOR = "Supernova’s jamoasi (Bookly loyihasi)";
export const OPERATOR_EN = "the Supernova’s team (the Bookly project)";
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
export const SUPPORT_TELEGRAM = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || "";

export interface LegalSection {
  id: string;
  h: string;
  p?: string[];
  ul?: string[];
  /** Paragraphs shown after the list. */
  after?: string[];
}

const contactUz = () =>
  [SUPPORT_EMAIL && `email: ${SUPPORT_EMAIL}`, SUPPORT_TELEGRAM && `Telegram: ${SUPPORT_TELEGRAM}`].filter(Boolean).join(", ") ||
  "ilova ichidagi “Yordam” bo‘limi";
const contactEn = () =>
  [SUPPORT_EMAIL && `email: ${SUPPORT_EMAIL}`, SUPPORT_TELEGRAM && `Telegram: ${SUPPORT_TELEGRAM}`].filter(Boolean).join(", ") ||
  "the in-app Help section";

// ─── Privacy Policy ──────────────────────────────────────────────────────────

export const privacyUz = (): LegalSection[] => [
  {
    id: "kim",
    h: "1. Biz kimmiz",
    p: [
      `Bookly — kitoblarning qisqacha mazmunlari orqali o‘qish, tinglash va ingliz tilini mashq qilish xizmati (veb-sayt va Android ilova). Xizmatni ${OPERATOR} boshqaradi. Ushbu siyosat qanday ma’lumot yig‘ishimiz, undan qanday foydalanishimiz va sizning huquqlaringizni tushuntiradi.`,
    ],
  },
  {
    id: "yigamiz",
    h: "2. Qanday ma’lumotlarni yig‘amiz",
    ul: [
      "Hisob ma’lumotlari (faqat Google orqali kirsangiz): ism, email manzil, profil rasmi va Google hisob identifikatori. Parolingizni hech qachon olmaymiz.",
      "O‘qish ma’lumotlari: darslardagi progress, saqlangan darslar, mashq natijalari, sozlamalar (mavzu, matn o‘lchami, tezlik) va AI tushuntirishlardan kunlik foydalanish soni.",
      "Siz yozgan kontent: baholar va sharhlar (ismingiz va profil rasmingiz sharh yonida boshqalarga ko‘rinadi), shikoyatlar va ularning sababi.",
      "Ilovadan foydalanish statistikasi: qaysi darslar ochilgani, tugatilgani, rejim almashtirilgani kabi hodisalar. Ular tasodifiy qurilma identifikatori (anonim ID) va kirgan bo‘lsangiz hisob ID bilan bog‘lanadi.",
      "Kutish ro‘yxati: email, ism va (ixtiyoriy) Telegram foydalanuvchi nomi — agar o‘zingiz qoldirsangiz.",
      "Xaridlar (Premium): to‘lovni Google Play amalga oshiradi. Biz karta ma’lumotlarini ko‘rmaymiz; faqat obuna holati, muddati va xarid identifikatorini olamiz.",
    ],
    after: [
      "Biz joylashuv, kontaktlar, rasmlar, mikrofon yoki kamera ma’lumotlarini yig‘maymiz. Ilovada reklama va reklama kuzatuv vositalari yo‘q.",
    ],
  },
  {
    id: "qurilma",
    h: "3. Qurilmangizda saqlanadigan ma’lumotlar",
    p: [
      "Progress, sozlamalar va yuklab olingan darslar (oflayn tinglash uchun) qurilmangiz xotirasida saqlanadi. Eslatmalar (kunlik bildirishnoma) qurilmaning o‘zida rejalashtiriladi — buning uchun biz hech qanday push-token yig‘maymiz. Ularni ilova sozlamalaridan yoki ilovani o‘chirib tashlash orqali o‘chirishingiz mumkin.",
    ],
  },
  {
    id: "foydalanamiz",
    h: "4. Ma’lumotlardan nima uchun foydalanamiz",
    ul: [
      "Hisobingizga kirish va progressni barcha qurilmalaringizda sinxronlash;",
      "Premium obunani tekshirish va AI limitlarini qo‘llash;",
      "Sharhlarni ko‘rsatish va nomaqbul kontentni moderatsiya qilish;",
      "Xizmatni yaxshilash (qaysi darslar foydali ekanini tushunish) va suiiste’molning oldini olish;",
      "Siz so‘ragan xabarlarni yuborish (masalan, ishga tushish haqida email).",
    ],
    after: ["Ma’lumotlaringizni sotmaymiz va reklama maqsadida boshqalarga bermaymiz."],
  },
  {
    id: "uchinchi",
    h: "5. Ma’lumotlarni qayta ishlovchi xizmatlar",
    ul: [
      "Supabase — ma’lumotlar bazasi va hisobga kirish (Google OAuth).",
      "Google — Google orqali kirish va Google Play to‘lovlari.",
      "RevenueCat — Google Play obunalarini tekshirish (Bookly hisob ID va xarid ma’lumotlari).",
      "Anthropic (Claude) — “Tushuntir” funksiyasi. Unga faqat darsdagi jumla matni yuboriladi; shaxsiy ma’lumotlaringiz yuborilmaydi.",
      "Hosting provayderi — veb-sayt va ilova kontentini yetkazib berish (texnik jurnallar, masalan IP manzil, qisqa muddat saqlanadi).",
    ],
    after: ["Bu xizmatlar ma’lumotlarni faqat bizning topshirig‘imiz bilan va o‘z maxfiylik majburiyatlari doirasida qayta ishlaydi. Ular O‘zbekistondan tashqarida joylashgan bo‘lishi mumkin."],
  },
  {
    id: "himoya",
    h: "6. Xavfsizlik",
    p: [
      "Barcha ulanishlar HTTPS orqali shifrlanadi. Ma’lumotlar bazasi qatorlar darajasidagi himoya (Row Level Security) bilan himoyalangan: har bir foydalanuvchi faqat o‘z ma’lumotlarini ko‘ra oladi.",
    ],
  },
  {
    id: "muddat",
    h: "7. Saqlash muddati",
    p: [
      "Hisob ma’lumotlari hisobingiz mavjud ekan saqlanadi. Hisobni o‘chirsangiz, profil, progress, sharhlar, shikoyatlaringizdagi ID, statistika hodisalari va kutish ro‘yxatidagi yozuv darhol o‘chiriladi; zaxira nusxalardan 30 kun ichida yo‘qoladi. Xaridlar haqidagi yozuvlar qonun talab qilgan muddat saqlanishi mumkin.",
    ],
  },
  {
    id: "huquqlar",
    h: "8. Sizning huquqlaringiz",
    ul: [
      "Ma’lumotlaringiz nusxasini so‘rash, ularni tuzatish yoki o‘chirish;",
      "Hisobni istalgan vaqtda ilovadan o‘chirish: Hisob → Hisobni o‘chirish (yoki /account/delete sahifasi);",
      "Bildirishnomalarni o‘chirish va statistikaga rozilikni qaytarib olish.",
    ],
    after: [`So‘rov uchun bog‘laning: ${contactUz()}. 30 kun ichida javob beramiz.`],
  },
  {
    id: "bolalar",
    h: "9. Bolalar",
    p: ["Bookly 13 yoshdan katta foydalanuvchilar uchun mo‘ljallangan. 13 yoshgacha bo‘lgan bolalardan bila turib ma’lumot yig‘maymiz; bunday holatni bilsak, ma’lumot o‘chiriladi."],
  },
  {
    id: "ozgarish",
    h: "10. O‘zgarishlar va aloqa",
    p: [
      `Siyosat o‘zgarsa, shu sahifadagi sanani yangilaymiz va muhim o‘zgarishlar haqida ilovada xabar beramiz. Savollar uchun: ${contactUz()}.`,
    ],
  },
];

export const privacyEn = (): LegalSection[] => [
  {
    id: "en-who",
    h: "1. Who we are",
    p: [
      `Bookly is a service (website and Android app) for reading and listening to short nonfiction book summaries and practising English. It is operated by ${OPERATOR_EN}. This policy explains what we collect, how we use it and your rights.`,
    ],
  },
  {
    id: "en-collect",
    h: "2. Data we collect",
    ul: [
      "Account data (only if you sign in with Google): name, email address, profile photo and Google account identifier. We never receive your password.",
      "Learning data: lesson progress, saved lessons, practice results, preferences (theme, text size, speed) and your daily count of AI explanations.",
      "Content you create: ratings and reviews (your name and profile photo are shown publicly next to a review), and reports you submit with their reason.",
      "App usage analytics: events such as lesson opened, completed or mode changed, linked to a random device identifier and, if signed in, your account ID.",
      "Waitlist: email, name and (optional) Telegram username, only if you provide them.",
      "Purchases (Premium): payments are processed by Google Play. We never see card details; we receive subscription status, expiry and a purchase identifier.",
    ],
    after: ["We do not collect location, contacts, photos, microphone or camera data. The app contains no ads and no advertising trackers."],
  },
  {
    id: "en-device",
    h: "3. Data stored on your device",
    p: [
      "Progress, preferences and downloaded lessons (for offline listening) are stored on your device. Daily reminders are scheduled locally on the device; we do not collect push tokens. You can remove them in the app settings or by uninstalling the app.",
    ],
  },
  {
    id: "en-use",
    h: "4. How we use data",
    ul: [
      "To sign you in and sync your progress across devices;",
      "To check Premium status and apply AI usage limits;",
      "To show reviews and moderate objectionable content;",
      "To improve the service (understanding which lessons help) and prevent abuse;",
      "To send messages you asked for (e.g. a launch email).",
    ],
    after: ["We do not sell your data or share it with anyone for advertising."],
  },
  {
    id: "en-processors",
    h: "5. Service providers",
    ul: [
      "Supabase — database and authentication (Google OAuth).",
      "Google — Google Sign-In and Google Play billing.",
      "RevenueCat — Google Play subscription validation (Bookly account ID and purchase data).",
      "Anthropic (Claude) — the “Explain” feature. Only the lesson sentence text is sent; no personal data.",
      "Hosting provider — serves the website and app content (technical logs such as IP address are kept briefly).",
    ],
    after: ["These providers process data only on our instructions and under their own confidentiality obligations. They may be located outside Uzbekistan."],
  },
  {
    id: "en-security",
    h: "6. Security",
    p: ["All connections are encrypted with HTTPS. The database uses Row Level Security so each user can only access their own data."],
  },
  {
    id: "en-retention",
    h: "7. Retention",
    p: [
      "Account data is kept while your account exists. When you delete your account, your profile, progress, reviews, your ID on reports, analytics events and waitlist entry are deleted immediately and disappear from backups within 30 days. Purchase records may be retained where the law requires.",
    ],
  },
  {
    id: "en-rights",
    h: "8. Your rights",
    ul: [
      "Request a copy of your data, correct it or delete it;",
      "Delete your account at any time in the app: Account (Hisob) → Delete account (or the /account/delete page);",
      "Turn off notifications and withdraw consent to analytics.",
    ],
    after: [`Contact us: ${contactEn()}. We reply within 30 days.`],
  },
  {
    id: "en-children",
    h: "9. Children",
    p: ["Bookly is intended for users aged 13 and over. We do not knowingly collect data from children under 13; if we learn of it, we delete it."],
  },
  {
    id: "en-changes",
    h: "10. Changes and contact",
    p: [`If this policy changes we update the date on this page and announce important changes in the app. Questions: ${contactEn()}.`],
  },
];

// ─── Terms of Use ────────────────────────────────────────────────────────────

export const termsUz = (): LegalSection[] => [
  {
    id: "xizmat",
    h: "1. Xizmat",
    p: [
      `Bookly kitob g‘oyalarining qisqacha mazmunlari, audio, tarjima va mashqlarni taqdim etadi. Xizmatdan foydalanib, siz ushbu shartlar va Maxfiylik siyosatiga rozilik bildirasiz. Xizmatni ${OPERATOR} boshqaradi.`,
    ],
  },
  {
    id: "hisob",
    h: "2. Hisob",
    p: [
      "Bookly’dan hisobsiz ham foydalanish mumkin. Google orqali kirsangiz, hisobingiz xavfsizligi uchun o‘zingiz javobgarsiz. Hisobni istalgan vaqtda ilovaning o‘zida o‘chirishingiz mumkin. Xizmatdan foydalanish uchun kamida 13 yoshda bo‘lishingiz kerak.",
    ],
  },
  {
    id: "kontent",
    h: "3. Foydalanuvchi kontenti (sharhlar) va qoidalar",
    p: [
      "Baho va sharh qoldirganingizda, Bookly’ga uni xizmatda ko‘rsatish uchun bepul, eksklyuziv bo‘lmagan ruxsat berasiz. Kontentingiz uchun o‘zingiz javobgarsiz.",
      "Nomaqbul kontentga mutlaqo yo‘l qo‘yilmaydi. Quyidagilar taqiqlanadi:",
    ],
    ul: [
      "haqorat, tahdid, ta’qib, nafrat yoki kamsitish;",
      "behayo, zo‘ravonlik yoki noqonuniy kontent;",
      "spam, reklama, firibgarlik havolalari;",
      "boshqa shaxslarning shaxsiy ma’lumotlari yoki mualliflik huquqi bilan himoyalangan matnlar.",
    ],
  },
  {
    id: "moderatsiya",
    h: "4. Shikoyat va moderatsiya",
    p: [
      "Har bir sharh va AI tushuntirish yonidagi “Shikoyat qilish” tugmasi orqali nomaqbul kontent haqida xabar bering. Shikoyatlarni 24 soat ichida ko‘rib chiqamiz, qoidabuzar kontentni o‘chiramiz va takroriy qoidabuzarlarning hisobini bloklaymiz. Bir nechta shikoyat olgan sharh avtomatik yashiriladi. Istalgan foydalanuvchining sharhlarini o‘zingiz uchun yashirishingiz ham mumkin.",
    ],
  },
  {
    id: "ai",
    h: "5. AI tushuntirishlar",
    p: [
      "“Tushuntir” funksiyasi sun’iy intellekt (Anthropic Claude) yordamida ishlaydi. Javoblarda xatolar bo‘lishi mumkin — ularni o‘quv yordami sifatida qabul qiling. Noto‘g‘ri yoki nomaqbul javobni “Shikoyat qilish” orqali bildiring.",
    ],
  },
  {
    id: "mualliflik",
    h: "6. Mualliflik huquqi",
    p: [
      "Darslar Bookly jamoasi tomonidan yozilgan asl qisqacha mazmunlar va tushuntirishlardir; ular kitoblarning to‘liq matni o‘rnini bosmaydi. Kitob nomlari va muallif ismlari faqat qaysi asar haqida gap ketayotganini ko‘rsatish uchun ishlatiladi. Bookly kontentini (matn, audio, dizayn) ruxsatsiz nusxalash va tarqatish taqiqlanadi. Mualliflik huquqi buzilgan deb hisoblasangiz, biz bilan bog‘laning — so‘rovni tezda ko‘rib chiqamiz.",
    ],
  },
  {
    id: "premium",
    h: "7. Premium obuna",
    p: [
      "Android ilovada Premium Google Play orqali sotib olinadi va har oy (yoki tanlangan davrda) avtomatik yangilanadi. Obunani istalgan vaqtda Google Play → Obunalar bo‘limida bekor qilishingiz mumkin; to‘langan davr oxirigacha Premium ishlayveradi. Pulni qaytarish Google Play qoidalari asosida amalga oshiriladi. Hisobni o‘chirish obunani avtomatik bekor qilmaydi — avval Google Play’da bekor qiling.",
    ],
  },
  {
    id: "javobgarlik",
    h: "8. Javobgarlikni cheklash",
    p: [
      "Xizmat “qanday bo‘lsa, shunday” taqdim etiladi. Uzluksiz ishlashini kafolatlamaymiz va qonun ruxsat bergan darajada bilvosita zararlar uchun javobgar emasmiz. Shartlarni buzgan hisoblarni to‘xtatib qo‘yishimiz mumkin.",
    ],
  },
  {
    id: "qonun",
    h: "9. Qonun va o‘zgarishlar",
    p: [
      `Ushbu shartlarga O‘zbekiston Respublikasi qonunlari qo‘llaniladi. Shartlar o‘zgarsa, sanani yangilaymiz va muhim o‘zgarishlar haqida ilovada xabar beramiz. Aloqa: ${contactUz()}.`,
    ],
  },
];

export const termsEn = (): LegalSection[] => [
  {
    id: "en-service",
    h: "1. The service",
    p: [`Bookly provides short summaries of book ideas, audio, translations and exercises. By using the service you agree to these terms and the Privacy Policy. The service is operated by ${OPERATOR_EN}.`],
  },
  {
    id: "en-account",
    h: "2. Accounts",
    p: ["You can use Bookly without an account. If you sign in with Google you are responsible for keeping your account secure. You can delete your account in the app at any time. You must be at least 13 years old to use the service."],
  },
  {
    id: "en-ugc",
    h: "3. User content (reviews) and rules",
    p: [
      "When you post a rating or review, you give Bookly a free, non-exclusive licence to display it in the service. You are responsible for your content.",
      "There is zero tolerance for objectionable content. The following are prohibited:",
    ],
    ul: [
      "insults, threats, harassment, hate or discrimination;",
      "sexual, violent or illegal content;",
      "spam, advertising or scam links;",
      "other people’s personal data or copyrighted text.",
    ],
  },
  {
    id: "en-moderation",
    h: "4. Reporting and moderation",
    p: [
      "Use the “Report” button next to any review or AI explanation to flag objectionable content. We review reports within 24 hours, remove violating content and block repeat offenders. A review that receives several reports is hidden automatically. You can also hide any user’s reviews for yourself.",
    ],
  },
  {
    id: "en-ai",
    h: "5. AI explanations",
    p: ["The “Explain” feature is powered by artificial intelligence (Anthropic Claude). Answers may contain mistakes — treat them as a learning aid. Report incorrect or inappropriate answers with the “Report” button."],
  },
  {
    id: "en-ip",
    h: "6. Copyright",
    p: [
      "Lessons are original summaries and explanations written by the Bookly team; they do not replace the full books. Book titles and author names are used only to identify the work discussed. Copying or redistributing Bookly content (text, audio, design) without permission is prohibited. If you believe your copyright has been infringed, contact us and we will act promptly.",
    ],
  },
  {
    id: "en-premium",
    h: "7. Premium subscription",
    p: [
      "In the Android app, Premium is purchased through Google Play and renews automatically every month (or the chosen period). You can cancel at any time in Google Play → Subscriptions; Premium remains active until the end of the paid period. Refunds follow Google Play’s policies. Deleting your account does not cancel the subscription — cancel it in Google Play first.",
    ],
  },
  {
    id: "en-liability",
    h: "8. Limitation of liability",
    p: ["The service is provided “as is”. We do not guarantee uninterrupted operation and, to the extent permitted by law, are not liable for indirect damages. We may suspend accounts that break these terms."],
  },
  {
    id: "en-law",
    h: "9. Governing law and changes",
    p: [`These terms are governed by the laws of the Republic of Uzbekistan. If the terms change we update the date and announce important changes in the app. Contact: ${contactEn()}.`],
  },
];
