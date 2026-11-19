using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Moq;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Data.Services;
using VirtoCommerce.Platform.Core;
using VirtoCommerce.Platform.Core.DistributedLock;
using VirtoCommerce.Platform.Core.Security;
using VirtoCommerce.Platform.Core.Settings;
using Xunit;
using Settings = VirtoCommerce.AdminShell.Core.ModuleConstants.Settings;

namespace VirtoCommerce.AdminShell.Tests;

/// <summary>The dashboard service on its settings: what it reads, what it writes, and how it composes a user's dashboard</summary>
public class DashboardServiceTests
{
    private readonly Dictionary<string, ObjectSettingEntry> _settings = [];
    private readonly Mock<IDistributedLock> _lock = new() { DefaultValue = DefaultValue.Mock };
    private readonly List<Role> _roles = [];
    private readonly List<ApplicationUser> _users = [];

    private static string Key(string name, string objectType, string objectId) => $"{name}|{objectType}|{objectId}";

    private void Store(SettingDescriptor descriptor, string objectType, string objectId, object value) =>
        _settings[Key(descriptor.Name, objectType, objectId)] = new ObjectSettingEntry(descriptor)
        {
            ObjectType = objectType,
            ObjectId = objectId,
            Value = value,
        };

    private string Stored(SettingDescriptor descriptor, string objectType, string objectId) =>
        _settings.TryGetValue(Key(descriptor.Name, objectType, objectId), out var entry) ? entry.Value as string : null;

