using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>
/// A role with its dashboard layer, for the Dashboard Editor: its name, the permissions it has (to tell which widgets
/// its users can see at all) and the widgets it hides
/// </summary>
public class RoleDashboard
{
    public string Id { get; set; }
    public string Name { get; set; }
    public List<string> Permissions { get; set; } = [];
    public DashboardPatch Dashboard { get; set; } = new();
}
