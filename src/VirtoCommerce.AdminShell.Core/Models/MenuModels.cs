using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>A menu: sections (rail entries) holding items (panel entries)</summary>
public class MenuDocument
{
    public List<MenuSection> Sections { get; set; } = [];
}

public class MenuSection
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string Icon { get; set; }
    public int Priority { get; set; }
    public string Permission { get; set; }
    public List<MenuItem> Items { get; set; } = [];
}

public class MenuItem
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string Icon { get; set; }
    public string IconUrl { get; set; }
    public string Permission { get; set; }
    public int Priority { get; set; }

    /// <summary>Module that provides the item; items of modules that aren't installed are dropped from the default menu</summary>
    public string ModuleId { get; set; }

    /// <summary>Section to put the item in (used by contributions and patch additions)</summary>
    public string SectionId { get; set; }

    /// <summary>Id of an item this one supersedes, e.g. a Vue screen replacing its AngularJS counterpart</summary>
    public string Replaces { get; set; }

    /// <summary>Shorthand used by plugin contributions: a Vue route, same as Target = { type: vue, route }</summary>
    public string Route { get; set; }

    public MenuTarget Target { get; set; }
    public List<MenuItem> Children { get; set; } = [];
}

public static class MenuTargetTypes
{
    public const string Vue = "vue";
    public const string Legacy = "legacy";
    public const string App = "app";
    public const string Url = "url";
}

public class MenuTarget
{
    /// <summary>vue | legacy | app | url</summary>
    public string Type { get; set; }

    /// <summary>vue: route path inside the host, e.g. /orders</summary>
    public string Route { get; set; }

    /// <summary>legacy: AngularJS state url, e.g. /workspace/catalog</summary>
    public string LegacyUrl { get; set; }

    /// <summary>app: id of a platform app (/apps/{id})</summary>
    public string AppId { get; set; }

    /// <summary>url: opened in a browser tab of its own (a site that refuses framing)</summary>
    public string Url { get; set; }
}

/// <summary>A layer of changes on top of a menu (global or per-role)</summary>
public class MenuPatch
{
    public Dictionary<string, SectionPatch> Sections { get; set; } = [];
    public Dictionary<string, ItemPatch> Items { get; set; } = [];
    public List<MenuSection> AddSections { get; set; } = [];

    /// <summary>New items; MenuItem.SectionId says where they go</summary>
    public List<MenuItem> AddItems { get; set; } = [];
}

public class SectionPatch
{
    public string Title { get; set; }
    public string Icon { get; set; }
    public int? Priority { get; set; }
    public bool? Hidden { get; set; }
}

public class ItemPatch
{
    public string Title { get; set; }
    public string Icon { get; set; }
    public string SectionId { get; set; }
    public int? Priority { get; set; }
    public bool? Hidden { get; set; }
}

/// <summary>Per-user personalization</summary>
public class UserMenuPrefs
{
    public List<string> Pinned { get; set; } = [];
    public List<string> Hidden { get; set; } = [];

    /// <summary>Section id → item ids in the order the user wants them</summary>
    public Dictionary<string, List<string>> Order { get; set; } = [];
}

/// <summary>What the host receives: the effective menu plus the user's pinned and hidden items</summary>
public class EffectiveMenu
{
    public List<MenuSection> Sections { get; set; } = [];
    public List<MenuItem> Pinned { get; set; } = [];
    public List<string> Hidden { get; set; } = [];
}