    private AdminDashboardService Create()
    {
        var settings = new Mock<ISettingsManager>();
        settings
            .Setup(x => x.GetObjectSettingAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync((string name, string objectType, string objectId) =>
                _settings.TryGetValue(Key(name, objectType, objectId), out var entry)
                    ? entry
                    : new ObjectSettingEntry(AllDescriptors.First(d => d.Name == name)) { ObjectType = objectType, ObjectId = objectId });
        settings
            .Setup(x => x.SaveObjectSettingsAsync(It.IsAny<IEnumerable<ObjectSettingEntry>>()))
            .Callback((IEnumerable<ObjectSettingEntry> entries) =>
            {
                foreach (var entry in entries)
                {
                    _settings[Key(entry.Name, entry.ObjectType, entry.ObjectId)] = entry;
                }
            })
            .Returns(Task.CompletedTask);

        var users = new Mock<UserManager<ApplicationUser>>(Mock.Of<IUserStore<ApplicationUser>>(), null, null, null, null, null, null, null, null);
        users.Setup(x => x.FindByIdAsync(It.IsAny<string>())).ReturnsAsync((string id) => _users.FirstOrDefault(u => u.Id == id));

        var roles = new Mock<RoleManager<Role>>(Mock.Of<IRoleStore<Role>>(), null, null, null, null);
        roles.Setup(x => x.Roles).Returns(() => _roles.AsQueryable());
        roles.Setup(x => x.FindByIdAsync(It.IsAny<string>())).ReturnsAsync((string id) => _roles.FirstOrDefault(r => r.Id == id));

        return new AdminDashboardService(settings.Object, users.Object, roles.Object, _lock.Object, new DashboardComposer());
    }

    private static readonly SettingDescriptor[] AllDescriptors =
        [.. Settings.ModuleSettings, .. Settings.RoleSettings, .. Settings.UserSettings];

    private static DashboardPatch Hide(params string[] ids)
    {
        var patch = new DashboardPatch();
        foreach (var id in ids)
        {
            patch.Widgets[id] = new WidgetPatch { Hidden = true };
        }

        return patch;
    }

    private static ClaimsPrincipal Principal(string userId, params string[] permissions) =>
        new(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId),
                .. permissions.Select(p => new Claim(PlatformConstants.Security.Claims.PermissionClaimType, p)),
            ],
            "test"));

    [Fact]
    public async Task SaveGlobal_ResetRaisesTheStoredVersion_ElseKeepsIt()
    {
        var service = Create();
        Store(Settings.GlobalDashboard, null, null, """{"layoutVersion":3}""");

        // the client's version is ignored either way
        await service.SaveGlobalAsync(new DashboardPatch { LayoutVersion = 99 }, resetUserLayouts: true);
        Assert.Equal(4, (await service.GetGlobalAsync()).LayoutVersion);

        await service.SaveGlobalAsync(Hide("shell-alerts"), resetUserLayouts: false);
        var global = await service.GetGlobalAsync();
        Assert.Equal(4, global.LayoutVersion);
        Assert.True(global.Widgets["shell-alerts"].Hidden);
    }

    [Fact]
    public async Task SaveRole_StoresNoVersion_AndNormalizes()
    {
        var service = Create();
        var patch = Hide(" shell-alerts ");
        patch.LayoutVersion = 7;

        await service.SaveRoleAsync("role-1", patch);

        var stored = await service.GetRoleAsync("role-1");
        Assert.Equal(0, stored.LayoutVersion);
        Assert.Equal(["shell-alerts"], stored.Widgets.Keys);
    }

    [Fact]
    public async Task Writes_UseCamelCase_AndKeepWidgetIds()
    {
        var service = Create();
        var patch = new DashboardPatch();
        patch.Widgets["Orders-Sales"] = new WidgetPatch { Width = 6 };

        await service.SaveGlobalAsync(patch, resetUserLayouts: false);

        Assert.Equal("""{"widgets":{"Orders-Sales":{"width":6}},"layoutVersion":0}""", Stored(Settings.GlobalDashboard, null, null));
    }

    [Fact]
    public async Task Reads_ABrokenValueAsEmpty()
    {
        var service = Create();
        Store(Settings.GlobalDashboard, null, null, "{ not json");
        Store(Settings.RoleDashboard, ModuleConstants.RoleTenant, "role-1", "[1,2]");

        Assert.Empty((await service.GetGlobalAsync()).Widgets);
        Assert.Empty((await service.GetRoleAsync("role-1")).Widgets);
    }

    [Fact]
    public async Task Effective_ComposesGlobalRolesAndUser()
    {
        var service = Create();
        _roles.AddRange([new Role { Id = "r1", Name = "One" }, new Role { Id = "r2", Name = "Two" }]);
        _users.Add(new ApplicationUser { Id = "u1", Roles = [.. _roles] });
        Store(Settings.GlobalDashboard, null, null, """{"widgets":{"shell-sign-ins":{"hidden":true}}}""");
        Store(Settings.RoleDashboard, ModuleConstants.RoleTenant, "r1", """{"widgets":{"shell-alerts":{"hidden":true},"shell-activity":{"hidden":true}}}""");
        Store(Settings.RoleDashboard, ModuleConstants.RoleTenant, "r2", """{"widgets":{"shell-alerts":{"hidden":true}}}""");
        Store(Settings.UserDashboard, ModuleConstants.UserProfileTenant, "u1", """{"widgets":{"orders-recent":{"x":1,"y":2}}}""");

        var result = await service.GetEffectiveDashboardAsync(Principal("u1", ModuleConstants.Security.Permissions.DashboardManage));

        Assert.Equal(["shell-alerts", "shell-sign-ins"], result.Hidden);
        Assert.Equal(1, result.Layout["orders-recent"].X);
        Assert.True(result.CanManage);
    }

    [Fact]
    public async Task Effective_AdministratorKeepsWhatRolesHide_NotWhatEveryoneHides()
    {
        var service = Create();
        _roles.Add(new Role { Id = "r1", Name = "One" });
        _users.Add(new ApplicationUser { Id = "admin", IsAdministrator = true, Roles = [.. _roles] });
        Store(Settings.GlobalDashboard, null, null, """{"widgets":{"shell-sign-ins":{"hidden":true}}}""");
        Store(Settings.RoleDashboard, ModuleConstants.RoleTenant, "r1", """{"widgets":{"shell-alerts":{"hidden":true}}}""");

        var result = await service.GetEffectiveDashboardAsync(Principal("admin"));

        Assert.Equal(["shell-sign-ins"], result.Hidden);
        Assert.False(result.CanManage);
    }

    [Fact]
    public async Task Roles_AllInOneAnswer_ByName_WithPermissionsAndLayers()
    {
        var service = Create();
        _roles.AddRange(
        [
            new Role { Id = "r2", Name = "beta", Permissions = [new Permission { Name = "order:read" }, new Permission { Name = "order:read" }] },
            new Role { Id = "r1", Name = "Alpha" },
        ]);
        Store(Settings.RoleDashboard, ModuleConstants.RoleTenant, "r2", """{"widgets":{"orders-recent":{"hidden":true}}}""");

        var result = await service.GetRolesAsync();

        Assert.Equal(["Alpha", "beta"], result.Select(x => x.Name));
        Assert.Equal(["order:read"], result[1].Permissions);
        Assert.True(result[1].Dashboard.Widgets["orders-recent"].Hidden);
        Assert.Empty(result[0].Dashboard.Widgets);
    }

    [Fact]
    public async Task UserPrefs_IgnoreHiding_AndRoleExistence_IsChecked()
    {
        var service = Create();
        _roles.Add(new Role { Id = "r1", Name = "One" });
        var prefs = new UserDashboardPrefs();
        prefs.Widgets["shell-alerts"] = new WidgetPatch { Hidden = true, X = 2 };

        await service.SaveUserPrefsAsync("u1", prefs);

        var stored = await service.GetUserPrefsAsync("u1");
        Assert.Null(stored.Widgets["shell-alerts"].Hidden);
        Assert.Equal(2, stored.Widgets["shell-alerts"].X);
        Assert.True(await service.RoleExistsAsync("r1"));
        Assert.False(await service.RoleExistsAsync("nope"));
    }

    [Fact]
    public async Task Saves_OfSharedLayers_TakeALock()
    {
        var service = Create();

        await service.SaveGlobalAsync(new DashboardPatch(), resetUserLayouts: false);
        await service.SaveRoleAsync("r1", new DashboardPatch());
        await service.SaveUserPrefsAsync("u1", new UserDashboardPrefs());

        foreach (var name in new[] { "admin-shell:dashboard:global", "admin-shell:dashboard:role:r1", "admin-shell:dashboard:u1" })
        {
            _lock.Verify(x => x.AcquireAsync(name, It.IsAny<System.TimeSpan?>(), It.IsAny<CancellationToken>()), Times.Once, name);
        }
    }
}
