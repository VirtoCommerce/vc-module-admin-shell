using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.AdminShell.Web.Controllers.Api;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

/// <summary>Dashboard widgets per role: which widgets a user's dashboard leaves out, and saving a role's list</summary>
public class DashboardTests
{
    private static RoleDashboard Role(params string[] hidden) => new() { HiddenWidgets = [.. hidden] };

    [Fact]
    public void Compose_OneRole_HidesItsWidgets()
    {
        var result = DashboardComposer.Compose([Role("shell-alerts")], isAdministrator: false);

        Assert.Equal(["shell-alerts"], result.HiddenWidgets);
    }

    [Fact]
    public void Compose_TwoRoles_HidesOnlyWhatBothHide()
    {
        // a role that shows a widget keeps it for the user, as a role that shows a menu item keeps it
        var result = DashboardComposer.Compose(
            [Role("shell-alerts", "shell-activity"), Role("shell-alerts")],
            isAdministrator: false);

        Assert.Equal(["shell-alerts"], result.HiddenWidgets);
    }

    [Fact]
    public void Compose_RoleWithoutSetting_ShowsEverything()
    {
        var result = DashboardComposer.Compose([Role("shell-alerts"), new RoleDashboard()], isAdministrator: false);

        Assert.Empty(result.HiddenWidgets);
    }

    [Fact]
    public void Compose_Administrator_SeesEveryWidget()
    {
        var result = DashboardComposer.Compose([Role("shell-alerts")], isAdministrator: true);

        Assert.Empty(result.HiddenWidgets);
    }

    [Fact]
    public void Compose_NoRoles_ShowsEverything()
    {
        Assert.Empty(DashboardComposer.Compose([], isAdministrator: false).HiddenWidgets);
        Assert.Empty(DashboardComposer.Compose(null, isAdministrator: false).HiddenWidgets);
    }

    [Fact]
    public void Compose_NullListInARole_ReadsAsEmpty()
    {
        var result = DashboardComposer.Compose([new RoleDashboard { HiddenWidgets = null }], isAdministrator: false);

        Assert.Empty(result.HiddenWidgets);
    }

    [Fact]
    public void Normalize_TrimsAndDropsBlanksAndRepeats()
    {
        var result = DashboardComposer.Normalize([" shell-alerts ", "", null, "shell-alerts", "saas-app-metrics"]);

        Assert.Equal(["shell-alerts", "saas-app-metrics"], result);
    }

    [Fact]
    public async Task SaveRole_WithoutBody_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();

        var result = await controller.SaveRole("role-1", null);

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveRole_BodyOfTheWrongShape_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();
        controller.ModelState.AddModelError("hiddenWidgets", "Cannot deserialize the current JSON object into a list.");

        var result = await controller.SaveRole("role-1", new RoleDashboard());

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveRole_ValidBody_SavesForTheRole()
    {
        var (controller, service) = Create();
        var dashboard = Role("shell-alerts");

        var result = await controller.SaveRole("role-1", dashboard);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(["role-1"], service.Saved);
        Assert.Same(dashboard, service.LastValue);
    }

    private static void AssertBadRequest(ActionResult result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status400BadRequest, objectResult.StatusCode ?? StatusCodes.Status400BadRequest);
        Assert.IsType<ValidationProblemDetails>(objectResult.Value);
    }

    private static (AdminShellDashboardController Controller, RecordingDashboardService Service) Create()
    {
        var service = new RecordingDashboardService();
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

    private sealed class RecordingDashboardService : IAdminDashboardService
    {
        public List<string> Saved { get; } = [];

        public object LastValue { get; private set; }

        public Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal) => Task.FromResult(new EffectiveDashboard());

        public Task<RoleDashboard> GetRoleDashboardAsync(string roleId) => Task.FromResult(new RoleDashboard());

        public Task SaveRoleDashboardAsync(string roleId, RoleDashboard dashboard)
        {
            Saved.Add(roleId);
            LastValue = dashboard;
            return Task.CompletedTask;
        }
    }
}
