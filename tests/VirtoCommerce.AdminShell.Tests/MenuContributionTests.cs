using System.Linq;
using System.Security.Claims;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

public class MenuContributionTests
{
    private static MenuDocument Menu() => new()
    {
        Sections =
        [
            new MenuSection { Id = "dashboard", Title = "Home", Priority = 100, Items = [Item("dashboard")] },
            new MenuSection { Id = "catalog", Title = "Products", Icon = "lucide-package", Priority = 200, Items = [Item("catalog")] },
        ],
    };

    private static MenuItem Item(string id, string sectionId = null, string permission = null) => new()
    {
        Id = id, Title = id, SectionId = sectionId, Permission = permission,
        Target = new MenuTarget { Type = MenuTargetTypes.Vue, Route = "/" + id },
    };

    private static ClaimsPrincipal User(params string[] permissionClaims) =>
        new(new ClaimsIdentity(
            permissionClaims.Select(x => new Claim(PlatformConstants.Security.Claims.PermissionClaimType, x)),
            "test"));

    [Fact]
    public void A_plugin_section_joins_the_menu_and_shows_once_it_has_items()
    {
        var menu = Menu();
        MenuComposer.AddContributedSections(menu, [new MenuSection { Id = "cloud", Title = "Cloud", Icon = "lucide-cloud", Priority = 150 }]);
        menu.Sections.Single(x => x.Id == "cloud").Items.Add(Item("saas.environments", "cloud"));

        var effective = MenuComposer.Compose(menu, null, [], null, _ => true);

        Assert.Equal(["dashboard", "cloud", "catalog"], effective.Sections.Select(x => x.Id));
        Assert.Equal("lucide-cloud", effective.Sections[1].Icon);
    }

    [Fact]
    public void A_plugin_section_without_items_is_hidden()
    {
        var menu = Menu();
        MenuComposer.AddContributedSections(menu, [new MenuSection { Id = "cloud", Title = "Cloud", Priority = 150 }]);

        var effective = MenuComposer.Compose(menu, null, [], null, _ => true);

        Assert.DoesNotContain(effective.Sections, x => x.Id == "cloud");
    }

    [Fact]
    public void A_plugin_cannot_redefine_a_section_the_menu_has()
    {
        var menu = Menu();
        MenuComposer.AddContributedSections(menu,
        [
            new MenuSection { Id = "CATALOG", Title = "Mine", Icon = "lucide-x", Priority = 1 },
            new MenuSection { Id = "cloud", Title = "Cloud", Priority = 150 },
            new MenuSection { Id = "cloud", Title = "Again", Priority = 1 },
            new MenuSection { Id = " " },
        ]);

        var catalog = menu.Sections.Single(x => x.Id == "catalog");
        Assert.Equal(("Products", "lucide-package", 200), (catalog.Title, catalog.Icon, catalog.Priority));
        Assert.Equal("Cloud", menu.Sections.Single(x => x.Id == "cloud").Title);
        Assert.Equal(3, menu.Sections.Count);
    }

    [Fact]
    public void A_patch_renames_and_hides_a_plugin_section()
    {
        var menu = Menu();
        MenuComposer.AddContributedSections(menu, [new MenuSection { Id = "cloud", Title = "Cloud", Priority = 150 }]);
        menu.Sections.Single(x => x.Id == "cloud").Items.Add(Item("saas.environments", "cloud"));
        var renamed = new MenuPatch { Sections = new() { ["cloud"] = new SectionPatch { Title = "Virto Cloud" } } };
        var hidden = new MenuPatch { Sections = new() { ["cloud"] = new SectionPatch { Hidden = true } } };

        Assert.Equal("Virto Cloud", MenuComposer.Compose(menu, renamed, [], null, _ => true).Sections.Single(x => x.Id == "cloud").Title);
        Assert.DoesNotContain(MenuComposer.Compose(menu, hidden, [], null, _ => true).Sections, x => x.Id == "cloud");
    }

    [Fact]
    public void A_section_permission_hides_it()
    {
        var menu = Menu();
        MenuComposer.AddContributedSections(menu, [new MenuSection { Id = "cloud", Title = "Cloud", Priority = 150, Permission = "saas:env:access" }]);
        menu.Sections.Single(x => x.Id == "cloud").Items.Add(Item("saas.docs", "cloud"));

        var effective = MenuComposer.Compose(menu, null, [], null, x => x != "saas:env:access");

        Assert.DoesNotContain(effective.Sections, x => x.Id == "cloud");
    }

    [Theory]
    [InlineData("customer:read", true)] // global
    [InlineData("customer:read|[{\"type\":\"OrganizationScope\",\"scope\":\"org-1\"}]", true)] // in a scope
    [InlineData("customer:read:extra", false)] // another permission with the same start
    [InlineData("customer:update|[{\"scope\":\"x\"}]", false)]
    public void An_item_shows_for_a_permission_held_globally_or_in_a_scope(string claim, bool expected)
    {
        Assert.Equal(expected, MenuAccess.HasPermission(User(claim), "customer:read"));
    }

    [Fact]
    public void Administrators_hold_every_permission_and_nobody_holds_none()
    {
        var admin = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, PlatformConstants.Security.SystemRoles.Administrator)], "test", ClaimTypes.Name, ClaimTypes.Role));

        Assert.True(MenuAccess.HasPermission(admin, "saas:env:access"));
        Assert.False(MenuAccess.HasPermission(User(), "saas:env:access"));
        Assert.False(MenuAccess.HasPermission(null, "saas:env:access"));
        Assert.False(MenuAccess.HasPermission(User("customer:read"), null));
    }
}
