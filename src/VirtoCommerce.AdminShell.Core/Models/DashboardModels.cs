using System;
using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>
/// One widget's change in a dashboard layer, by widget id: only what differs from the layer below. A widget no layer
/// names keeps the place and size its module declares, so a widget added by a module upgrade shows up on its own.
/// </summary>
public class WidgetPatch
{
    public bool? Hidden { get; set; }
    public int? X { get; set; }
    public int? Y { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
}

/// <summary>
/// The dashboard for everyone (setting AdminShell.Dashboard.Global) or for a role's users (AdminShell.Dashboard.Role):
/// widgets hidden and, in the global one, places and sizes. LayoutVersion (global only) goes up when the users' own
/// layouts are reset.
/// </summary>
public class DashboardPatch
{
    public Dictionary<string, WidgetPatch> Widgets { get; set; } = new(StringComparer.Ordinal);

    public int LayoutVersion { get; set; }

    /// <summary>Read only: a role's list in the earlier format, {"hiddenWidgets":[...]}</summary>
    public List<string> HiddenWidgets { get; set; }
}

/// <summary>
/// A user's own dashboard (setting AdminShell.Dashboard.User): the widgets the user hid, and where the user put and how
/// big the user made the others. Kept on the server, so it is the same in every browser. LayoutVersion is the global
/// one the places were made under: an older one means an administrator reset the users' layouts.
/// </summary>
public class UserDashboardPrefs
{
    public Dictionary<string, WidgetPatch> Widgets { get; set; } = new(StringComparer.Ordinal);

    public int LayoutVersion { get; set; }
}

/// <summary>What users may change on their own dashboard</summary>
public class DashboardPersonalization
{
    public bool AllowHide { get; set; } = true;
    public bool AllowMove { get; set; } = true;
    public bool AllowResize { get; set; } = true;
}

/// <summary>A widget's place and size</summary>
public class WidgetLayout
{
    public int? X { get; set; }
    public int? Y { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
}

/// <summary>The current user's dashboard: the layers composed, for Home</summary>
public class EffectiveDashboard
{
    /// <summary>Places and sizes for everyone (the global layer), over the modules' own</summary>
    public Dictionary<string, WidgetLayout> Defaults { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Hidden for this user by the global layer or by every one of the user's roles; the user can't show them</summary>
    public List<string> Hidden { get; set; } = [];

    /// <summary>The widgets the user hid (when users may hide)</summary>
    public List<string> UserHidden { get; set; } = [];

    /// <summary>The user's own places and sizes (as far as users may move and resize), under the current layout version</summary>
    public Dictionary<string, WidgetLayout> Layout { get; set; } = new(StringComparer.Ordinal);

    public DashboardPersonalization Personalization { get; set; } = new();

    public int LayoutVersion { get; set; }

    /// <summary>The user may change the dashboard for everyone (admin-shell:dashboard:manage)</summary>
    public bool CanManage { get; set; }
}
