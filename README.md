# Admin Shell

The Admin Shell is a Vue admin for the Virto Commerce platform, built on [vc-shell](https://github.com/VirtoCommerce/vc-shell). It runs next to the AngularJS admin at `/apps/admin-shell/` and replaces its navigation with a section rail and panel.

## What it does
- **Hosts module UIs.** Modules that ship an Admin Shell UI (a Module Federation remote built into the module's `plugins/admin-shell` folder) are loaded at runtime. Their menu entries come from each remote's `plugin.json`.
- **Keeps unported screens working.** AngularJS screens and platform apps that have no Vue UI yet open inside the shell in embedded mode.
- **Serves a server-driven menu.** The menu is composed per request from four layers:
  1. the default menu: `Content/default-menu.json`, the installed apps and the module UIs' `plugin.json` contributions;
  2. a global patch (setting `AdminShell.Menu.Global`);
  3. role patches (setting `AdminShell.Menu.Role`, per role; an item stays visible when any role keeps it);
  4. the user's own pinned and hidden items.

  Items the user has no permission for are removed.
- **Platform screens.** Settings, security, modules, dynamic properties, the license and the user profile are rebuilt in Vue in `src/VirtoCommerce.AdminShell.Web/PlatformUI`.

## Projects
- `src/VirtoCommerce.AdminShell.Core`: the menu model and the menu composer.
- `src/VirtoCommerce.AdminShell.Web`:
  - the module, the menu API (`api/admin-shell/menu`) and the default menu;
  - `App/`: the host application, built into `Content/admin-shell`;
  - `PlatformUI/`: the platform screens remote, built into `plugins/admin-shell`.
- `tests/VirtoCommerce.AdminShell.Tests`: menu composition tests.

## Build
- **Server:** `dotnet build`.
- **Host:** in `src/VirtoCommerce.AdminShell.Web/App`, run `yarn install` and `yarn build:app`, then copy `dist` to `../Content/admin-shell`.
- **Platform screens:** in `src/VirtoCommerce.AdminShell.Web/PlatformUI`, run `yarn install` and `yarn build`.

The host applies fixes to `@vc-shell/framework` 2.6.3-rc.0 through a Yarn patch in `App/.yarn/patches`, and PlatformUI builds against the same patch.

## Permissions
- `admin-shell:access`: open the Admin Shell.
- `admin-shell:menu:manage`: read and change the global and role menu layers through the API.

## License

Copyright (c) Virto Solutions LTD.  All rights reserved.

Licensed under the Virto Commerce Open Software License (the "License"); you
may not use this file except in compliance with the License. You may
obtain a copy of the License at

http://virtocommerce.com/opensourcelicense

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied.
