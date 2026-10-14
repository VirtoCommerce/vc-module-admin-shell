using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
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
        Func<string, bool> hasPermission,
        IList<string> recentIds = null)
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
        ApplyUserPrefs(menu, userPrefs, userHidden, hasPermission);

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
            Recent = ResolveRecent(recentIds, userPrefs.Pinned, sections, index),
            Hidden = userHidden.ToList(),
        };
    }

    /* ---- Recent: ranked by use. Each use adds 1 to a page's score and a score halves every few days without one, so a
       page used often stays near the top and a one-off click moves a page up a little instead of to the top. ---- */

    /// <summary>The uses after the user opens <paramref name="itemId"/>, best first, at most <paramref name="maxTracked"/></summary>
    public static List<RecentUse> RecordUse(IList<RecentUse> uses, string itemId, DateTime now, double halfLifeDays, int maxTracked)
    {
        var previous = (uses ?? []).FirstOrDefault(x => string.Equals(x?.Id, itemId, StringComparison.OrdinalIgnoreCase));
        var result = (uses ?? []).Where(x => x != null && x != previous).ToList();
        result.Add(new RecentUse { Id = itemId, Score = ScoreAt(previous, now, halfLifeDays) + 1, LastUsed = now });
        return RankRecent(result, now, halfLifeDays).Take(maxTracked).ToList();
    }

    /// <summary>Uses by their score now, then by the last use</summary>
    public static List<RecentUse> RankRecent(IList<RecentUse> uses, DateTime now, double halfLifeDays) =>
        (uses ?? []).OrderByDescending(x => ScoreAt(x, now, halfLifeDays)).ThenByDescending(x => x.LastUsed).ToList();

    /// <summary>
    /// Reads the stored uses. The first version stored only ids, most recent first: those start equal, in that order.
    /// Anything else (a number, a nested array, a half-written value) is skipped, not fatal for the whole menu.
    /// </summary>
    public static List<RecentUse> ReadRecent(string json, DateTime now) =>
        ParseArray(json)
            .Select((x, i) => ReadUse(x, i, now))
            .Where(x => !string.IsNullOrEmpty(x?.Id))
            .ToList();

    private static JArray ParseArray(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new JArray();
        }

        try
        {
            return JToken.Parse(json) as JArray ?? new JArray();
        }
        catch (JsonException)
        {
            return new JArray();
        }
    }

    private static RecentUse ReadUse(JToken token, int position, DateTime now)
    {
        try
        {
            return token.Type switch
            {
                JTokenType.String => new RecentUse { Id = (string)token, Score = 1, LastUsed = now.AddMinutes(-position) },
                JTokenType.Object => token.ToObject<RecentUse>(),
                _ => null,
            };
        }
        catch (Exception ex) when (ex is JsonException or FormatException)
        {
            return null; // one entry with a field of the wrong type
        }
    }

    private static double ScoreAt(RecentUse use, DateTime now, double halfLifeDays) =>
        use == null ? 0 : use.Score * Math.Pow(0.5, Math.Max(0, (now - use.LastUsed).TotalDays) / halfLifeDays);

    // Recent shows on Home: pinned pages and Home's own already have their place there; Resolve drops what the user
    // can't see or has hidden
    private static List<MenuItem> ResolveRecent(IList<string> recentIds, IList<string> pinned, IList<MenuSection> sections, Dictionary<string, MenuItem> index)
    {
        var placed = new HashSet<string>(pinned ?? [], StringComparer.OrdinalIgnoreCase);
        placed.UnionWith(sections.Where(x => x.Id == ModuleConstants.HomeSectionId).SelectMany(x => Flatten(x.Items)).Select(x => x.Id));
        return Resolve(recentIds?.Where(x => !placed.Contains(x)).ToList(), index);
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

    private static void ApplyUserPrefs(MenuDocument menu, UserMenuPrefs userPrefs, HashSet<string> userHidden, Func<string, bool> hasPermission)
    {
        foreach (var section in menu.Sections)
        {
            section.Items = FilterItems(section.Items, x => !userHidden.Contains(x.Id) && Allowed(x.Permission, hasPermission));
            section.Items = OrderItems(section.Items, userPrefs.Order != null && userPrefs.Order.TryGetValue(section.Id, out var order) ? order : null);
        }
    }

    // patches are stored JSON: a null entry ({"items":{"x":null}}, "addItems":[null]) is skipped
    private static void ApplyPatch(MenuDocument menu, MenuPatch patch, bool applyHidden)
    {
        AddSections(menu, patch.AddSections);
        AddItems(menu, patch.AddItems);
        PatchSections(menu, patch.Sections, applyHidden);
        PatchItems(menu, patch.Items, applyHidden);
    }

    private static void AddSections(MenuDocument menu, List<MenuSection> sections)
    {
        foreach (var addSection in (sections ?? []).Where(x => x != null))
        {
            if (menu.Sections.All(x => !string.Equals(x.Id, addSection.Id, StringComparison.OrdinalIgnoreCase)))
            {
                menu.Sections.Add(Clone(addSection));
            }
        }
    }

    private static void AddItems(MenuDocument menu, List<MenuItem> items)
    {
        foreach (var addItem in (items ?? []).Where(x => x != null))
        {
            var section = FindSection(menu, addItem.SectionId);
            if (section != null && !Flatten(section.Items).Any(x => string.Equals(x.Id, addItem.Id, StringComparison.OrdinalIgnoreCase)))
            {
                section.Items.Add(Clone(addItem));
            }
        }
    }

    private static void PatchSections(MenuDocument menu, Dictionary<string, SectionPatch> patches, bool applyHidden)
    {
        foreach (var (sectionId, sectionPatch) in patches ?? [])
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
    }

    private static void PatchItems(MenuDocument menu, Dictionary<string, ItemPatch> patches, bool applyHidden)
    {
        foreach (var (itemId, itemPatch) in patches ?? [])
        {
            var (section, item) = FindItem(menu, itemId);
            if (item == null || itemPatch == null)
            {
                continue;
            }

            item.Title = itemPatch.Title ?? item.Title;
            item.Icon = itemPatch.Icon ?? item.Icon;
            item.Priority = itemPatch.Priority ?? item.Priority;

            HideOrMoveItem(menu, section, item, itemPatch, applyHidden);
        }
    }

    // the item may be a child: it is taken out of the tree, and a container left empty goes too
    private static void HideOrMoveItem(MenuDocument menu, MenuSection section, MenuItem item, ItemPatch itemPatch, bool applyHidden)
    {
        if (applyHidden && itemPatch.Hidden == true)
        {
            section.Items = FilterItems(section.Items, x => x != item);
            return;
        }

        var target = FindSection(menu, itemPatch.SectionId);
        if (target != null && target != section)
        {
            section.Items = FilterItems(section.Items, x => x != item);
            target.Items.Add(item);
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
