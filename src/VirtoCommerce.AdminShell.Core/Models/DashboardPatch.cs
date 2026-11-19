using System;
using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

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
