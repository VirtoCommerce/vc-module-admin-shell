// The path the user opened, e.g. #/orders. Routes of plugin modules don't exist until the plugins load,
// so the router first falls back to the root; App re-applies this path once the modules are ready.
// "#!/..." is an AngularJS-style link (the platform's password-reset email); the router reads it as "/!/..."
const requestedPath = window.location.hash.replace(/^#!?/, "") || "/";

// the sign-in pages: after signing in, the sign-in flow decides where to go, not the page the tab was opened on
const AUTH_PATHS = ["/login", "/invite", "/resetpassword", "/forgot-password", "/changepassword"];

let pending: string | undefined =
  requestedPath === "/" ||
  AUTH_PATHS.some((p) => requestedPath === p || requestedPath.startsWith(`${p}?`) || requestedPath.startsWith(`${p}/`))
    ? undefined
    : requestedPath;

/**
 * The deep link to re-open, once per page load: App mounts again after a sign-out and sign-in, and by then the link the
 * page was loaded with is history (the sign-in flow has its own target).
 */
export function takeRequestedPath(): string | undefined {
  const path = pending;
  pending = undefined;
  return path;
}
