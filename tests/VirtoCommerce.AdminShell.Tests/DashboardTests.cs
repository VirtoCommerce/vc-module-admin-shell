using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.AdminShell.Data.Services;
using VirtoCommerce.AdminShell.Web.Controllers.Api;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

/// <summary>The dashboard layers: for everyone, per role and per user, and the API that saves them</summary>
public class DashboardTests
{
    private static readonly IDashboardComposer Composer = new DashboardComposer();

    private static DashboardPatch Hide(params string[] ids)
    {
        var patch = new DashboardPatch();
        foreach (var id in ids)
        {
            patch.Widgets[id] = new WidgetPatch { Hidden = true };
        }

        return patch;
    }

    private static EffectiveDashboard Compose(
        DashboardPatch global = null,
        DashboardPatch[] roles = null,
        UserDashboardPrefs user = null,
        DashboardPersonalization personalization = null,
        bool isAdministrator = false) =>
        Composer.Compose(global, roles ?? [], user, personalization, isAdministrator, canManage: false);

    [Fact]
    public void NothingConfigured_HidesNothing()
    {
        var result = Compose();

        Assert.Empty(result.Hidden);
        Assert.Empty(result.Defaults);
        Assert.Empty(result.Layout);
    }

    [Fact]
    public void Global_HidesForEveryone_AdministratorsToo()
    {
        Assert.Equal(["shell-alerts"], Compose(global: Hide("shell-alerts"), isAdministrator: true).Hidden);
    }

    [Fact]
    public void Global_PlacesAndSizesAreTheDefaults()
    {
        var global = new DashboardPatch();
        global.Widgets["shell-alerts"] = new WidgetPatch { X = 0, Y = 0, Width = 12, Height = 4 };

        var layout = Compose(global: global).Defaults["shell-alerts"];

        Assert.Equal((0, 0, 12, 4), (layout.X, layout.Y, layout.Width, layout.Height));
    }

    [Fact]
    public void Roles_HideOnlyWhatEveryRoleHides()
    {
        var result = Compose(roles: [Hide("shell-alerts", "shell-activity"), Hide("shell-alerts")]);

        Assert.Equal(["shell-alerts"], result.Hidden);
    }

    [Fact]
    public void Roles_ARoleWithoutSettingKeepsEveryWidget()
    {
        Assert.Empty(Compose(roles: [Hide("shell-alerts"), new DashboardPatch()]).Hidden);
    }

    [Fact]
    public void Roles_DontHideForAdministrators()
    {
        Assert.Empty(Compose(roles: [Hide("shell-alerts")], isAdministrator: true).Hidden);
    }

    [Fact]
    public void User_LayoutApplies_HidingDoesNot()
    {
        var user = new UserDashboardPrefs();
        user.Widgets["shell-alerts"] = new WidgetPatch { Hidden = true };
        user.Widgets["shell-activity"] = new WidgetPatch { X = 1, Y = 2, Width = 6, Height = 3 };

        var result = Compose(user: user);

        Assert.Empty(result.Hidden);
        Assert.False(result.Layout.ContainsKey("shell-alerts"));
        Assert.Equal((1, 2, 6, 3), (result.Layout["shell-activity"].X, result.Layout["shell-activity"].Y,
            result.Layout["shell-activity"].Width, result.Layout["shell-activity"].Height));
    }

    [Fact]
    public void User_LayoutOfAnOlderVersion_IsDropped()
    {
        var user = new UserDashboardPrefs { LayoutVersion = 1 };
        user.Widgets["shell-activity"] = new WidgetPatch { X = 1, Y = 2 };

        var result = Compose(global: new DashboardPatch { LayoutVersion = 2 }, user: user);

        Assert.Empty(result.Layout);
    }

    [Fact]
    public void Personalization_OffDropsWhatUsersMayNotChange()
    {
        var user = new UserDashboardPrefs();
        user.Widgets["shell-activity"] = new WidgetPatch { X = 1, Y = 2, Width = 6, Height = 3 };

        var result = Compose(user: user, personalization: new DashboardPersonalization { AllowMove = false });

        var layout = result.Layout["shell-activity"];
        Assert.Equal((null, null, 6, 3), (layout.X, layout.Y, layout.Width, layout.Height));
    }

    [Fact]
    public void Normalize_ClampsAndDropsEmptyEntries()
    {
        var patch = new DashboardPatch { LayoutVersion = -3 };
        patch.Widgets[" shell-alerts "] = new WidgetPatch { Hidden = true };
        patch.Widgets["shell-activity"] = new WidgetPatch { Hidden = false };
        patch.Widgets["orders-sales"] = new WidgetPatch { Width = 40, X = -2 };

        var result = Composer.Normalize(patch);

        Assert.Equal(0, result.LayoutVersion);
        Assert.True(result.Widgets["shell-alerts"].Hidden);
        Assert.False(result.Widgets.ContainsKey("shell-activity"));
        Assert.Equal((0, 12), (result.Widgets["orders-sales"].X, result.Widgets["orders-sales"].Width));
    }

