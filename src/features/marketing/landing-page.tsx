import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InteractivePlayerDemo } from "@/components/landing/interactive-player-demo";

const CAPABILITIES = [
  {
    key: "CREATE",
    title: "Create",
    body: "Create and organize digital content for every screen.",
  },
  {
    key: "DISTRIBUTE",
    title: "Distribute",
    body: "Deliver the right content to the right displays and groups.",
  },
  {
    key: "PLAY",
    title: "Play",
    body: "Run media, playlists and experiences with a reliable runtime.",
  },
  {
    key: "CONTROL",
    title: "Control",
    body: "Supervise devices and prepare remote presentation control.",
  },
] as const;

const USE_CASES = [
  "Digital Signage",
  "Corporate Presentations",
  "Education",
  "Events",
  "Reception Displays",
  "Interactive Kiosks",
  "Retail",
  "Institutional Communication",
];

const RELIABILITY = [
  "Offline-first device runtime",
  "Device observability & diagnostics",
  "Multi-tenant workspace architecture",
  "Controlled content distribution",
  "Sandboxed Experience Runtime",
];

function CtaLink({
  href,
  children,
  variant = "default",
  size = "default",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  );
}

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const primaryHref = signedIn ? "/admin" : "/admin/login";
  const primaryLabel = signedIn ? "Open console" : "Get started";

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header className="glass-panel sticky top-0 z-40 border-b border-white/50">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-baseline gap-2">
            <span
              className="truncate text-xl font-semibold tracking-tight text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Vitrine360
            </span>
            <span className="hidden text-xs text-[var(--color-muted-foreground)] sm:inline">
              Digital Display & Presentation
            </span>
          </Link>
          <nav
            className="hidden items-center gap-6 text-sm text-[var(--color-text-secondary)] md:flex"
            aria-label="Product"
          >
            <a href="#product" className="hover:text-[var(--color-foreground)]">
              Product
            </a>
            <a href="#platform" className="hover:text-[var(--color-foreground)]">
              Platform
            </a>
            <a href="#use-cases" className="hover:text-[var(--color-foreground)]">
              Use Cases
            </a>
            <a href="#reliability" className="hover:text-[var(--color-foreground)]">
              Resources
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!signedIn && (
              <Link
                href="/admin/login"
                className="hidden text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] sm:inline"
              >
                Sign in
              </Link>
            )}
            <CtaLink href={primaryHref} size="sm">
              {primaryLabel}
            </CtaLink>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 82% 8%, rgba(147,197,253,0.55), transparent 58%), radial-gradient(ellipse 55% 45% at 8% 88%, rgba(196,181,253,0.5), transparent 60%), linear-gradient(160deg, #eef4ff 0%, #f4f0ff 48%, #faf8ff 100%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-12 lg:pb-20 lg:pt-16">
            <div className="max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                Digital Display & Presentation
              </p>
              <p
                className="mt-3 text-4xl font-bold tracking-[-0.03em] text-[var(--color-primary)] sm:text-5xl"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                Vitrine360
              </p>
              <h1 className="mt-4 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--color-foreground)] sm:text-5xl lg:text-[3.75rem] lg:leading-[1.02]">
                Turn every screen into a digital experience.
              </h1>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[19px]">
                Create, distribute, play and control digital content across
                displays and interactive devices.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CtaLink href={primaryHref} size="lg">
                  {primaryLabel}
                </CtaLink>
                <a
                  href="#player-demo"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Explore the platform
                </a>
              </div>
              <p className="mt-5 text-xs text-[var(--color-text-muted)]">
                Try the interactive player → Play, Next, Seek, Mute
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
              <div
                className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent_70%)]"
                aria-hidden
              />
              <InteractivePlayerDemo size="hero" showPlaylist className="relative" />
            </div>
          </div>
        </section>

        <section id="product" className="bg-[var(--color-background-secondary)]/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="ui-caption uppercase tracking-[0.12em]">Capabilities</p>
          <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            One platform to create, distribute, play and control.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c) => (
              <div
                key={c.key}
                className="glass-card rounded-[var(--radius-xl)] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                  {c.key}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
          </div>
        </section>

        <section
          id="player-demo"
          className="border-y border-[var(--color-border)] bg-[var(--color-background)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="ui-caption uppercase tracking-[0.12em]">Play</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Meet the Vitrine360 Player
            </h2>
            <p className="mt-3 max-w-xl text-[17px] text-[var(--color-text-secondary)]">
              Designed for media, presentations and digital displays. This is a
              local interactive demo — not connected to real devices.
            </p>
            <div className="mt-10">
              <InteractivePlayerDemo size="showcase" showPlaylist />
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="ui-caption uppercase tracking-[0.12em]">Interactive</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Go beyond digital signage.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
                Turn touch-enabled displays into interactive experiences —
                combining content, Experience Runtime and future interaction
                layers. Interactive playback is a product vision; Experience
                Runtime foundations already exist.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Touchscreen", hint: "Tap" },
                { label: "Interactive Content", hint: "Swipe" },
                { label: "Experience Runtime", hint: "Select" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="glass-card rounded-[var(--radius-xl)] px-4 py-6 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/45 active:translate-y-0 active:ring-2 active:ring-[var(--color-primary)]/35"
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    {item.hint}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="ui-caption uppercase tracking-[0.12em]">
                Remote control
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Your displays. Under your control.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
                Device Control is designed into the product experience —
                Play, Pause, Next, Previous, Stop, timeline and volume. Remote
                command transport ships in a later playback phase; the console
                already surfaces the visual concept.
              </p>
            </div>
            <div
              className="ui-player-surface relative overflow-hidden rounded-[var(--radius-2xl)] border border-white/8 p-4 shadow-[var(--shadow-modal)] sm:p-5"
              aria-hidden
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--color-player-text)]">
                  Recepção Principal
                </p>
                <span className="text-xs text-[var(--color-player-success)]">
                  ● Online
                </span>
              </div>
              <div className="ui-player-canvas relative mb-0 aspect-video overflow-hidden rounded-[var(--radius-xl)]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-player-primary)_25%,transparent),transparent_60%)]" />
                <div className="absolute inset-x-3 bottom-3 z-[2]">
                  <div className="glass-player-controls mx-auto flex max-w-sm items-center justify-center gap-1.5 rounded-full px-3 py-2">
                    {["◀◀", "▶", "❚❚", "■", "▶▶", "🔊", "⛶"].map((g, i) => (
                      <span
                        key={`${g}-${i}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] ${
                          i === 1
                            ? "bg-[var(--color-player-primary)] text-white"
                            : "text-[var(--color-player-muted)]"
                        }`}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="relative mt-2 h-1 overflow-visible rounded-full bg-white/15">
                    <div className="h-full w-2/5 rounded-full bg-[var(--color-player-primary)]" />
                    <span className="absolute top-1/2 left-[40%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="platform"
          className="border-y border-[var(--color-border)] bg-[var(--color-muted)]/35"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="ui-caption uppercase tracking-[0.12em]">Architecture</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              One platform from content creation to playback.
            </h2>
            <ol className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              {[
                "Content",
                "Playlist",
                "Distribution",
                "Device",
                "Runtime",
              ].map((step, i, arr) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium">
                    {step}
                  </span>
                  {i < arr.length - 1 ? (
                    <span
                      className="hidden text-[var(--color-muted-foreground)] sm:inline"
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="use-cases" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="ui-caption uppercase tracking-[0.12em]">Use cases</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Built for real display environments.
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <li
                key={u}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium"
              >
                {u}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="reliability"
          className="border-t border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="ui-caption uppercase tracking-[0.12em]">Reliability</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Operational foundations that already ship.
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RELIABILITY.map((r) => (
                <li
                  key={r}
                  className="border-l-2 border-[var(--color-primary)]/40 pl-4 text-sm leading-relaxed text-[var(--color-text-secondary)]"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Build better digital experiences.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--color-text-secondary)]">
            Start with your workspace console — content, devices and playback in
            one place.
          </p>
          <div className="mt-8">
            <CtaLink href={primaryHref} size="lg">
              {primaryLabel}
            </CtaLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
          <div>
            <p
              className="text-lg font-semibold text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Vitrine360
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Digital Display & Presentation Platform
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
            {[
              { h: "Product", links: ["Capabilities", "Device Control"] },
              { h: "Platform", links: ["Architecture", "Runtime"] },
              { h: "Resources", links: ["Reliability", "Console"] },
              { h: "Company", links: ["Sign in"] },
            ].map((col) => (
              <div key={col.h}>
                <p className="font-semibold">{col.h}</p>
                <ul className="mt-2 space-y-1 text-[var(--color-muted-foreground)]">
                  {col.links.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted-foreground)]">
          © {new Date().getFullYear()} Vitrine360
        </div>
      </footer>
    </div>
  );
}
