# Sign-in Page — Developer Guide

## Overview

The Admin Shell has its own sign-in page (`#/login`): the password form, the external sign-in providers configured on the platform (Microsoft, Google, other SSO), and a showcase panel beside the form. A module can add content **below the sign-in form** — a registration link, a notice, a help button — through vc-shell's extension point `auth:after-form`, the same point vc-shell's own sign-in page has, so a plugin written for another vc-shell app works here too.

Source: `src/VirtoCommerce.AdminShell.Web/App/src/pages/Login.vue` (`<ExtensionPoint name="auth:after-form" />`), `src/pages/AuthShell.vue` (the page frame).

## Quick start

In the plugin's `install`:

```ts
import { useExtensionPoint } from "@vc-shell/framework/extensions";
import { markRaw } from "vue";
import RequestAccessLink from "./components/RequestAccessLink.vue";

export default {
  install(app: App) {
    appModule.install(app);
    useExtensionPoint("auth:after-form").add({
      id: "my-module.request-access",    // unique; adding the same id again replaces it
      component: markRaw(RequestAccessLink),
      props: { href: "https://example.com/request-access" },
      priority: 10,                      // lower first
    });
  },
};
```

The component renders under the form, inside the sign-in card. Use vc-shell components (`VcButton`, `VcLink`) and the design tokens so it fits both themes.

## Reference

`useExtensionPoint(name)` returns `{ add(entry), remove(id) }`.

| Entry field | Type | Description |
|---|---|---|
| `id` | string | Required, unique. Prefix with the module. |
| `component` | Component | Required. Wrap with `markRaw`. |
| `props` | object | Props passed to the component. |
| `priority` | number | Order among the entries, lower first. Default `0`. |
| `meta` | object | Free metadata (e.g. `{ type: "action" }`). |

## When it runs

Plugins are loaded from the app manifest, which the platform serves without sign-in, so the extension is there before the user signs in. The user isn't known yet: the component mustn't call APIs that need authentication.

## Guidelines

- Keep it to one short line or button; the page is a sign-in form first.
- Don't collect credentials in the extension; send the user to the platform's own flows (password reset, external providers).
- Remove the entry (`remove(id)`) if the feature it links to is turned off.

## Testing

- Sign out, open `#/login`: the content shows under the form in light and dark themes and at phone width.
- A failed sign-in and the external providers still work around it.
