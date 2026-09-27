/** NetRange/Sraf and similar Smart TV browsers often break on SW + IndexedDB. */
import { isFragileSmartTvUserAgent } from "@/lib/fragile-smart-tv";

export function isFragileSmartTvBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return isFragileSmartTvUserAgent(navigator.userAgent);
}
