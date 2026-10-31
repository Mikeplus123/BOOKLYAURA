// Pricing is still being validated. Set NEXT_PUBLIC_PREMIUM_PRICE_UZS (e.g. 29000) to show a price;
// until then the page collects "I'm interested" sign-ups (a willingness-to-pay signal).
const raw = Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_UZS);
export const PREMIUM_PRICE_UZS: number | null = Number.isFinite(raw) && raw > 0 ? raw : null;
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
export const SUPPORT_TELEGRAM = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || "https://t.me/";

export function formatUzs(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} so‘m`;
}
