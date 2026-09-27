import { getSession } from "@/lib/auth";
import { LandingPage } from "@/features/marketing/landing-page";

/**
 * Client boot for Smart TVs that somehow receive the React landing
 * (proxy rewrite is the primary path). Sraf cannot paint Tailwind v4 CSS.
 */
const SMART_TV_HOME_FALLBACK = `
(function(){
  try {
    var ua = navigator.userAgent || "";
    if (/Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(ua)) {
      if (location.pathname === "/" || location.pathname === "") {
        location.replace("/home-lite.html");
      }
    }
  } catch (e) {}
})();
`;

export default async function HomePage() {
  const session = await getSession();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SMART_TV_HOME_FALLBACK }} />
      <LandingPage signedIn={Boolean(session)} />
    </>
  );
}
