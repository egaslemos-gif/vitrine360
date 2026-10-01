import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  GraduationCap,
  Landmark,
  Layers,
  Play,
  PlayCircle,
  Presentation,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tv,
  Hand,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InteractivePlayerDemo } from "@/components/landing/interactive-player-demo";
import { LandingMobileMenu } from "./landing-mobile-menu";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const NAV = [
  { href: "#produto", label: "Produto" },
  { href: "#player", label: "Player" },
  { href: "#casos", label: "Casos de uso" },
  { href: "#fiabilidade", label: "Fiabilidade" },
];

const PASTELS = [
  "bg-violet-100 text-violet-600",
  "bg-sky-100 text-sky-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-teal-100 text-teal-600",
  "bg-fuchsia-100 text-fuchsia-600",
  "bg-indigo-100 text-indigo-600",
];

const CAPABILITIES: { icon: Icon; title: string; body: string; tone: string }[] = [
  {
    icon: Layers,
    title: "Criar",
    body: "Biblioteca de media, templates e estúdio de conteúdos: imagem, vídeo, áudio, GIF, relógio, avisos e QR code.",
    tone: "from-violet-500 to-indigo-500",
  },
  {
    icon: Send,
    title: "Distribuir",
    body: "Playlists, grupos de ecrãs e agendamentos levam o conteúdo certo ao ecrã certo, à hora certa.",
    tone: "from-sky-500 to-blue-600",
  },
  {
    icon: PlayCircle,
    title: "Reproduzir",
    body: "Um player pensado para TVs, quiosques e browsers. Guarda o conteúdo localmente e continua a reproduzir sem rede.",
    tone: "from-fuchsia-500 to-violet-600",
  },
  {
    icon: SlidersHorizontal,
    title: "Controlar",
    body: "Veja que ecrãs estão online e comande a reprodução: play, pausa, seguinte, anterior e volume.",
    tone: "from-emerald-500 to-teal-600",
  },
];

const PLAYER_POINTS = [
  "Vídeo, imagem, áudio, GIF e experiências interactivas",
  "Transições suaves e ajuste do conteúdo ao ecrã",
  "Compatível com Smart TVs e browsers modernos",
  "Modo de ecrã inteiro, pronto para sinalização",
  "Retoma sozinho depois de uma falha de rede",
];

const USE_CASES: { icon: Icon; label: string }[] = [
  { icon: Tv, label: "Sinalização digital" },
  { icon: Presentation, label: "Apresentações corporativas" },
  { icon: GraduationCap, label: "Educação" },
  { icon: CalendarDays, label: "Eventos" },
  { icon: Building2, label: "Ecrãs de recepção" },
  { icon: Hand, label: "Quiosques interactivos" },
  { icon: Store, label: "Retalho" },
  { icon: Landmark, label: "Comunicação institucional" },
];

