using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>
/// The installation's white-labeling, for every page of the Admin Shell including the sign-in page (anonymous): the
/// brand, the sign-in page's showcase, Home's welcome card and the themes. Empty values mean the shell's own.
/// </summary>
public class Branding
{
    public string CompanyName { get; set; }
    public string LogoUrl { get; set; }
    public string LogoDarkUrl { get; set; }
    public string MarkUrl { get; set; }
    public string FaviconUrl { get; set; }
    public BrandingLinks Links { get; set; } = new();
    public BrandingSignIn SignIn { get; set; } = new();
    public BrandingHome Home { get; set; } = new();
    public BrandingTheme Theme { get; set; } = new();
}

public class BrandingLinks
{
    public string Help { get; set; }
    public string Support { get; set; }
    public string Privacy { get; set; }
    public string Terms { get; set; }
}

public class BrandingSignIn
{
    /// <summary>virto, custom or none</summary>
    public string Showcase { get; set; } = "virto";

    /// <summary>The company's slides as configured (AdminShell.SignIn.Slides); the client reads the fields it knows</summary>
    public JArray Slides { get; set; } = [];
}

public class BrandingHome
{
    /// <summary>Home's welcome card (AdminShell.Home.Welcome), or null for none</summary>
    public JObject Welcome { get; set; }
}

public class BrandingTheme
{
    /// <summary>The theme of the sign-in page and of users who haven't picked one</summary>
    public string Default { get; set; } = "virto";

    /// <summary>system, light or dark, for the sign-in page and users who haven't picked one</summary>
    public string Appearance { get; set; } = "dark";

    /// <summary>False: everyone has the default theme</summary>
    public bool UserChoice { get; set; } = true;

    /// <summary>The theme files' themes</summary>
    public List<CustomTheme> Custom { get; set; } = [];
}

/// <summary>
/// A theme file ({id}.json in the themes folder): a name, the built-in theme it starts from and the palette colors it
/// changes, for light and dark. Only known palette keys with plain color values are kept (see BrandingService).
/// </summary>
public class CustomTheme
{
    public string Id { get; set; }
    public string Name { get; set; }

    /// <summary>The built-in palette the theme changes: warm, blue or indigo (default)</summary>
    public string Base { get; set; } = "indigo";

    public Dictionary<string, string> Light { get; set; } = [];
    public Dictionary<string, string> Dark { get; set; } = [];
}
