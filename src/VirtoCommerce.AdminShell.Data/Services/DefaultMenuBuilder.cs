using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.Modularity;

namespace VirtoCommerce.AdminShell.Data.Services;

/// <summary>
/// Builds the default menu from what is installed:
/// the seed (default-menu.json) filtered by installed modules, each of its screens opening the module's Vue plugin route
/// when the plugin is built and its AngularJS screen otherwise; MainMenu apps; menu contributions declared by Vue plugins
/// in {module}/plugins/admin-shell/plugin.json for screens the seed doesn't place; and the workspace blades the client
/// found that none of these opens (More).
/// </summary>
public class DefaultMenuBuilder(IModuleService moduleService, ILogger<DefaultMenuBuilder> logger) : IDefaultMenuBuilder
{
    private const string AppsSectionId = "apps";
    // app items go after the seed's items in their section (the seed's priorities are 100 apart)
    private const int AppItemPriority = 100_000;
    // after the seed's last section (Configuration, 600)
    private const int AppsSectionPriority = 700;

    // ponytail: rebuilt on every request (a few small file reads); cache with a file watcher if it ever shows up in profiles
    public MenuDocument Build(IEnumerable<MenuItem> discovered = null)
    {
        var modules = moduleService.GetInstalledModules();
        var installed = new HashSet<string>(modules.Select(x => x.Id), StringComparer.OrdinalIgnoreCase);

        var withPlugin = new HashSet<string>(modules.Where(HasBuiltPlugin).Select(x => x.Id), StringComparer.OrdinalIgnoreCase);

        var menu = ReadSeed();
        foreach (var section in menu.Sections)
        {
            section.Items = section.Items
                .Where(x => string.IsNullOrEmpty(x.ModuleId) || installed.Contains(x.ModuleId))
                .Select(x => ResolveTarget(x, withPlugin))
                .Where(x => x != null)
                .ToList();
        }

        AddApps(menu, modules);
        AddContributions(menu, modules.Where(x => withPlugin.Contains(x.Id)));
        MenuComposer.AddDiscovered(menu, discovered);

        return menu;
    }

    // a seed item with a Route opens its module's Vue screen when the plugin is built, its AngularJS Target otherwise; one
    // with neither to open is dropped
    private static MenuItem ResolveTarget(MenuItem item, HashSet<string> withPlugin)
    {
        if (string.IsNullOrEmpty(item.Route))
        {
            return item;
        }
        if (withPlugin.Contains(item.ModuleId ?? string.Empty))
        {
            item.Fallback = item.Target;
            item.Target = new MenuTarget { Type = MenuTargetTypes.Vue, Route = item.Route };
        }
        item.Route = null;
        return item.Target == null ? null : item;
    }

    private MenuDocument ReadSeed()
    {
        var module = moduleService.GetModule(ModuleConstants.ModuleId);
        var path = Path.Combine(module.FullPhysicalPath, "Content", "default-menu.json");
        return JsonConvert.DeserializeObject<MenuDocument>(File.ReadAllText(path)) ?? new MenuDocument();
    }

