# Embedded Apps — Developer Guide

## Overview

Platform **apps** are separate front-ends a module ships (Tasks, News, Builder.io, Google Analytics…), served by the platform at `/apps/{appId}/` and declared in the module's `module.manifest`. The Admin Shell shows them inside its layout, in a frame, so a user reaches them from the shell's menu and search like any other screen.

Embedding is the fallback for an app that isn't an Admin Shell plugin yet. A vc-shell app that becomes a plugin gets real Vue screens instead (see [Plugins](plugins.md)).

Source: `src/VirtoCommerce.AdminShell.Web/App/src/pages/FramePage.vue` (the frame), `src/VirtoCommerce.AdminShell.Data/Services/DefaultMenuBuilder.cs` (apps in the menu), `src/shell/search/providers/platform.ts` (the *Apps* search group).

## How an app gets into the shell

| The module… | The shell shows |
|---|---|
| declares `<app>` with `<placement>MainMenu</placement>` (or the older `<supportEmbeddedMode>true</supportEmbeddedMode>`) | an item `app.{appId}` in the *Apps* section, opening the app in a frame |
| is listed in `Content/default-menu.json` with an `app` target | that item, in its section and group (Tasks under Home, News under Marketing & Content), optionally with the app's pages as children |
| is listed in `Content/default-menu.json` with a `url` target | an item that opens the app in a new browser tab (apps whose site refuses to be framed: Builder.io, Google Analytics, Hotjar) |
| declares `<placement>AppMenu</placement>` | nothing in the menu; the global search's *Apps* group finds it (by title), and opens it |
| declares `<placement>Hidden</placement>` | nothing |

```xml
<!-- module.manifest -->
<apps>
  <app id="my-app">
    <title>My app</title>
    <iconUrl>Modules/$(MyCompany.MyModule)/Content/my-app.svg</iconUrl>
    <permission>my-module:access</permission>
    <placement>MainMenu</placement>
  </app>
</apps>
```

The item takes the app's title, icon (`iconUrl`, rooted at the site) and permission. An app already placed by `default-menu.json` isn't added to *Apps* again.

## The frame

```
#/app/tasks?path=/active   ──►   <iframe src="/apps/tasks/#/active?EmbeddedMode=true">
```

| Part | Behaviour |
|---|---|
| Head bar | The section and the item's title, *Refresh* (reloads the frame) and *Open in new tab*. Hidden when the menu lists the app's pages as children (the menu is then the app's navigation). |
| `EmbeddedMode=true` | Tells the app it runs embedded. |
| Theme bridge (same-origin vc-shell apps) | The shell copies its colour variables into the app's `:root` and sets the app's `data-theme`, so the app matches the shell's light or dark theme; it reapplies when the theme changes. |
| Navigation of the app | Hidden (`.desktop-layout`, `.mobile-layout`) when the menu item has children, so there aren't two menus. |
| Other origins | Left as they are. |

### Pages of an app in the menu

An app item with `children` turns the app's own pages into menu entries; the shell then hides the app's navigation:

```json
{
  "id": "tasks", "title": "Tasks", "icon": "lucide-square-check-big", "moduleId": "VirtoCommerce.TaskManagement", "permission": "task:access",
  "target": { "type": "app", "appId": "tasks", "route": "/active" },
  "children": [
    { "id": "tasks.active", "title": "All Tasks", "target": { "type": "app", "appId": "tasks", "route": "/active" } },
    { "id": "tasks.my", "title": "My Tasks", "target": { "type": "app", "appId": "tasks", "route": "/my" } }
  ]
}
```

`route` is the app's own hash route; it becomes the frame's `#path`.

## Guidelines

- Prefer `MainMenu` placement for an app users work in every day; it then appears in *Apps* without a change to the shell. Ask for an entry in `default-menu.json` when it belongs to a section, or contribute one from the module's plugin once it has one.
- Use a `url` target for sites that can't be framed (third-party consoles); the frame would stay blank.
- Use vc-shell's CSS variables in the app for colours, so the theme bridge can match it to the shell.
- The theme bridge and the hidden navigation are a bridge, not an API: an app that becomes an Admin Shell plugin doesn't need them.

## Testing

- The app opens from the menu, the frame shows the app without its own navigation (when the item has children), and *Open in new tab* opens the app on the same page.
- Switch the shell's theme: the app follows.
- A user without the app's permission doesn't see the item.
