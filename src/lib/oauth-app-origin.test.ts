import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZED_OAUTH_HOSTS,
  AUTHORIZED_PUBLIC_OAUTH_ORIGINS,
  appOriginFrom,
  isAuthorizedOAuthOrigin,
  safeAppRelativeRedirect,
} from "./oauth-app-origin";
import {
  createOAuthTransaction,
  driveRedirectUri,
  googleRedirectUri,
  readOAuthCookie,
  signOAuthCookie,
} from "./google-oauth";

const PREV_APP = process.env.APP_URL;
const PREV_PUBLIC = process.env.NEXT_PUBLIC_APP_URL;
const PREV_SECRET = process.env.AUTH_SECRET;

test.before(() => {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    process.env.AUTH_SECRET = "test-auth-secret-for-oauth-origin-review-32b";
  }
});

test.afterEach(() => {
  if (PREV_APP === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = PREV_APP;
  if (PREV_PUBLIC === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = PREV_PUBLIC;
});

test.after(() => {
  if (PREV_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = PREV_SECRET;
});

test("allowlist is explicit (no vercel.app wildcard)", () => {
  assert.ok(AUTHORIZED_OAUTH_HOSTS.includes("vitrine360-tv.vercel.app"));
  assert.ok(AUTHORIZED_OAUTH_HOSTS.includes("vitrine360-staging.vercel.app"));
  assert.equal(
    AUTHORIZED_OAUTH_HOSTS.some((h) => h.includes("*")),
    false,
  );
  assert.equal(AUTHORIZED_PUBLIC_OAUTH_ORIGINS.length, 3);
  assert.equal(AUTHORIZED_OAUTH_HOSTS.length, 5);
});

test("isAuthorizedOAuthOrigin — HTTPS default port accepted on authorized hosts", () => {
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-tv.vercel.app"),
    true,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-staging.vercel.app"),
    true,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-psi.vercel.app"),
    true,
  );
  // Explicit default HTTPS port is equivalent to url.origin without :443
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-tv.vercel.app:443"),
    true,
  );
});

test("isAuthorizedOAuthOrigin — rejects non-default ports on public hosts", () => {
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-tv.vercel.app:8443"),
    false,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-staging.vercel.app:8443"),
    false,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-tv.vercel.app:4430"),
    false,
  );
});

test("isAuthorizedOAuthOrigin — rejects unknown host", () => {
  assert.equal(isAuthorizedOAuthOrigin("https://evil.example.com"), false);
  assert.equal(
    isAuthorizedOAuthOrigin(
      "https://vitrine360-cm33ntyyw-egaslemos-5751s-projects.vercel.app",
    ),
    false,
  );
});

test("isAuthorizedOAuthOrigin — rejects http on deployed aliases", () => {
  assert.equal(
    isAuthorizedOAuthOrigin("http://vitrine360-tv.vercel.app"),
    false,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("http://vitrine360-staging.vercel.app"),
    false,
  );
});

test("isAuthorizedOAuthOrigin — localhost HTTP only (any port)", () => {
  assert.equal(isAuthorizedOAuthOrigin("http://localhost:3000"), true);
  assert.equal(isAuthorizedOAuthOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAuthorizedOAuthOrigin("http://localhost"), true);
  assert.equal(isAuthorizedOAuthOrigin("https://localhost:3000"), false);
  assert.equal(isAuthorizedOAuthOrigin("https://127.0.0.1"), false);
});

test("isAuthorizedOAuthOrigin — malformed / empty / insecure schemes", () => {
  assert.equal(isAuthorizedOAuthOrigin(""), false);
  assert.equal(isAuthorizedOAuthOrigin("not-a-url"), false);
  assert.equal(isAuthorizedOAuthOrigin("https://"), false);
  assert.equal(isAuthorizedOAuthOrigin("//vitrine360-tv.vercel.app"), false);
  assert.equal(isAuthorizedOAuthOrigin("ftp://vitrine360-tv.vercel.app"), false);
});

test("isAuthorizedOAuthOrigin — userinfo / spoof-looking hosts rejected", () => {
  assert.equal(
    isAuthorizedOAuthOrigin("https://vitrine360-tv.vercel.app.evil.com"),
    false,
  );
  assert.equal(
    isAuthorizedOAuthOrigin("https://evil.com/@vitrine360-tv.vercel.app"),
    false,
  );
  assert.equal(
    isAuthorizedOAuthOrigin(
      "https://user:pass@vitrine360-tv.vercel.app",
    ),
    false,
  );
});

test("appOriginFrom prefers authorized request origin over APP_URL staging", () => {
  process.env.APP_URL = "https://vitrine360-staging.vercel.app";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    appOriginFrom("https://vitrine360-tv.vercel.app"),
    "https://vitrine360-tv.vercel.app",
  );
  assert.equal(
    appOriginFrom("https://vitrine360-staging.vercel.app"),
    "https://vitrine360-staging.vercel.app",
  );
});

