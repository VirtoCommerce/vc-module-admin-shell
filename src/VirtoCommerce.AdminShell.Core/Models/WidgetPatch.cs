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
