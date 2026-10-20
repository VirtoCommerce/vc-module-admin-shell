using System.Collections.Generic;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.AdminShell.Core;

public static class ModuleConstants
{
    public const string ModuleId = "VirtoCommerce.AdminShell";
    public const string AppId = "admin-shell";

    // Tenant types used for per-role and per-user menu layers (platform settings tenants)
    public const string RoleTenant = "Role";
    public const string UserProfileTenant = "UserProfile";

    /// <summary>The Home section of the default menu, where Recent shows</summary>
    public const string HomeSectionId = "dashboard";

    /// <summary>The section that collects what no menu places: contributions without a known section, discovered blades</summary>
    public const string MoreSectionId = "more";

    /// <summary>Recent: the uses kept per user, and the days after which an unused page's score has halved</summary>
    public const int MaxRecentTracked = 30;
    public const double RecentHalfLifeDays = 7;

    /// <summary>appsettings: AdminShell:ThemesPath, the folder of the theme files (absolute, or under the platform's folder)</summary>
    public const string ThemesPathKey = "AdminShell:ThemesPath";
    public const string DefaultThemesPath = "app_data/admin-shell/themes";

    /// <summary>The built-in color themes; a theme file can't take their ids</summary>
    public static readonly string[] BuiltInThemes = ["virto", "warm", "blue", "indigo"];

    public static class Security
    {
        public static class Permissions
        {
            public const string Access = "admin-shell:access";
            public const string MenuManage = "admin-shell:menu:manage";

            public static string[] AllPermissions { get; } = [Access, MenuManage];
        }
    }

    public static class Settings
    {
        /// <summary>Global (organization-wide) menu patch, applied on top of the default menu</summary>
        public static SettingDescriptor GlobalMenu { get; } = new()
        {
            Name = "AdminShell.Menu.Global",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Json,
            DefaultValue = "{}",
        };

        /// <summary>Whether users may pin menu items (off: their pins stop showing, and come back when it's on again)</summary>
        public static SettingDescriptor AllowPin { get; } = new()
        {
            Name = "AdminShell.Menu.AllowPin",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Boolean,
            DefaultValue = true,
        };

        /// <summary>Whether users may hide menu items (off: the items they hid show again, until it's on again)</summary>
        public static SettingDescriptor AllowHide { get; } = new()
        {
            Name = "AdminShell.Menu.AllowHide",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Boolean,
            DefaultValue = true,
        };

        /// <summary>Whether users' own order of menu items applies</summary>
        public static SettingDescriptor AllowReorder { get; } = new()
        {
            Name = "AdminShell.Menu.AllowReorder",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Boolean,
            DefaultValue = true,
        };

        public static IEnumerable<SettingDescriptor> PersonalizationSettings => [AllowPin, AllowHide, AllowReorder];

        /// <summary>Per-role menu patch (tenant type "Role", object id = role id)</summary>
        public static SettingDescriptor RoleMenu { get; } = new()
        {
            Name = "AdminShell.Menu.Role",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Json,
            DefaultValue = "{}",
        };

        /// <summary>Per-user personalization: pinned, hidden and ordered items. Hidden so the AngularJS profile save can't overwrite it.</summary>
        public static SettingDescriptor UserMenu { get; } = new()
        {
            Name = "AdminShell.Menu.User",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Json,
            DefaultValue = "{}",
            IsHidden = true,
        };

        /// <summary>Per-user uses of menu items for Recent (score and last use per item). Hidden, like the prefs.</summary>
        public static SettingDescriptor UserRecent { get; } = new()
        {
            Name = "AdminShell.Menu.Recent",
            GroupName = "Admin Shell|Menu",
            ValueType = SettingValueType.Json,
            DefaultValue = "[]",
            IsHidden = true,
        };

        /// <summary>
        /// Per-user appearance: light, dark, or the operating system's. Kept in the user's profile (read and written by the
        /// host through the Settings v2 "me" API, so not hidden) so it follows the user to every browser and device.
        /// </summary>
        public static SettingDescriptor UserAppearance { get; } = new()
        {
            Name = "AdminShell.UI.Appearance",
            GroupName = "Admin Shell|Appearance",
            ValueType = SettingValueType.ShortText,
            DefaultValue = "dark",
            AllowedValues = ["system", "light", "dark"],
        };

        /// <summary>
        /// Per-user color theme: Virto, Warm, Blue, Indigo or a theme file's (see ThemesPathKey); kept like the appearance.
        /// No allowed values: the theme files are the installation's.
        /// </summary>
        public static SettingDescriptor UserTheme { get; } = new()
        {
            Name = "AdminShell.UI.Theme",
            GroupName = "Admin Shell|Appearance",
            ValueType = SettingValueType.ShortText,
            DefaultValue = "virto",
        };

        /* ---- white-labeling (docs/branding.md): the brand (low effort), the sign-in page and Home (medium), the theme
           (high, with theme files) ---- */

