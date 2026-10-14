using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.Platform.Core.Modularity;

namespace VirtoCommerce.AdminShell.Web.Services;

/// <summary>
/// Builds the default menu from what is installed:
/// the seed (AngularJS screens) filtered by installed modules, MainMenu apps, and menu contributions
/// declared by Vue plugins in {module}/plugins/admin-shell/plugin.json.
/// </summary>
public class DefaultMenuBuilder(IModuleService moduleService, ILogger<DefaultMenuBuilder> logger)
{
    private const string AppsSectionId = "apps";
    private const string OtherSectionId = "other";

    // ponytail: rebuilt on every request (a few small file reads); cache with a file watcher if it ever shows up in profiles
    public MenuDocument Build()
    {
        var modules = moduleService.GetInstalledModules();
        var installed = new HashSet<string>(modules.Select(x => x.Id), StringComparer.OrdinalIgnoreCase);

        var menu = ReadSeed();
        foreach (var section in menu.Sections)
        {
            section.Items = section.Items.Where(x => string.IsNullOrEmpty(x.ModuleId) || installed.Contains(x.ModuleId)).ToList();
        }

        AddApps(menu, modules);
        AddContributions(menu, modules);

        return menu;
    }

    private MenuDocument ReadSeed()
    {
        var module = moduleService.GetModule(ModuleConstants.ModuleId);
        var path = Path.Combine(module.FullPhysicalPath, "Content", "default-menu.json");
        return JsonConvert.DeserializeObject<MenuDocument>(File.ReadAllText(path)) ?? new MenuDocument();
    }

    private static void AddApps(MenuDocument menu, IEnumerable<ManifestModuleInfo> modules)
    {
        var apps = modules.SelectMany(x => x.Apps)
            .Where(x => x.Placement == AppPlacement.MainMenu && !string.Equals(x.Id, ModuleConstants.AppId, StringComparison.OrdinalIgnoreCase));

        var section = GetOrAddSection(menu, AppsSectionId, "Apps");
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
                Priority = 100,
                Target = new MenuTarget { Type = MenuTargetTypes.App, AppId = app.Id },
            });
        }
    }

    private void AddContributions(MenuDocument menu, IEnumerable<ManifestModuleInfo> modules)
    {
        foreach (var module in modules)
        {
            var folder = Path.Combine(module.FullPhysicalPath ?? string.Empty, "plugins", ModuleConstants.AppId);
            var pluginFile = Path.Combine(folder, "plugin.json");

            // a declared plugin that isn't built yet would only produce dead menu items
            if (!File.Exists(pluginFile) || !File.Exists(Path.Combine(folder, "remoteEntry.js")))
            {
                continue;
            }

            try
            {
                var plugin = JObject.Parse(File.ReadAllText(pluginFile));
                var items = plugin.SelectToken("contributions.menu")?.ToObject<List<MenuItem>>() ?? [];

                foreach (var item in items)
                {
                    item.ModuleId ??= module.Id;
                    item.Target ??= new MenuTarget { Type = MenuTargetTypes.Vue, Route = item.Route };
                    item.Route = null;

                    GetOrAddSection(menu, item.SectionId ?? OtherSectionId, item.SectionId ?? "Other").Items.Add(item);
                }
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "Invalid {File} in module {Module}", pluginFile, module.Id);
            }
        }
    }

    private static MenuSection GetOrAddSection(MenuDocument menu, string id, string title)
    {
        var section = menu.Sections.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase));
        if (section == null)
        {
            section = new MenuSection { Id = id, Title = title, Icon = "lucide-ellipsis", Priority = 95 };
            menu.Sections.Add(section);
        }
        return section;
    }
}
