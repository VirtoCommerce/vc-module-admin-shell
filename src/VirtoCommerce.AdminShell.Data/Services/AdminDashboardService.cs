using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.DistributedLock;
using VirtoCommerce.Platform.Core.Security;
using VirtoCommerce.Platform.Core.Settings;
using Permissions = VirtoCommerce.AdminShell.Core.ModuleConstants.Security.Permissions;
using Settings = VirtoCommerce.AdminShell.Core.ModuleConstants.Settings;

namespace VirtoCommerce.AdminShell.Data.Services;

/// <summary>The dashboard layers: platform settings for everyone, for each role and for each user, as for the menu</summary>
public class AdminDashboardService(
    ISettingsManager settingsManager,
    UserManager<ApplicationUser> userManager,
    RoleManager<Role> roleManager,
    IDistributedLock distributedLock,
    IDashboardComposer composer) : IAdminDashboardService
{
    private static readonly JsonSerializerSettings WriteSettings = new()
    {
        NullValueHandling = NullValueHandling.Ignore,
        ContractResolver = new DefaultContractResolver
        {
            NamingStrategy = new CamelCaseNamingStrategy { ProcessDictionaryKeys = false },
        },
    };

    public virtual async Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal)
    {
        var userId = principal.GetUserId();
        var global = GetGlobalAsync();
        var prefs = GetUserPrefsAsync(userId);
        var personalization = GetPersonalizationAsync();
        var user = await userManager.FindByIdAsync(userId);

        // every role counts, with or without a setting: a role that hides nothing keeps a widget another role hides
        var roles = await Task.WhenAll((user?.Roles ?? []).Select(role => GetRoleAsync(role.Id)));

        return composer.Compose(
            await global,
            roles,
            await prefs,
            await personalization,
            user?.IsAdministrator == true,
            MenuAccess.HasPermission(principal, Permissions.DashboardManage));
    }

    public virtual Task<DashboardPatch> GetGlobalAsync() => ReadPatchAsync(Settings.GlobalDashboard, null, null);

    // one write at a time: a reset raises the version the stored layer has
    public virtual Task SaveGlobalAsync(DashboardPatch patch, bool resetUserLayouts) =>
        distributedLock.ExecuteAsync("admin-shell:dashboard:global",
            async _ =>
            {
                var stored = await GetGlobalAsync();
                var value = composer.Normalize(patch);
                value.LayoutVersion = stored.LayoutVersion + (resetUserLayouts ? 1 : 0);
                await WriteAsync(Settings.GlobalDashboard, null, null, value);
            },
            TimeSpan.FromSeconds(10));

    public virtual async Task<bool> RoleExistsAsync(string roleId) =>
        !string.IsNullOrWhiteSpace(roleId) && await roleManager.FindByIdAsync(roleId) != null;

    public virtual async Task<IList<RoleDashboard>> GetRolesAsync()
    {
        // the role store's list, then each role with its permissions (the role manager loads them, one at a time: it
        // isn't safe to share between parallel calls); the roles' layers are read together, as for the menu
        var ids = roleManager.Roles.Select(x => x.Id).ToList();
        var roles = new List<Role>();
        foreach (var id in ids)
        {
            if (await roleManager.FindByIdAsync(id) is { } role)
            {
                roles.Add(role);
            }
        }

        var layers = await Task.WhenAll(roles.Select(role => GetRoleAsync(role.Id)));

        return roles
            .Select((role, i) => new RoleDashboard
            {
                Id = role.Id,
                Name = role.Name ?? role.Id,
                Permissions = (role.Permissions ?? []).Select(x => x.Name).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList(),
                Dashboard = layers[i],
            })
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public virtual Task<DashboardPatch> GetRoleAsync(string roleId) => ReadPatchAsync(Settings.RoleDashboard, ModuleConstants.RoleTenant, roleId);

    // one write at a time per role: two first saves would each insert a settings row
    public virtual Task SaveRoleAsync(string roleId, DashboardPatch patch) =>
        distributedLock.ExecuteAsync($"admin-shell:dashboard:role:{roleId}",
            _ =>
            {
                var value = composer.Normalize(patch);
                value.LayoutVersion = 0;
                return WriteAsync(Settings.RoleDashboard, ModuleConstants.RoleTenant, roleId, value);
            },
            TimeSpan.FromSeconds(10));

    public virtual async Task<UserDashboardPrefs> GetUserPrefsAsync(string userId) =>
        composer.Normalize(await ReadAsync<UserDashboardPrefs>(Settings.UserDashboard, ModuleConstants.UserProfileTenant, userId));

    // one write at a time per user: two first saves would each insert a settings row
    public virtual Task SaveUserPrefsAsync(string userId, UserDashboardPrefs prefs) =>
        distributedLock.ExecuteAsync($"admin-shell:dashboard:{userId}",
            _ => WriteAsync(Settings.UserDashboard, ModuleConstants.UserProfileTenant, userId, composer.Normalize(prefs)),
            TimeSpan.FromSeconds(10));

    public virtual async Task<DashboardPersonalization> GetPersonalizationAsync() => new()
    {
        AllowMove = await settingsManager.GetValueAsync<bool>(Settings.DashboardAllowMove),
        AllowResize = await settingsManager.GetValueAsync<bool>(Settings.DashboardAllowResize),
    };

    // one write at a time: the two settings are saved together
    public virtual Task SavePersonalizationAsync(DashboardPersonalization personalization) =>
        distributedLock.ExecuteAsync("admin-shell:dashboard:personalization",
            async _ =>
            {
                await settingsManager.SetValueAsync(Settings.DashboardAllowMove.Name, personalization.AllowMove);
                await settingsManager.SetValueAsync(Settings.DashboardAllowResize.Name, personalization.AllowResize);
            },
            TimeSpan.FromSeconds(10));

    protected virtual async Task<DashboardPatch> ReadPatchAsync(SettingDescriptor descriptor, string objectType, string objectId) =>
        composer.Normalize(await ReadAsync<DashboardPatch>(descriptor, objectType, objectId));

    // A value that doesn't read as T (edited by hand, with a typo) reads as empty: everyone then sees every widget their
    // permissions allow, instead of losing the dashboard
    protected virtual async Task<T> ReadAsync<T>(SettingDescriptor descriptor, string objectType, string objectId) where T : new()
    {
        var json = (await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId))?.Value as string;
        if (string.IsNullOrWhiteSpace(json))
        {
            return new T();
        }

        try
        {
            return JsonConvert.DeserializeObject<T>(json, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore }) ?? new T();
        }
        catch (JsonException)
        {
            return new T();
        }
    }

    protected virtual async Task WriteAsync(SettingDescriptor descriptor, string objectType, string objectId, object value)
    {
        var setting = await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId);
        setting.ObjectType = objectType;
        setting.ObjectId = objectId;
        // only what a layer says: a widget's unset fields are left out, so the layer below shows through. camelCase as the
        // API and the docs show it; widget ids (dictionary keys) stay as they are. Reads ignore case.
        setting.Value = JsonConvert.SerializeObject(value, WriteSettings);
        await settingsManager.SaveObjectSettingsAsync([setting]);
    }
}
