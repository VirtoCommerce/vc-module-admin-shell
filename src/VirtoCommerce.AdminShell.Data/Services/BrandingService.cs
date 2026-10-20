using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.Settings;
using Settings = VirtoCommerce.AdminShell.Core.ModuleConstants.Settings;

namespace VirtoCommerce.AdminShell.Data.Services;

/// <summary>
/// The installation's white-labeling (docs/branding.md): the branding settings, and the theme files of the themes
/// folder (appsettings AdminShell:ThemesPath). Read by the sign-in page too, so it gives out nothing but the brand.
/// </summary>
public partial class BrandingService(
    ISettingsManager settingsManager,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    IMemoryCache memoryCache,
    ILogger<BrandingService> logger) : IBrandingService
{
    /// <summary>The palette colors a theme file may set (styles/_themes.scss)</summary>
    public static readonly string[] PaletteKeys =
    [
        "bg", "plate", "panel", "sunken", "select", "line", "line-soft", "ink", "ink-2", "muted", "faint",
        "primary", "primary-hover", "on-primary", "primary-soft", "primary-ink", "link", "focus", "chip", "shade",
    ];

    private static readonly string[] Bases = ["warm", "blue", "indigo"];
    private const int MaxThemes = 20;
    private const long MaxThemeFileBytes = 64 * 1024;
    private static readonly TimeSpan ThemesCacheTime = TimeSpan.FromSeconds(30);

    public async Task<Branding> GetBrandingAsync()
    {
        var entries = (await settingsManager.GetObjectSettingsAsync(Settings.BrandingSettings.Select(x => x.Name)))
            .ToDictionary(x => x.Name, x => x.Value ?? x.DefaultValue);
        string Text(SettingDescriptor descriptor) =>
            entries.TryGetValue(descriptor.Name, out var value) && value is not null && !string.IsNullOrWhiteSpace(value.ToString())
                ? value.ToString()!.Trim()
                : null;

        var themes = GetThemes();
        var defaultTheme = Text(Settings.DefaultTheme) ?? "virto";
        if (!ModuleConstants.BuiltInThemes.Contains(defaultTheme) && themes.All(x => x.Id != defaultTheme))
        {
            defaultTheme = "virto";
        }

        return new Branding
        {
            CompanyName = Text(Settings.CompanyName),
            LogoUrl = Text(Settings.LogoUrl),
            LogoDarkUrl = Text(Settings.LogoDarkUrl),
            MarkUrl = Text(Settings.MarkUrl),
            FaviconUrl = Text(Settings.FaviconUrl),
            Links = new BrandingLinks
            {
                Help = Text(Settings.HelpUrl),
                Support = Text(Settings.SupportUrl),
                Privacy = Text(Settings.PrivacyUrl),
                Terms = Text(Settings.TermsUrl),
            },
            SignIn = new BrandingSignIn
            {
                Showcase = Text(Settings.SignInShowcase) ?? "virto",
                Slides = Parse<JArray>(Text(Settings.SignInSlides), Settings.SignInSlides.Name) ?? [],
            },
            Home = new BrandingHome
            {
                Welcome = Parse<JObject>(Text(Settings.HomeWelcome), Settings.HomeWelcome.Name) is { HasValues: true } welcome
                    ? welcome
                    : null,
            },
            Theme = new BrandingTheme
            {
                Default = defaultTheme,
                Appearance = Text(Settings.DefaultAppearance) ?? "dark",
                UserChoice = !entries.TryGetValue(Settings.ThemeUserChoice.Name, out var choice) || choice is not false,
                Custom = themes,
            },
        };
    }

    /// <summary>The theme files of the themes folder, read again every half a minute</summary>
    public List<CustomTheme> GetThemes() =>
        memoryCache.GetOrCreate("AdminShell.Branding.Themes", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = ThemesCacheTime;
            return ReadThemes();
        });

    private List<CustomTheme> ReadThemes()
    {
        var folder = ThemesFolder();
        if (!Directory.Exists(folder))
        {
            return [];
        }

        var themes = new List<CustomTheme>();
        foreach (var file in Directory.EnumerateFiles(folder, "*.json").OrderBy(x => x, StringComparer.OrdinalIgnoreCase).Take(MaxThemes))
        {
            try
            {
                var theme = ReadTheme(file);
                if (theme is not null)
                {
                    themes.Add(theme);
                }
            }
            catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Admin Shell theme file {File} is skipped", file);
            }
        }
        return themes;
    }

    public string ThemesFolder()
    {
        var path = configuration[ModuleConstants.ThemesPathKey];
        if (string.IsNullOrWhiteSpace(path))
        {
            path = ModuleConstants.DefaultThemesPath;
        }
        return Path.IsPathRooted(path) ? path : Path.Combine(environment.ContentRootPath, path);
    }

    private CustomTheme ReadTheme(string file)
    {
        // the file name is the theme's id, as users' profiles keep it: acme-blue.json -> acme-blue
        var id = Path.GetFileNameWithoutExtension(file).ToLowerInvariant();
        if (!ThemeId().IsMatch(id) || ModuleConstants.BuiltInThemes.Contains(id))
        {
            logger.LogWarning("Admin Shell theme file {File} is skipped: its name must be a-z, 0-9 and dashes, and not a built-in theme's", file);
            return null;
        }
        if (new FileInfo(file).Length > MaxThemeFileBytes)
        {
            logger.LogWarning("Admin Shell theme file {File} is skipped: larger than 64 KB", file);
            return null;
        }

        var json = JObject.Parse(File.ReadAllText(file));
        var name = json.Value<string>("name");
        var themeBase = json.Value<string>("base");
        return new CustomTheme
        {
            Id = id,
            Name = string.IsNullOrWhiteSpace(name) ? id : name.Trim()[..Math.Min(name.Trim().Length, 40)],
            Base = Bases.Contains(themeBase) ? themeBase : "indigo",
            Light = Palette(json["light"], file),
            Dark = Palette(json["dark"], file),
        };
    }

    // only known keys with plain color values reach the page's style: no other CSS can be slipped in
    private Dictionary<string, string> Palette(JToken token, string file)
    {
        var palette = new Dictionary<string, string>();
        if (token is not JObject colors)
        {
            return palette;
        }
        foreach (var (key, value) in colors)
        {
            var color = value?.Type == JTokenType.String ? value.Value<string>()!.Trim() : null;
            if (PaletteKeys.Contains(key) && color is not null && Color().IsMatch(color))
            {
                palette[key] = color;
            }
            else
            {
                logger.LogWarning("Admin Shell theme file {File}: {Key} is skipped (an unknown key or not a color)", file, key);
            }
        }
        return palette;
    }

    private T Parse<T>(string json, string setting) where T : JToken
    {
        if (json is null)
        {
            return null;
        }
        try
        {
            return JToken.Parse(json) as T;
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Admin Shell setting {Setting} is not valid JSON", setting);
            return null;
        }
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,31}$")]
    private static partial Regex ThemeId();

    // #rgb, #rrggbb(aa), rgb()/rgba()/hsl()/hsla() with numbers, or a color name
    [GeneratedRegex(@"^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\)|[a-zA-Z]{3,20})$")]
    private static partial Regex Color();
}
