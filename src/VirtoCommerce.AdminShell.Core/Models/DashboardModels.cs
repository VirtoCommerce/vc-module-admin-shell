using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>
/// A role's dashboard: the widgets the role's users don't need, by widget id ("shell-alerts", or a module's widget id).
/// Ids of widgets that aren't installed stay as they are and do nothing.
/// </summary>
public class RoleDashboard
{
    public List<string> HiddenWidgets { get; set; } = [];
}

/// <summary>The current user's dashboard: the widgets it leaves out</summary>
public class EffectiveDashboard
{
    public List<string> HiddenWidgets { get; set; } = [];
}
