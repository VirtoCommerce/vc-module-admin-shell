# Migrating a module's admin UI to the Admin Shell (wave 2)

You are porting one or more VirtoCommerce modules' AngularJS admin UI (`src/<Module>.Web/Scripts/**`) to a Vue admin UI
that ships in the module's own repo and loads into the Admin Shell.

**Read first, and follow it exactly:** `C:\Projects\GitHub\VirtoCommerce\vc-module-admin-shell\docs\porting-guide.md`
(skeleton, conventions, menu, gotchas, cross-module widget contracts, verification, report). Reference implementations:
`vc-module-order/src/VirtoCommerce.OrdersModule.Web/vue/` (rich module), `vc-module-subscription/.../vue/` (a widget into
another module), `vc-module-catalog-csv-export-import/.../vue/` (a toolbar extension point user). Controls: the vc-shell
storybook https://vc-shell-storybook.govirto.com/ (`/index.json`).

## Environment
- Platform: http://localhost:10645 (Development), Admin Shell at `/apps/admin-shell/`. The module is already built and
  registered (junction under `vc-platform/src/VirtoCommerce.Platform.Web/modules/`). Its old AngularJS screens are at
  `http://localhost:10645/#!/workspace/...` for comparison.
- Sign-in for the local dev instance: user `admin`, password given in your task. Pass them to `login.js` through the
  `VC_USER` / `VC_PASS` environment variables; never write them to files.
- Playwright tooling: `C:\Users\ALEXAN~1\AppData\Local\Temp\claude\C--Projects-GitHub-vc-platform\ff3a4587-dfbc-4280-abb9-0b857415bfcd\scratchpad\shot\`
  (`login.js`, `playwright-core`). Put your scripts in `shot/<module>/`. Sessions expire after ~30 minutes: re-run login.js.
- Run yarn from PowerShell. Prefix node commands in Git Bash with `MSYS_NO_PATHCONV=1`.

## What to port
- Everything the module's AngularJS code registers: menu items (main menu, settings), blades, widgets it adds to other
  modules' blades (use `registerExternalWidget` against the contract blade names in the guide), toolbar commands,
  dashboard widgets, settings/permissions UI. Keep the module's own server API; don't change server code unless a real bug
  blocks the UI (then keep the fix minimal and report it).
- A module that only opens a standalone app (an `<app>` in module.manifest) needs no Vue UI: the Admin Shell lists apps.
  Port only the AngularJS bits it has (e.g. a settings widget).
- Phones: lists use `mobile-role` on columns (title / field / status) so a phone row reads well; number columns are
  `type="number"`. Dark theme: never hard-code colors (use the host tokens).

## Rules
- Never commit. Never restart the platform, install/uninstall modules or restore backups. If your module needs a restart
  (server change), say so in the report instead.
- Leave data as you found it: create AS-TEST data for your checks and delete it; restore any setting you change.
- Don't edit other modules' repos except to add a missing `defineBladeContext`/contract the guide lists (say so).
- Verify in the real host with Playwright at 1920x1032 and at phone size (393x852), light and dark: menu entry, list, search,
  details, create + delete, edit + save + revert, widgets on other modules' blades, no console errors. Look at the screenshots.

## Report (keep it short)
Per module: parity checklist (done / partial / not ported + why), PASS/FAIL counts, files created/changed, anything needing a
platform restart or another module's change.
