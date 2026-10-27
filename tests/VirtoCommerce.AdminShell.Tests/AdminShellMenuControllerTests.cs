using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.AdminShell.Web.Controllers.Api;
using VirtoCommerce.Platform.Core.Security;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

/// <summary>
/// The menu layers' PUT endpoints: a body that didn't bind (none, broken JSON, the wrong shape) reaches the action as null
/// with a model state error. It must be refused with 400 and save nothing, never replace the stored layer with an empty one.
/// </summary>
public class AdminShellMenuControllerTests
{
    private const string UserId = "user-1";

    [Fact]
    public async Task SaveGlobal_WithoutBody_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();

        var result = await controller.SaveGlobal(null);

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveGlobal_BodyOfTheWrongShape_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();
        controller.ModelState.AddModelError("items", "Cannot deserialize the current JSON array into a dictionary.");

        var result = await controller.SaveGlobal(null);

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveGlobal_EmptyObject_ClearsTheLayer()
    {
        var (controller, service) = Create();
        var patch = new MenuPatch();

        var result = await controller.SaveGlobal(patch);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(["global"], service.Saved);
        Assert.Same(patch, service.LastValue);
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
    public async Task SaveRole_WithPatch_SavesTheRoleLayer()
    {
        var (controller, service) = Create();

        var result = await controller.SaveRole("role-1", new MenuPatch());

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(["role:role-1"], service.Saved);
    }

    [Fact]
    public async Task SaveMyPrefs_BodyOfTheWrongShape_Returns400AndKeepsThePrefs()
    {
        var (controller, service) = Create();
        controller.ModelState.AddModelError("pinned", "Error converting value \"not-a-list\" to type 'List`1'.");

        var result = await controller.SaveMyPrefs(null);

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    [Fact]
    public async Task SaveMyPrefs_WithPrefs_SavesThemForTheUser()
    {
        var (controller, service) = Create();
        var prefs = new UserMenuPrefs { Pinned = ["catalog"] };

        var result = await controller.SaveMyPrefs(prefs);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal([$"user:{UserId}"], service.Saved);
        Assert.Same(prefs, service.LastValue);
    }

    [Fact]
    public async Task SavePersonalization_WithoutBody_Returns400AndSavesNothing()
    {
        var (controller, service) = Create();

        var result = await controller.SavePersonalization(null);

        AssertBadRequest(result);
        Assert.Empty(service.Saved);
    }

    private static void AssertBadRequest(ActionResult result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status400BadRequest, objectResult.StatusCode ?? StatusCodes.Status400BadRequest);
        Assert.IsType<ValidationProblemDetails>(objectResult.Value);
    }

    private static (AdminShellMenuController Controller, RecordingMenuService Service) Create()
    {
        var service = new RecordingMenuService();
        // the platform names the user id claims at startup; outside it, User.GetUserId() needs them named
        if (ClaimsPrincipalExtensions.UserIdClaimTypes is not { Length: > 0 })
        {
            ClaimsPrincipalExtensions.UserIdClaimTypes = [ClaimTypes.NameIdentifier];
        }
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, UserId)], "test"));
        var controller = new AdminShellMenuController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
            // ValidationProblem() reads the problem-details options through the services
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

    /// <summary>Records which layer each save would write; the reads are not used here</summary>
    private sealed class RecordingMenuService : IAdminMenuService
    {
        public List<string> Saved { get; } = [];

        public object LastValue { get; private set; }

        public Task SaveGlobalPatchAsync(MenuPatch patch) => Record("global", patch);

        public Task SaveRolePatchAsync(string roleId, MenuPatch patch) => Record($"role:{roleId}", patch);

        public Task SaveUserPrefsAsync(string userId, UserMenuPrefs prefs) => Record($"user:{userId}", prefs);

        public Task SavePersonalizationAsync(MenuPersonalization personalization) => Record("personalization", personalization);

        private Task Record(string layer, object value)
        {
            Saved.Add(layer);
            LastValue = value;
            return Task.CompletedTask;
        }

        public MenuDocument GetDefaultMenu(IEnumerable<MenuItem> discovered = null) => new();

        public Task<MenuDocument> GetEditorMenuAsync(MenuEditorRequest request) => Task.FromResult(new MenuDocument());

        public Task<EffectiveMenu> GetEffectiveMenuAsync(ClaimsPrincipal principal, IEnumerable<MenuItem> discovered = null) =>
            Task.FromResult(new EffectiveMenu());

        public Task<MenuPersonalization> GetPersonalizationAsync() => Task.FromResult(new MenuPersonalization());

        public Task AddRecentAsync(string userId, string itemId) => Task.CompletedTask;

        public Task<MenuPatch> GetGlobalPatchAsync() => Task.FromResult(new MenuPatch());

        public Task<MenuPatch> GetRolePatchAsync(string roleId) => Task.FromResult(new MenuPatch());

        public Task<UserMenuPrefs> GetUserPrefsAsync(string userId) => Task.FromResult(new UserMenuPrefs());

        public Task<UserMenuPrefs> GetUserPrefsForEditAsync(string userId) => Task.FromResult(new UserMenuPrefs());
    }
}
