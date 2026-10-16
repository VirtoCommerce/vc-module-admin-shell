# Admin Shell — Architecture Overview

The Admin Shell is the Vue admin of the Virto Commerce platform, built on [vc-shell](https://github.com/VirtoCommerce/vc-shell). It runs at `/apps/admin-shell/` next to the AngularJS admin and gradually replaces it: screens that have a Vue UI open as Vue blades, the rest keep working inside the shell.

```
┌──────────────────────────── Browser: /apps/admin-shell/ ─────────────────────────────┐
│  Host app (this module, Content/admin-shell)                                          │
│  ┌────────┬───────────┬──────────────────────────────────────────────────────────┐  │
│  │ rail   │ panel     │ header: breadcrumbs · global search (Ctrl+K)              │  │
│  │ (menu  │ (menu     ├──────────────────────────────────────────────────────────┤  │
│  │ secti- │ items,    │ workspace:                                                │  │
│  │ ons)   │ pinned,   │   Vue blades  ── host's platform screens + module plugins │  │
│  │        │ recent)   │   AngularJS   ── the classic admin in an iframe            │  │
│  │        │           │   Apps        ── platform apps (Tasks, News…) in an iframe │  │
│  └────────┴───────────┴──────────────────────────────────────────────────────────┘  │
│        ▲ menu                      ▲ plugins (Module Federation remotes)              │
└────────┼───────────────────────────┼──────────────────────────────────────────────────┘
         │ GET api/admin-shell/menu  │ GET api/apps/admin-shell/manifest (platform)
┌────────┴───────────────────────────┴──────────────────────────────────────────────────┐
│ Platform + Admin Shell module: menu composer, settings layers · modules' plugins/      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## The most important points

1. **The shell is a host; modules bring their own UI.** A module ships an Admin Shell plugin (a Module Federation remote in `{module}/plugins/admin-shell/`). The platform lists installed plugins in the app manifest, and the host loads them at runtime. The shell never imports module code, so a module's UI comes and goes with the module.

2. **Nothing breaks during the migration.** Every menu item opens one of four targets: a Vue screen, an AngularJS screen (the classic admin in a persistent iframe), a platform app (an iframe), or an external URL. When a module ships a Vue screen, its plugin declares `replaces: "legacy.<id>"` and takes over the AngularJS item's place, group, pins and user settings.

3. **The menu is composed on the server, per user.** Default menu (`default-menu.json` + installed apps + plugin contributions) → global patch → role patches → the user's own pins and hidden items → permission filter. Virto Commerce ships the default, a system integrator or customer patches it through settings, each user personalises it. No layer edits another.

4. **The platform's own screens ship with the host.** Settings, Security, Modules, Dynamic properties, License, Developer tools and the user profile are rebuilt in Vue inside the host (`App/src/modules/platform`), because no module owns them.

5. **Extension happens through registries, not by changing the shell.** A plugin adds:
   - menu items (`plugin.json`);
   - global search providers (`$globalSearch`);
   - dashboard widgets (`registerDashboardWidget`);
   - widgets in other modules' blades (`registerExternalWidget`);
   - content on the sign-in page (`auth:after-form`);
   - its own blades, locales and notifications (`defineAppModule`).

   See [Extension points](README.md#extension-points).

6. **One UI for desktop and phone.** The same screens adapt: a rail and panel on desktop, a top bar and drawer on a phone. Search becomes a full-screen sheet, and dashboard widgets stack.

7. **Permissions are enforced by the server, reflected by the client.** The menu leaves out what the user may not open. Search providers and widgets declare permissions so they don't call APIs the user can't use. The API still checks every call.

## Known limits

- **Menu counters** (the badges on Orders, Returns, Quotes, Reviews and Tasks) are hard-coded in the shell (`App/src/shell/badges.ts`). There is no registry for modules yet.
- **AngularJS screens** keep their own look: the embedded classic admin is not re-themed.
- **There is no runtime white-labelling.** Logos and the product name are static assets of the host.

Next: [Technical description](technical-description.md).
