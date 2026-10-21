using System.Collections.Generic;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>
/// Builds the default menu from what is installed: the seed (default-menu.json) filtered by installed modules, MainMenu
/// apps, the menu contributions of Vue plugins, and the workspace blades the client found that none of these opens (More)
/// </summary>
public interface IDefaultMenuBuilder
{
    MenuDocument Build(IEnumerable<MenuItem> discovered = null);
}
