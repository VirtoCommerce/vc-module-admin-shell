using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Newtonsoft.Json;
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
    IDistributedLock distributedLock) : IAdminDashboardService
{
    public async Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal)
    {
        var userId = principal.GetUserId();
        var global = GetGlobalAsync();
        var prefs = GetUserPrefsAsync(userId);
        var personalization = GetPersonalizationAsync();
        var user = await userManager.FindByIdAsync(userId);

        // every role counts, with or without a setting: a role that hides nothing keeps a widget another role hides
        var roles = await Task.WhenAll((user?.Roles ?? []).Select(role => GetRoleAsync(role.Id)));

        return DashboardComposer.Compose(
            await global,
            roles,
            await prefs,
            await personalization,
            user?.IsAdministrator == true,
            MenuAccess.HasPermission(principal, Permissions.DashboardManage));
    }

    public Task<DashboardPatch> GetGlobalAsync() => ReadPatchAsync(Settings.GlobalDashboard, null, null);

    // one write at a time: a reset raises the version the stored layer has
    public Task SaveGlobalAsync(DashboardPatch patch, bool resetUserLayouts) =>
        distributedLock.ExecuteAsync("admin-shell:dashboard:global",
            async _ =>
            {
                var stored = await GetGlobalAsync();
                var value = DashboardComposer.Normalize(patch);
                value.LayoutVersion = stored.LayoutVersion + (resetUserLayouts ? 1 : 0);
                await WriteAsync(Settings.GlobalDashboard, null, null, value);
            },
            TimeSpan.FromSeconds(10));

    public async Task<bool> RoleExistsAsync(string roleId) =>
        !string.IsNullOrWhiteSpace(roleId) && await roleManager.FindByIdAsync(roleId) != null;

    public Task<DashboardPatch> GetRoleAsync(string roleId) => ReadPatchAsync(Settings.RoleDashboard, ModuleConstants.RoleTenant, roleId);

    public Task SaveRoleAsync(string roleId, DashboardPatch patch)
    {
        var value = DashboardComposer.Normalize(patch);
        value.LayoutVersion = 0;
        return WriteAsync(Settings.RoleDashboard, ModuleConstants.RoleTenant, roleId, value);
    }

    public async Task<UserDashboardPrefs> GetUserPrefsAsync(string userId) =>
        DashboardComposer.Normalize(await ReadAsync<UserDashboardPrefs>(Settings.UserDashboard, ModuleConstants.UserProfileTenant, userId));

    // one write at a time per user: two first saves would each insert a settings row
    public Task SaveUserPrefsAsync(string userId, UserDashboardPrefs prefs) =>
        distributedLock.ExecuteAsync($"admin-shell:dashboard:{userId}",
            _ => WriteAsync(Settings.UserDashboard, ModuleConstants.UserProfileTenant, userId, DashboardComposer.Normalize(prefs)),
            TimeSpan.FromSeconds(10));

    public async Task<DashboardPersonalization> GetPersonalizationAsync() => new()
    {
        AllowMove = await settingsManager.GetValueAsync<bool>(Settings.DashboardAllowMove),
        AllowResize = await settingsManager.GetValueAsync<bool>(Settings.DashboardAllowResize),
    };

    public async Task SavePersonalizationAsync(DashboardPersonalization personalization)
    {
        await settingsManager.SetValueAsync(Settings.DashboardAllowMove.Name, personalization.AllowMove);
        await settingsManager.SetValueAsync(Settings.DashboardAllowResize.Name, personalization.AllowResize);
    }

    private async Task<DashboardPatch> ReadPatchAsync(SettingDescriptor descriptor, string objectType, string objectId) =>
        DashboardComposer.Normalize(await ReadAsync<DashboardPatch>(descriptor, objectType, objectId));

    // A value that doesn't read as T (edited by hand, with a typo) reads as empty: everyone then sees every widget their
    // permissions allow, instead of losing the dashboard
    private async Task<T> ReadAsync<T>(SettingDescriptor descriptor, string objectType, string objectId) where T : new()
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

    private async Task WriteAsync(SettingDescriptor descriptor, string objectType, string objectId, object value)
    {
        var setting = await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId);
        setting.ObjectType = objectType;
        setting.ObjectId = objectId;
        // only what a layer says: a widget's unset fields are left out, so the layer below shows through
        setting.Value = JsonConvert.SerializeObject(value, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });
        await settingsManager.SaveObjectSettingsAsync([setting]);
    }
}