test("appOriginFrom falls back to allowlisted APP_URL for unknown request origin", () => {
  process.env.APP_URL = "https://vitrine360-staging.vercel.app";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    appOriginFrom("https://evil.example.com"),
    "https://vitrine360-staging.vercel.app",
  );
});

test("appOriginFrom ignores unauthorized protocol/port on request and uses APP_URL", () => {
  process.env.APP_URL = "https://vitrine360-staging.vercel.app";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    appOriginFrom("http://vitrine360-tv.vercel.app"),
    "https://vitrine360-staging.vercel.app",
  );
  assert.equal(
    appOriginFrom("https://vitrine360-tv.vercel.app:8443"),
    "https://vitrine360-staging.vercel.app",
  );
});

test("appOriginFrom refuses unauthorized APP_URL (no insecure legacy passthrough)", () => {
  process.env.APP_URL = "https://evil.example.com";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.throws(() => appOriginFrom("https://evil.example.com"));
  assert.throws(() => appOriginFrom("https://random.vercel.app"));
  process.env.APP_URL = "https://vitrine360-tv.vercel.app:8443";
  assert.throws(() => appOriginFrom("https://evil.example.com"));
});

test("googleRedirectUri embeds allowlisted origin only", () => {
  process.env.APP_URL = "https://vitrine360-staging.vercel.app";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    googleRedirectUri("https://vitrine360-tv.vercel.app"),
    "https://vitrine360-tv.vercel.app/api/auth/google/callback",
  );
  assert.equal(
    googleRedirectUri("https://vitrine360-staging.vercel.app"),
    "https://vitrine360-staging.vercel.app/api/auth/google/callback",
  );
});

test("driveRedirectUri uses same allowlist (login + Drive compatible)", () => {
  process.env.APP_URL = "https://vitrine360-staging.vercel.app";
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    driveRedirectUri("https://vitrine360-tv.vercel.app"),
    "https://vitrine360-tv.vercel.app/api/admin/storage/drive/callback",
  );
  // Unknown request + allowlisted APP_URL → staging Drive callback (not external)
  assert.equal(
    driveRedirectUri("https://evil.example.com"),
    "https://vitrine360-staging.vercel.app/api/admin/storage/drive/callback",
  );
  process.env.APP_URL = "https://evil.example.com";
  assert.throws(() => driveRedirectUri("https://evil.example.com"));
});

test("safeAppRelativeRedirect stays on request host", () => {
  const dest = safeAppRelativeRedirect(
    "https://vitrine360-tv.vercel.app/api/auth/google/callback",
    "/admin",
  );
  assert.equal(dest.origin, "https://vitrine360-tv.vercel.app");
  assert.equal(dest.pathname, "/admin");
});

test("safeAppRelativeRedirect rejects absolute / // / backslash open redirects", () => {
  assert.throws(() =>
    safeAppRelativeRedirect(
      "https://vitrine360-tv.vercel.app/x",
      "https://evil.example.com/phish",
    ),
  );
  assert.throws(() =>
    safeAppRelativeRedirect(
      "https://vitrine360-tv.vercel.app/x",
      "//evil.example.com",
    ),
  );
  assert.throws(() =>
    safeAppRelativeRedirect(
      "https://vitrine360-tv.vercel.app/x",
      "/\\evil.example.com",
    ),
  );
  assert.throws(() =>
    safeAppRelativeRedirect(
      "https://vitrine360-tv.vercel.app/x",
      "\\\\evil.example.com",
    ),
  );
});

test("OAuth state is bound to signed cookie; missing / altered / invalid rejected", async () => {
  const tx = createOAuthTransaction();
  const cookie = await signOAuthCookie(tx);
  const ok = await readOAuthCookie(cookie);
  assert.ok(ok);
  assert.equal(ok!.state, tx.state);
  assert.equal(ok!.nonce, tx.nonce);
  assert.equal(ok!.verifier, tx.verifier);

  assert.equal(await readOAuthCookie(""), null);
  assert.equal(await readOAuthCookie("not-a-jwt"), null);

  const tampered = cookie.slice(0, -4) + "abcd";
  assert.equal(await readOAuthCookie(tampered), null);

  const other = createOAuthTransaction();
  assert.notEqual(other.state, tx.state);
  const otherCookie = await signOAuthCookie(other);
  const otherTx = await readOAuthCookie(otherCookie);
  assert.ok(otherTx);
  assert.notEqual(otherTx!.state, tx.state);
  // Caller binding: cookie state must equal query state
  assert.equal(otherTx!.state === tx.state, false);
});