const RELIABILITY = [
  "Runtime de dispositivo offline-first",
  "Observabilidade e diagnóstico dos ecrãs",
  "Espaços de trabalho isolados (multi-tenant)",
  "Distribuição de conteúdo controlada",
  "Experiências executadas em sandbox",
];

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.18em]",
        dark ? "text-[var(--color-primary-light)]" : "text-[var(--color-primary)]",
      )}
    >
      {children}
    </p>
  );
}

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const primaryHref = signedIn ? "/admin" : "/admin/login";
  const primaryLabel = signedIn ? "Abrir consola" : "Começar agora";

  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
      {/* ───────── Header ───────── */}
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary)] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(112,87,220,0.35)]"
            >
              V
            </span>
            <span
              className="truncate text-xl font-bold tracking-tight text-[var(--color-foreground)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Vitrine360
            </span>
          </Link>

          <nav
            className="hidden items-center gap-7 text-sm font-medium text-[var(--color-text-secondary)] md:flex"
            aria-label="Principal"
          >
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-[var(--color-primary)]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {!signedIn && (
              <Link
                href="/admin/login"
                className="hidden text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] md:inline"
              >
                Entrar
              </Link>
            )}
            <Link
              href={primaryHref}
              className="inline-flex h-10 items-center rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(112,87,220,0.3)] transition-all hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]"
            >
              {primaryLabel}
            </Link>
            <LandingMobileMenu
              items={NAV}
              signInHref="/admin/login"
              signInLabel={signedIn ? "Consola" : "Entrar"}
            />
          </div>
        </div>
      </header>

      <main>
        {/* ───────── Hero ───────── */}
        <section className="relative isolate overflow-x-clip">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute -right-24 -top-32 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(167,148,255,0.5),transparent_65%)]" />
            <div className="absolute -bottom-40 -left-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(125,196,255,0.35),transparent_65%)]" />
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 pb-12 pt-8 sm:gap-10 sm:px-6 sm:pb-16 sm:pt-12 lg:gap-12 lg:pt-14 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="min-w-0 xl:pt-12">
              <h1 className="text-[2.15rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl xl:text-[3.5rem]">
                Todos os seus ecrãs.{" "}
                <span className="bg-gradient-to-r from-[#7057dc] via-[#8f78ee] to-[#3fa7ef] bg-clip-text text-transparent">
                  Um só painel de controlo.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
                Crie, distribua e controle o conteúdo dos seus ecrãs, mesmo sem
                internet.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={primaryHref}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-7 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(112,87,220,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-[0_14px_32px_rgba(112,87,220,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a
                  href="#player"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/80 bg-white/80 px-7 text-[15px] font-medium text-[var(--color-foreground)] shadow-[var(--shadow-subtle)] transition-all hover:bg-white hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  Ver o player em acção
                </a>
              </div>
            </div>

            {/* The Player is the hero */}
            <div className="relative min-w-0">
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_40%,rgba(112,87,220,0.28),transparent_70%)] blur-2xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 shadow-[0_30px_70px_-24px_rgba(88,64,180,0.4)]">
                <InteractivePlayerDemo size="hero" showPlaylist playlistLayout="below" />
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Produto ───────── */}
        <section id="produto" className="scroll-mt-16">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <Eyebrow>Produto</Eyebrow>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Do conteúdo ao ecrã, sem complicações.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
              Uma única plataforma para preparar, entregar, reproduzir e
              supervisionar tudo o que aparece nos seus ecrãs.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {CAPABILITIES.map(({ icon: I, title, body, tone }) => (
                <article
                  key={title}
                  className="group rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[var(--shadow-card)] backdrop-blur transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-floating)]"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                      tone,
                    )}
                  >
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Player + Controlo remoto ───────── */}
        <section id="player" className="scroll-mt-16 px-4 py-6 sm:px-6">
          <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[2rem] border border-white/80 bg-white/65 p-6 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-14">
            <div className="min-w-0">
              <Eyebrow>O player</Eyebrow>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                O coração do Vitrine360 está no ecrã.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
                Um player robusto, desenhado para correr dia e noite em TVs,
                quiosques e computadores, e para ser comandado à distância.
              </p>
              <ul className="mt-6 space-y-3">
                {PLAYER_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15px] text-[var(--color-foreground)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="min-w-0 rounded-[1.75rem] border border-white/90 bg-white/85 p-4 shadow-[0_24px_60px_-28px_rgba(88,64,180,0.4)] sm:p-5"
              role="img"
              aria-label="Exemplo do painel de controlo remoto de um ecrã"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    Controlo remoto
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-foreground)]">Recepção Principal</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-3xl bg-gradient-to-br from-[#d9d0ff] via-[#e9e4ff] to-[#cfe6ff]">
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-[0_10px_30px_rgba(88,64,180,0.3)] backdrop-blur">
                    <Play className="ml-0.5 h-6 w-6 text-[var(--color-primary)]" aria-hidden />
                  </span>
                </div>
                <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-full bg-white/60 px-4 py-2.5 backdrop-blur-xl">
                  <span className="text-[11px] font-medium tabular-nums text-[var(--color-text-secondary)]">06:42</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/80">
                    <div className="h-full w-2/5 rounded-full bg-[var(--color-primary)]" />
                  </div>
                  <span className="text-[11px] font-medium tabular-nums text-[var(--color-text-secondary)]">24:18</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {["Anterior", "Pausa", "Seguinte", "Volume"].map((label, i) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-medium",
                      i === 1
                        ? "bg-[var(--color-primary)] text-white shadow-[0_6px_16px_rgba(112,87,220,0.3)]"
                        : "border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Casos de uso ───────── */}
        <section id="casos" className="scroll-mt-16">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <Eyebrow>Casos de uso</Eyebrow>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Feito para ambientes reais.
            </h2>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {USE_CASES.map(({ icon: I, label }, i) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[var(--shadow-subtle)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
                >
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", PASTELS[i % PASTELS.length])}>
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 text-sm font-medium leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── Fiabilidade ───────── */}
        <section id="fiabilidade" className="scroll-mt-16">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <Eyebrow>Fiabilidade</Eyebrow>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Bases operacionais que já funcionam.
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RELIABILITY.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-3 rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[var(--shadow-subtle)]"
                >
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
                  <span className="text-sm font-medium leading-snug">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── CTA final ───────── */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#7a62e3] via-[#8b74ee] to-[#a28df3] px-6 py-14 text-center text-white shadow-[0_24px_60px_-24px_rgba(112,87,220,0.6)] sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
              <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
            </div>
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Ponha os seus ecrãs a trabalhar para si.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              Conteúdos, ecrãs e reprodução num só lugar. Comece em minutos.
            </p>
            <Link
              href={primaryHref}
              className="group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[var(--color-primary)] shadow-[0_10px_26px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-white/70 bg-white/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p
              className="text-lg font-bold text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Vitrine360
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Plataforma de sinalização digital e apresentações
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[var(--color-foreground)]">
                {item.label}
              </a>
            ))}
            <Link href="/admin/login" className="hover:text-[var(--color-foreground)]">
              {signedIn ? "Consola" : "Entrar"}
            </Link>
          </nav>
        </div>
        <div className="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted-foreground)]">
          © {new Date().getFullYear()} Vitrine360
        </div>
      </footer>
    </div>
  );
}