    private static void AddApps(MenuDocument menu, IEnumerable<ManifestModuleInfo> modules)
    {
        // an app the seed already places (Tasks and News on their sections) isn't listed again in Apps
        var placed = new HashSet<string>(
            menu.Sections.SelectMany(x => x.Items).Where(x => x.Target?.Type == MenuTargetTypes.App).Select(x => x.Target.AppId),
            StringComparer.OrdinalIgnoreCase);
        var apps = modules.SelectMany(x => x.Apps)
            .Where(x => x.Placement == AppPlacement.MainMenu && !string.Equals(x.Id, ModuleConstants.AppId, StringComparison.OrdinalIgnoreCase))
            .Where(x => !placed.Contains(x.Id));

        var section = menu.Sections.FirstOrDefault(x => string.Equals(x.Id, AppsSectionId, StringComparison.OrdinalIgnoreCase));
        if (section == null)
        {
            section = new MenuSection { Id = AppsSectionId, Title = "Apps", Icon = "lucide-layout-grid", Priority = AppsSectionPriority };
            menu.Sections.Add(section);
        }
        foreach (var app in apps)
        {
            section.Items.Add(new MenuItem
            {
                Id = $"app.{app.Id}",
                Title = app.Title ?? app.Id,
                // a manifest's icon may be relative to the site root ("Modules/$(VirtoCommerce.News)/..."); the host page
                // lives under /apps/admin-shell/, so root it as vc-shell's app hub does
                IconUrl = string.IsNullOrEmpty(app.IconUrl) || app.IconUrl.StartsWith('/') || app.IconUrl.Contains("://")
                    ? app.IconUrl
                    : "/" + app.IconUrl,
                Icon = "lucide-app-window",
                Permission = app.Permission,
                Priority = AppItemPriority,
                Target = new MenuTarget { Type = MenuTargetTypes.App, AppId = app.Id },
            });
        }
    }

    private void AddContributions(MenuDocument menu, IEnumerable<ManifestModuleInfo> modules)
    {
        foreach (var module in modules)
        {
            foreach (var item in ReadContributions(module))
            {
                // a screen the seed places: the seed owns its title, place and route; the contribution's id names it too
                var placed = PlacedItem(menu, item);
                if (placed != null)
                {
                    if (!string.Equals(placed.Id, item.Id, StringComparison.OrdinalIgnoreCase))
                    {
                        placed.Aliases = [.. placed.Aliases ?? [], item.Id];
                    }
                    if (placed.Target?.Type != MenuTargetTypes.Vue && !string.IsNullOrEmpty(item.Route))
                    {
                        placed.Fallback = placed.Target;
                        placed.Target = new MenuTarget { Type = MenuTargetTypes.Vue, Route = item.Route };
                    }
                    continue;
                }

                item.ModuleId ??= module.Id;
                item.Target ??= new MenuTarget { Type = MenuTargetTypes.Vue, Route = item.Route };
                item.Route = null;

                // a section the menu doesn't have (or none given): More, so the item still shows and patches can move it
                SectionOrMore(menu, item.SectionId).Items.Add(item);
            }
        }
    }

    // the seed's item for the contributed screen: the same id, a former id, or the item the contribution replaces
    private static MenuItem PlacedItem(MenuDocument menu, MenuItem contribution)
    {
        bool Names(MenuItem x, string id) =>
            !string.IsNullOrEmpty(id) &&
            (string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase) || x.Aliases?.Contains(id, StringComparer.OrdinalIgnoreCase) == true);

        return menu.Sections.SelectMany(x => x.Items).FirstOrDefault(x => Names(x, contribution.Id) || Names(x, contribution.Replaces));
    }

    private static string PluginFolder(ManifestModuleInfo module) =>
        Path.Combine(module.FullPhysicalPath ?? string.Empty, "plugins", ModuleConstants.AppId);

    // a declared plugin that isn't built yet would only produce dead menu items
    private static bool HasBuiltPlugin(ManifestModuleInfo module) =>
        File.Exists(Path.Combine(PluginFolder(module), "plugin.json")) && File.Exists(Path.Combine(PluginFolder(module), "remoteEntry.js"));

    private List<MenuItem> ReadContributions(ManifestModuleInfo module)
    {
        var pluginFile = Path.Combine(PluginFolder(module), "plugin.json");

        try
        {
            var plugin = JObject.Parse(File.ReadAllText(pluginFile));
            return plugin.SelectToken("contributions.menu")?.ToObject<List<MenuItem>>() ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid {File} in module {Module}", pluginFile, module.Id);
            return [];
        }
    }

    private static MenuSection SectionOrMore(MenuDocument menu, string id) =>
        (string.IsNullOrEmpty(id) ? null : menu.Sections.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase)))
        ?? MenuComposer.MoreSection(menu);
}
