import { getSession } from "@/lib/auth";
import { LandingPage } from "@/features/marketing/landing-page";

export default async function HomePage() {
  const session = await getSession();
  return <LandingPage signedIn={Boolean(session)} />;
}
