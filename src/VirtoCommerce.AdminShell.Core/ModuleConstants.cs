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

        public static IEnumerable<SettingDescriptor> ModuleSettings => [GlobalMenu];
        public static IEnumerable<SettingDescriptor> RoleSettings => [RoleMenu];
        public static IEnumerable<SettingDescriptor> UserSettings => [UserMenu];
    }
}
