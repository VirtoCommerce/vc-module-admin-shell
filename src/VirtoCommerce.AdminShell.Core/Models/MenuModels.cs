using System;
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

    /// <summary>Translation key of the title (the client's menu locale files: MENU.SECTIONS.{id} when not set)</summary>
    public string TitleKey { get; set; }

    /// <summary>Titles by language set in a menu patch (the editor's renames); they win over the key, English is the fallback</summary>
    public Dictionary<string, string> Titles { get; set; }

    /// <summary>"added" for a section a patch adds; null for the default menu's</summary>
    public string Source { get; set; }

    /// <summary>Editor only: hidden by the patch being edited (the effective menu leaves hidden sections out)</summary>
    public bool? Hidden { get; set; }
    public string Icon { get; set; }
    public int Priority { get; set; }
    public string Permission { get; set; }
    public List<MenuItem> Items { get; set; } = [];

    /// <summary>Headed groups of the section's panel, in order. Each lists the item ids it holds; an item that replaces
    /// one of them joins its group.</summary>
    public List<MenuGroup> Groups { get; set; } = [];
}

public class MenuGroup
{
    /// <summary>Stable id within the section (the translation key MENU.GROUPS.{sectionId}_{id})</summary>
    public string Id { get; set; }
    public string Title { get; set; }
    public string TitleKey { get; set; }
    public List<string> Items { get; set; } = [];
}

public class MenuItem
{
    public string Id { get; set; }
    public string Title { get; set; }

    /// <summary>Translation key of the title: a key of the client's texts (menu locale files, a plugin's locales) or of the
    /// platform's server texts (an AngularJS screen's main-menu-title); MENU.ITEMS.{id} when not set</summary>
    public string TitleKey { get; set; }

    /// <summary>Titles by language set in a menu patch; they win over the key, English is the fallback</summary>
    public Dictionary<string, string> Titles { get; set; }

    /// <summary>Where the item comes from: null (the default menu), "discovered" (a workspace blade no menu entry opens),
    /// "added" (a patch's addItems)</summary>
    public string Source { get; set; }

    /// <summary>Editor only: hidden by the patch being edited</summary>
    public bool? Hidden { get; set; }
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

    /// <summary>The panel group it shows under: a contribution's own, or the one its section lists it in</summary>
    public string Group { get; set; }

    /// <summary>
    /// The screen's Vue route in its module's Admin Shell plugin. In the default menu the item opens it when the module's
    /// plugin is installed and built, and its Target (the AngularJS screen) otherwise. A contribution's shorthand for
    /// Target = { type: vue, route }.
    /// </summary>
    public string Route { get; set; }

    /// <summary>Ids the item had before (an AngularJS screen's "legacy.orders"): stored pins, hides, order, patches, Recent
    /// uses and group lists that name them apply to this item</summary>
    public List<string> Aliases { get; set; }

    public MenuTarget Target { get; set; }

    /// <summary>Set by the default menu: the AngularJS screen an item opening its Vue route stands in for (the editor
    /// counts that screen as in the menu)</summary>
    public MenuTarget Fallback { get; set; }
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

    /// <summary>Title by language ("en", "de", ...); English is the fallback for languages left out</summary>
    public Dictionary<string, string> Titles { get; set; }
    public string Icon { get; set; }
    public int? Priority { get; set; }
    public bool? Hidden { get; set; }
}

public class ItemPatch
{
    public string Title { get; set; }

    /// <summary>Title by language ("en", "de", ...); English is the fallback for languages left out</summary>
    public Dictionary<string, string> Titles { get; set; }

    /// <summary>The panel group (its title) the item shows under in its section; "" puts it in no group</summary>
    public string Group { get; set; }
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

/// <summary>What users may change in their own menu (the SI's choice). Turning one off stops applying the users' changes
/// of that kind without deleting them, so they come back when it is turned on again.</summary>
public class MenuPersonalization
{
    public bool AllowPin { get; set; } = true;
    public bool AllowHide { get; set; } = true;
    public bool AllowReorder { get; set; } = true;
}

/// <summary>A request for a menu: the workspace blades the client found that no menu entry opens</summary>
public class MenuRequest
{
    public List<MenuItem> Discovered { get; set; } = [];
}

/// <summary>The editor's request: the patch being edited (null: the stored one) and the discovered blades</summary>
public class MenuEditorRequest : MenuRequest
{
    public MenuPatch Patch { get; set; }
}

/// <summary>What the host receives: the effective menu plus the user's pinned and hidden items</summary>
public class EffectiveMenu
{
    public List<MenuSection> Sections { get; set; } = [];

    /// <summary>What the user may change (pin, hide, reorder)</summary>
    public MenuPersonalization Personalization { get; set; } = new();
    public List<MenuItem> Pinned { get; set; } = [];

    /// <summary>Pages the user opens most, best first (frequent and recent count; pinned and hidden ones are left out)</summary>
    public List<MenuItem> Recent { get; set; } = [];
    public List<string> Hidden { get; set; } = [];
}

/// <summary>A menu item's use for Recent: a score that grows with each use and halves every few days without one</summary>
public class RecentUse
{
    public string Id { get; set; }
    public double Score { get; set; }
    public DateTime LastUsed { get; set; }
}
