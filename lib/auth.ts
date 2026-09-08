import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * GitHub sign-in, restricted to the accounts listed in ALLOWED_LOGIN.
 *
 * Fails closed: in production, if the GitHub credentials are missing the app
 * refuses to serve rather than falling open. In development, where there is no
 * public URL, auth is skipped entirely so `npm run dev` works with no setup.
 */

export const isProduction = process.env.NODE_ENV === "production";

/**
 * AUTH_DISABLED=1 skips sign-in so `npm run dev` works on localhost, where the
 * GitHub callback URL does not point. Deliberately gated on NODE_ENV, so it can
 * never switch auth off in a deployment however the variable gets set there.
 */
const disabledForLocalDev = !isProduction && process.env.AUTH_DISABLED === "1";

export const isAuthConfigured =
  !disabledForLocalDev && Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

const allowedLogins = (process.env.ALLOWED_LOGIN ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isAuthConfigured ? [GitHub] : [],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ profile }) {
      // An empty allow-list would otherwise let any GitHub user in.
      if (allowedLogins.length === 0) return false;
      const login = String(profile?.login ?? "").toLowerCase();
      return allowedLogins.includes(login);
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

export type LocalUser = { name: string; login: string };

/**
 * Resolve the current user, or explain why there isn't one.
 *
 *   ok      - signed in, or local development with auth switched off
 *   signin  - auth is configured and nobody is signed in
 *   setup   - deployed without credentials: refuse rather than expose the data
 */
export async function resolveUser(): Promise<
  { state: "ok"; user: LocalUser } | { state: "signin" } | { state: "setup" }
> {
  if (!isAuthConfigured) {
    if (isProduction) return { state: "setup" };
    return { state: "ok", user: { name: "Local", login: "local" } };
  }

  const session = await auth();
  if (!session?.user) return { state: "signin" };

  return {
    state: "ok",
    user: {
      name: session.user.name ?? "You",
      login: session.user.email ?? session.user.name ?? "you",
    },
  };
}

/** For server actions: throws unless there is a legitimate user. */
export async function requireUser(): Promise<LocalUser> {
  const result = await resolveUser();
  if (result.state !== "ok") throw new Error("Not signed in");
  return result.user;
}
