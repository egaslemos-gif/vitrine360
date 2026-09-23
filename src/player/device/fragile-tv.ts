/** NetRange/Sraf and similar Smart TV browsers often break on SW + IndexedDB. */
export function isFragileSmartTvBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(
    ua,
  );
}
