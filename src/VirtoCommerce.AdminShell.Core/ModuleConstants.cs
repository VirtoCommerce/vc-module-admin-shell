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

    /// <summary>Recent: the uses kept per user, and the days after which an unused page's score has halved</summary>
    public const int MaxRecentTracked = 30;
    public const double RecentHalfLifeDays = 7;

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

        /// <summary>Per-user color theme: Virto (the default), Warm, Blue or Indigo; kept like the appearance</summary>
        public static SettingDescriptor UserTheme { get; } = new()
        {
            Name = "AdminShell.UI.Theme",
            GroupName = "Admin Shell|Appearance",
            ValueType = SettingValueType.ShortText,
            DefaultValue = "virto",
            AllowedValues = ["virto", "warm", "blue", "indigo"],
        };

        public static IEnumerable<SettingDescriptor> ModuleSettings => [GlobalMenu];
        public static IEnumerable<SettingDescriptor> RoleSettings => [RoleMenu];
        public static IEnumerable<SettingDescriptor> UserSettings => [UserMenu, UserRecent, UserAppearance, UserTheme];
    }
}
