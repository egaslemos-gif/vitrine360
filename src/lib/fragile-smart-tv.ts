/**
 * Detect fragile Smart TV browsers (Sraf / Hisense / webOS / Tizen / …).
 * Safe for server (UA string) and client (navigator.userAgent).
 */
export const FRAGILE_SMART_TV_UA =
  /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i;

export function isFragileSmartTvUserAgent(
  ua: string | null | undefined,
): boolean {
  return FRAGILE_SMART_TV_UA.test(ua || "");
}
