using System.Collections.Generic;
using System.Threading.Tasks;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>
/// The installation's white-labeling (docs/branding.md): the branding settings, and the theme files of the themes folder
/// (appsettings AdminShell:ThemesPath)
/// </summary>
public interface IBrandingService
{
    /// <summary>The brand: names, logos, links, sign-in page and Home content, themes; what the sign-in page may show too</summary>
    Task<Branding> GetBrandingAsync();

    /// <summary>The valid theme files of the themes folder</summary>
    List<CustomTheme> GetThemes();

    /// <summary>The themes folder: AdminShell:ThemesPath, absolute or under the platform's folder</summary>
    string ThemesFolder();
}