        private const string BrandingGroup = "Admin Shell|Branding";
        private const string SignInGroup = "Admin Shell|Sign-in page";
        private const string HomeGroup = "Admin Shell|Home";
        private const string ThemeGroup = "Admin Shell|Theme";

        /// <summary>The company or product name: the browser tab, the sign-in page, the footer. Empty: Virto Commerce</summary>
        public static SettingDescriptor CompanyName { get; } = new()
        {
            Name = "AdminShell.Branding.CompanyName",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        /// <summary>The logo on light backgrounds (sign-in page, Home panel): an absolute URL or a path on the platform</summary>
        public static SettingDescriptor LogoUrl { get; } = new()
        {
            Name = "AdminShell.Branding.LogoUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        /// <summary>The logo on dark backgrounds; empty: the light one</summary>
        public static SettingDescriptor LogoDarkUrl { get; } = new()
        {
            Name = "AdminShell.Branding.LogoDarkUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        /// <summary>The square mark: the top of the rail and the phone's top bar</summary>
        public static SettingDescriptor MarkUrl { get; } = new()
        {
            Name = "AdminShell.Branding.MarkUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        /// <summary>The browser tab's icon; empty: the mark, then Virto's</summary>
        public static SettingDescriptor FaviconUrl { get; } = new()
        {
            Name = "AdminShell.Branding.FaviconUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        public static SettingDescriptor HelpUrl { get; } = new()
        {
            Name = "AdminShell.Branding.HelpUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
            DefaultValue = "https://docs.virtocommerce.org/platform/user-guide/latest/getting-started/",
        };

        public static SettingDescriptor SupportUrl { get; } = new()
        {
            Name = "AdminShell.Branding.SupportUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        public static SettingDescriptor PrivacyUrl { get; } = new()
        {
            Name = "AdminShell.Branding.PrivacyUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        public static SettingDescriptor TermsUrl { get; } = new()
        {
            Name = "AdminShell.Branding.TermsUrl",
            GroupName = BrandingGroup,
            ValueType = SettingValueType.ShortText,
        };

        /// <summary>The panel beside the sign-in form: Virto's slides, the company's own (SignInSlides) or none</summary>
        public static SettingDescriptor SignInShowcase { get; } = new()
        {
            Name = "AdminShell.SignIn.Showcase",
            GroupName = SignInGroup,
            ValueType = SettingValueType.ShortText,
            DefaultValue = "virto",
            AllowedValues = ["virto", "custom", "none"],
        };

        /// <summary>The company's slides: [{ chip, title, body, points, image, imageDark, alt, link: { text, url } }]</summary>
        public static SettingDescriptor SignInSlides { get; } = new()
        {
            Name = "AdminShell.SignIn.Slides",
            GroupName = SignInGroup,
            ValueType = SettingValueType.Json,
            DefaultValue = "[]",
        };

        /// <summary>A welcome card first on Home: { title, body, image, imageDark, links: [{ text, url }] }; {} hides it</summary>
        public static SettingDescriptor HomeWelcome { get; } = new()
        {
            Name = "AdminShell.Home.Welcome",
            GroupName = HomeGroup,
            ValueType = SettingValueType.Json,
            DefaultValue = "{}",
        };

        /// <summary>The theme of the sign-in page and of users who haven't picked one: a built-in or a theme file's id</summary>
        public static SettingDescriptor DefaultTheme { get; } = new()
        {
            Name = "AdminShell.Theme.Default",
            GroupName = ThemeGroup,
            ValueType = SettingValueType.ShortText,
            DefaultValue = "virto",
        };

        /// <summary>The appearance of the sign-in page and of users who haven't picked one</summary>
        public static SettingDescriptor DefaultAppearance { get; } = new()
        {
            Name = "AdminShell.Theme.Appearance",
            GroupName = ThemeGroup,
            ValueType = SettingValueType.ShortText,
            DefaultValue = "dark",
            AllowedValues = ["system", "light", "dark"],
        };

        /// <summary>Users pick their own theme; off: everyone has the default theme and the theme pickers are gone</summary>
        public static SettingDescriptor ThemeUserChoice { get; } = new()
        {
            Name = "AdminShell.Theme.UserChoice",
            GroupName = ThemeGroup,
            ValueType = SettingValueType.Boolean,
            DefaultValue = true,
        };

        public static IEnumerable<SettingDescriptor> BrandingSettings =>
        [
            CompanyName, LogoUrl, LogoDarkUrl, MarkUrl, FaviconUrl, HelpUrl, SupportUrl, PrivacyUrl, TermsUrl,
            SignInShowcase, SignInSlides, HomeWelcome, DefaultTheme, DefaultAppearance, ThemeUserChoice,
        ];

        public static IEnumerable<SettingDescriptor> ModuleSettings => [GlobalMenu, .. PersonalizationSettings, .. BrandingSettings];
        public static IEnumerable<SettingDescriptor> RoleSettings => [RoleMenu];
        public static IEnumerable<SettingDescriptor> UserSettings => [UserMenu, UserRecent, UserAppearance, UserTheme];
    }
}