    [Fact]
    public async Task GetRoles_ReturnsEveryRoleInOneAnswer()
    {
        var (controller, _) = Create();

        var result = Assert.IsType<OkObjectResult>((await controller.GetRoles()).Result);
        var roles = Assert.IsType<IList<RoleDashboard>>(result.Value, exactMatch: false);

        Assert.Equal(["order:read"], Assert.Single(roles).Permissions);
    }

    [Fact]
    public async Task SaveRole_WithoutBody_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();

        AssertBadRequest(await controller.SaveRole("role-1", null));
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveRole_UnknownRole_Returns404AndSavesNothing()
    {
        var (controller, service) = Create();

        Assert.IsType<NotFoundResult>(await controller.SaveRole("no-such-role", Hide("shell-alerts")));
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveRole_ValidBody_Saves()
    {
        var (controller, service) = Create();

        Assert.IsType<NoContentResult>(await controller.SaveRole("role-1", Hide("shell-alerts")));
        Assert.Equal(["role:role-1"], service.Saved);
    }

    [Fact]
    public async Task SaveGlobal_PassesTheReset()
    {
        var (controller, service) = Create();

        Assert.IsType<NoContentResult>(await controller.SaveGlobal(new DashboardPatch(), resetUserLayouts: true));
        Assert.Equal(["global:reset"], service.Saved);
    }

    [Fact]
    public async Task SaveMine_WrongShape_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();
        controller.ModelState.AddModelError("widgets", "Cannot deserialize.");

        AssertBadRequest(await controller.SaveMine(new UserDashboardPrefs()));
        Assert.Empty(service.Saved);
    }

    private static void AssertBadRequest(ActionResult result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status400BadRequest, objectResult.StatusCode ?? StatusCodes.Status400BadRequest);
        Assert.IsType<ValidationProblemDetails>(objectResult.Value);
    }

    private static (AdminShellDashboardController Controller, RecordingService Service) Create()
    {
        var service = new RecordingService();
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "user-1")], "test"));
        var controller = new AdminShellDashboardController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
            ProblemDetailsFactory = new TestProblemDetailsFactory(),
        };
        return (controller, service);
    }

    private sealed class TestProblemDetailsFactory : Microsoft.AspNetCore.Mvc.Infrastructure.ProblemDetailsFactory
    {
        public override ProblemDetails CreateProblemDetails(HttpContext httpContext, int? statusCode = null, string title = null,
            string type = null, string detail = null, string instance = null) =>
            new() { Status = statusCode ?? StatusCodes.Status500InternalServerError, Title = title, Type = type, Detail = detail, Instance = instance };

        public override ValidationProblemDetails CreateValidationProblemDetails(HttpContext httpContext,
            Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary modelStateDictionary, int? statusCode = null, string title = null,
            string type = null, string detail = null, string instance = null) =>
            new(modelStateDictionary) { Status = statusCode ?? StatusCodes.Status400BadRequest, Title = title, Type = type, Detail = detail, Instance = instance };
    }

    private sealed class RecordingService : IAdminDashboardService
    {
        public List<string> Saved { get; } = [];

        public Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal) => Task.FromResult(new EffectiveDashboard());

        public Task<DashboardPatch> GetGlobalAsync() => Task.FromResult(new DashboardPatch());

        public Task SaveGlobalAsync(DashboardPatch patch, bool resetUserLayouts)
        {
            Saved.Add(resetUserLayouts ? "global:reset" : "global");
            return Task.CompletedTask;
        }

        public Task<bool> RoleExistsAsync(string roleId) => Task.FromResult(roleId == "role-1");

        public Task<DashboardPatch> GetRoleAsync(string roleId) => Task.FromResult(new DashboardPatch());

        public Task<IList<RoleDashboard>> GetRolesAsync() =>
            Task.FromResult<IList<RoleDashboard>>([new RoleDashboard { Id = "role-1", Name = "Role 1", Permissions = ["order:read"] }]);

        public Task SaveRoleAsync(string roleId, DashboardPatch patch)
        {
            Saved.Add($"role:{roleId}");
            return Task.CompletedTask;
        }

        public Task<UserDashboardPrefs> GetUserPrefsAsync(string userId) => Task.FromResult(new UserDashboardPrefs());

        public Task SaveUserPrefsAsync(string userId, UserDashboardPrefs prefs)
        {
            Saved.Add($"user:{userId}");
            return Task.CompletedTask;
        }

        public Task<DashboardPersonalization> GetPersonalizationAsync() => Task.FromResult(new DashboardPersonalization());

        public Task SavePersonalizationAsync(DashboardPersonalization personalization)
        {
            Saved.Add("personalization");
            return Task.CompletedTask;
        }
    }
}
