import "server-only";
import { headers } from "next/headers";
import { isAppUserAgent } from "./platform";

/** Server Components / Route Handlers: is this request coming from the Bookly Android app? */
export async function isAppRequest(): Promise<boolean> {
  const h = await headers();
  return isAppUserAgent(h.get("user-agent"));
}
