import Link from "next/link";
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Link href="/admin">Admin Console</Link>
    </main>
  );
}
