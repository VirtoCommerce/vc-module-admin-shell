using System;
using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>
/// Builds the effective menu from its layers: default → global patch → role patches → user prefs → permissions.
/// Pure logic, no I/O.
/// </summary>
public static class MenuComposer
{
    public static EffectiveMenu Compose(
        MenuDocument defaultMenu,
        MenuPatch globalPatch,
        IList<MenuPatch> rolePatches,
        UserMenuPrefs userPrefs,
        Func<string, bool> hasPermission)
    {
        var menu = Clone(defaultMenu);
        ApplyReplacements(menu);

        if (globalPatch != null)
        {
            ApplyPatch(menu, globalPatch, applyHidden: true);
        }

        ApplyRolePatches(menu, rolePatches?.Where(x => x != null).ToList() ?? []);

        userPrefs ??= new UserMenuPrefs();
        var userHidden = new HashSet<string>(userPrefs.Hidden ?? [], StringComparer.OrdinalIgnoreCase);

        foreach (var section in menu.Sections)
        {
            section.Items = FilterItems(section.Items, x => !userHidden.Contains(x.Id) && Allowed(x.Permission, hasPermission));
            section.Items = OrderItems(section.Items, userPrefs.Order != null && userPrefs.Order.TryGetValue(section.Id, out var order) ? order : null);
        }

        var sections = menu.Sections
            .Where(x => x.Items.Count > 0 && Allowed(x.Permission, hasPermission))
            .OrderBy(x => x.Priority)
            .ThenBy(x => x.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var index = sections.SelectMany(x => Flatten(x.Items)).GroupBy(x => x.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        return new EffectiveMenu
        {
            Sections = sections,
            Pinned = Resolve(userPrefs.Pinned, index),
            Hidden = userHidden.ToList(),
        };
    }

    private static void ApplyReplacements(MenuDocument menu)
    {
        var replaced = new HashSet<string>(
            menu.Sections.SelectMany(x => Flatten(x.Items)).Select(x => x.Replaces).Where(x => !string.IsNullOrEmpty(x)),
            StringComparer.OrdinalIgnoreCase);

        foreach (var section in menu.Sections)
        {
            section.Items = FilterItems(section.Items, x => !replaced.Contains(x.Id));
        }
    }

    // patches are stored JSON: a null entry ({"items":{"x":null}}, "addItems":[null]) is skipped
    private static void ApplyPatch(MenuDocument menu, MenuPatch patch, bool applyHidden)
    {
        foreach (var addSection in (patch.AddSections ?? []).Where(x => x != null))
        {
            if (menu.Sections.All(x => !string.Equals(x.Id, addSection.Id, StringComparison.OrdinalIgnoreCase)))
            {
                menu.Sections.Add(Clone(addSection));
            }
        }

        foreach (var addItem in (patch.AddItems ?? []).Where(x => x != null))
        {
            var section = FindSection(menu, addItem.SectionId);
            if (section != null && !Flatten(section.Items).Any(x => string.Equals(x.Id, addItem.Id, StringComparison.OrdinalIgnoreCase)))
            {
                section.Items.Add(Clone(addItem));
            }
        }

        foreach (var (sectionId, sectionPatch) in patch.Sections ?? [])
        {
            var section = FindSection(menu, sectionId);
            if (section == null || sectionPatch == null)
            {
                continue;
            }

            section.Title = sectionPatch.Title ?? section.Title;
            section.Icon = sectionPatch.Icon ?? section.Icon;
            section.Priority = sectionPatch.Priority ?? section.Priority;

            if (applyHidden && sectionPatch.Hidden == true)
            {
                menu.Sections.Remove(section);
            }
        }

        foreach (var (itemId, itemPatch) in patch.Items ?? [])
        {
            var (section, item) = FindItem(menu, itemId);
            if (item == null || itemPatch == null)
            {
                continue;
            }

            item.Title = itemPatch.Title ?? item.Title;
            item.Icon = itemPatch.Icon ?? item.Icon;
            item.Priority = itemPatch.Priority ?? item.Priority;

            // the item may be a child: it is taken out of the tree, and a container left empty goes too
            if (applyHidden && itemPatch.Hidden == true)
            {
                section.Items = FilterItems(section.Items, x => x != item);
                continue;
            }

            var target = FindSection(menu, itemPatch.SectionId);
            if (target != null && target != section)
            {
                section.Items = FilterItems(section.Items, x => x != item);
                target.Items.Add(item);
            }
        }
    }

    /// <summary>
    /// Role patches are combined as a union: an item or section is hidden only if every role hides it.
    /// Renames, moves and additions are applied in role order.
    /// </summary>
    private static void ApplyRolePatches(MenuDocument menu, IList<MenuPatch> rolePatches)
    {
        if (rolePatches.Count == 0)
        {
            return;
        }

        foreach (var patch in rolePatches)
        {
            ApplyPatch(menu, patch, applyHidden: false);
        }

        bool HiddenByAll<T>(string id, Func<MenuPatch, Dictionary<string, T>> layer, Func<T, bool?> hidden) =>
            rolePatches.All(p => layer(p) != null && layer(p).TryGetValue(id, out var x) && hidden(x) == true);

        menu.Sections = menu.Sections
            .Where(s => !HiddenByAll(s.Id, p => p.Sections, x => x?.Hidden))
            .ToList();

        foreach (var section in menu.Sections)
        {
            section.Items = FilterItems(section.Items, i => !HiddenByAll(i.Id, p => p.Items, x => x?.Hidden));
        }
    }

    private static List<MenuItem> FilterItems(List<MenuItem> items, Func<MenuItem, bool> keep)
    {
        var result = new List<MenuItem>();
        foreach (var item in items ?? [])
        {
            if (!keep(item))
            {
                continue;
            }

            item.Children = FilterItems(item.Children, keep);

            // a pure container with nothing left to show is dropped
            if (item.Target == null && item.Children.Count == 0)
            {
                continue;
            }

            result.Add(item);
        }
        return result;
    }

    private static List<MenuItem> OrderItems(List<MenuItem> items, IList<string> userOrder)
    {
        var ordered = items.OrderBy(x => x.Priority).ThenBy(x => x.Title, StringComparer.OrdinalIgnoreCase).ToList();
        if (userOrder == null || userOrder.Count == 0)
        {
            return ordered;
        }

        var position = userOrder.Select((id, i) => (id, i))
            .GroupBy(x => x.id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First().i, StringComparer.OrdinalIgnoreCase);

        // listed items first in the user's order, the rest keep their default order after them
        return ordered
            .Select((item, i) => (item, rank: position.TryGetValue(item.Id, out var p) ? p : userOrder.Count + i))
            .OrderBy(x => x.rank)
            .Select(x => x.item)
            .ToList();
    }

    private static bool Allowed(string permission, Func<string, bool> hasPermission) =>
        string.IsNullOrEmpty(permission) || hasPermission(permission);

    private static List<MenuItem> Resolve(IList<string> ids, Dictionary<string, MenuItem> index) =>
        (ids ?? []).Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(id => index.TryGetValue(id, out var item) ? item : null)
            .Where(x => x != null)
            .ToList();

    private static MenuSection FindSection(MenuDocument menu, string id) =>
        string.IsNullOrEmpty(id) ? null : menu.Sections.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase));

    /// <summary>An item at any depth (a child such as news.drafts too) and the section it is in</summary>
    private static (MenuSection, MenuItem) FindItem(MenuDocument menu, string id)
    {
        foreach (var section in menu.Sections)
        {
            var item = Flatten(section.Items).FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase));
            if (item != null)
            {
                return (section, item);
            }
        }
        return (null, null);
    }

    private static IEnumerable<MenuItem> Flatten(IEnumerable<MenuItem> items) =>
        (items ?? []).SelectMany(x => new[] { x }.Concat(Flatten(x.Children)));

    private static T Clone<T>(T source) =>
        Newtonsoft.Json.JsonConvert.DeserializeObject<T>(Newtonsoft.Json.JsonConvert.SerializeObject(source));
}
