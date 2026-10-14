// The path the user opened, e.g. #/orders. Routes of plugin modules don't exist until the plugins load,
// so the router first falls back to the root; App re-applies this path once the modules are ready.
export const requestedPath = window.location.hash.replace(/^#/, "") || "/";
