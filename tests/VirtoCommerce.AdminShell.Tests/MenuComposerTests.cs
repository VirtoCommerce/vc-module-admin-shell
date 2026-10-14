using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

public class MenuComposerTests
{
    private static MenuDocument Default() => new()
    {
        Sections =
        [
            new MenuSection
            {
                Id = "orders", Title = "Orders & Customers", Priority = 20,
                Items =
                [
                    Item("legacy.orders", 10, "order:access"),
                    Item("legacy.customers", 20, "customer:access"),
                    Item("vue.orders", 5, "order:access", replaces: "legacy.orders"),
                ],
            },
            new MenuSection
            {
                Id = "catalog", Title = "Catalog", Priority = 10,
                Items = [Item("legacy.catalog", 10, "catalog:access"), Item("legacy.pricing", 20, "pricing:access")],
            },
        ],
    };

    private static MenuItem Item(string id, int priority, string permission = null, string replaces = null) => new()
    {
        Id = id, Title = id, Priority = priority, Permission = permission, Replaces = replaces,
        Target = new MenuTarget { Type = MenuTargetTypes.Legacy, LegacyUrl = "/workspace/" + id },
    };

    private static EffectiveMenu Compose(
        MenuPatch global = null, IList<MenuPatch> roles = null, UserMenuPrefs user = null,
        System.Func<string, bool> hasPermission = null) =>
        MenuComposer.Compose(Default(), global, roles, user, hasPermission ?? (_ => true));

    private static List<string> Ids(EffectiveMenu menu, string sectionId) =>
        menu.Sections.Single(x => x.Id == sectionId).Items.Select(x => x.Id).ToList();

    [Fact]
    public void Sections_and_items_are_ordered_by_priority_and_replaced_items_are_dropped()
    {
        var menu = Compose();

        Assert.Equal(["catalog", "orders"], menu.Sections.Select(x => x.Id));
        Assert.Equal(["vue.orders", "legacy.customers"], Ids(menu, "orders"));
    }

    [Fact]
    public void Global_patch_hides_renames_and_moves()
    {
        var global = new MenuPatch
        {
            Items =
            {
                ["legacy.pricing"] = new ItemPatch { Hidden = true },
                ["legacy.customers"] = new ItemPatch { Title = "Contacts", SectionId = "catalog", Priority = 1 },
            },
        };

        var menu = Compose(global);

        Assert.Equal(["legacy.customers", "legacy.catalog"], Ids(menu, "catalog"));
        Assert.Equal("Contacts", menu.Sections.Single(x => x.Id == "catalog").Items[0].Title);
        Assert.Equal(["vue.orders"], Ids(menu, "orders"));
    }

    [Fact]
    public void Role_patches_are_a_union_an_item_is_hidden_only_if_every_role_hides_it()
    {
        var clerk = new MenuPatch { Sections = { ["catalog"] = new SectionPatch { Hidden = true } }, Items = { ["legacy.customers"] = new ItemPatch { Hidden = true } } };
        var merchandiser = new MenuPatch { Items = { ["legacy.customers"] = new ItemPatch { Hidden = true } } };

        var both = Compose(roles: [clerk, merchandiser]);
        Assert.Contains(both.Sections, x => x.Id == "catalog"); // merchandiser keeps catalog
        Assert.DoesNotContain("legacy.customers", Ids(both, "orders")); // both hide it

        var clerkOnly = Compose(roles: [clerk]);
        Assert.DoesNotContain(clerkOnly.Sections, x => x.Id == "catalog");

        // a role without a patch (an empty one) hides nothing, so it keeps what the other role hides
        var clerkAndManager = Compose(roles: [clerk, new MenuPatch()]);
        Assert.Contains(clerkAndManager.Sections, x => x.Id == "catalog");
        Assert.Contains("legacy.customers", Ids(clerkAndManager, "orders"));
    }

    [Fact]
    public void Patches_with_json_nulls_are_tolerated()
    {
        var nulls = JsonConvert.DeserializeObject<MenuPatch>(
            "{\"sections\":{\"catalog\":null},\"items\":{\"legacy.pricing\":null},\"addSections\":[null],\"addItems\":[null]}");
        var empty = JsonConvert.DeserializeObject<MenuPatch>("{\"sections\":null,\"items\":null,\"addSections\":null,\"addItems\":null}");

        var menu = Compose(global: nulls, roles: [empty, nulls]);

        Assert.Equal(["legacy.catalog", "legacy.pricing"], Ids(menu, "catalog"));
        Assert.Equal(["vue.orders", "legacy.customers"], Ids(menu, "orders"));
    }

    [Fact]
    public void Global_patch_hides_and_renames_child_items()
    {
        var news = new MenuItem
        {
            Id = "news", Title = "News",
            Children = [Item("news.all", 10), Item("news.drafts", 20)],
        };
        var single = new MenuItem { Id = "single", Title = "Single", Children = [Item("single.only", 10)] };
        var defaultMenu = new MenuDocument { Sections = [new MenuSection { Id = "content", Title = "Content", Items = [news, single] }] };
        var global = new MenuPatch
        {
            Items =
            {
                ["news.drafts"] = new ItemPatch { Hidden = true },
                ["news.all"] = new ItemPatch { Title = "All news" },
                ["single.only"] = new ItemPatch { Hidden = true },
            },
        };

        var menu = MenuComposer.Compose(defaultMenu, global, [], null, _ => true);

        var items = menu.Sections.Single().Items;
        Assert.Equal(["news"], items.Select(x => x.Id)); // the container left empty is gone
        Assert.Equal(["All news"], items[0].Children.Select(x => x.Title));
    }

    [Fact]
    public void User_prefs_hide_order_and_pin()
    {
        var user = new UserMenuPrefs
        {
            Hidden = ["legacy.customers"],
            Pinned = ["legacy.pricing", "missing"],
            Order = { ["catalog"] = ["legacy.pricing"] },
        };

        var menu = Compose(user: user);

        Assert.Equal(["vue.orders"], Ids(menu, "orders"));
        Assert.Equal(["legacy.pricing", "legacy.catalog"], Ids(menu, "catalog"));
        Assert.Equal(["legacy.pricing"], menu.Pinned.Select(x => x.Id));
    }

    [Fact]
    public void Permissions_filter_items_and_drop_empty_sections()
    {
        var menu = Compose(user: new UserMenuPrefs { Pinned = ["legacy.pricing", "vue.orders"] }, hasPermission: p => p == "order:access");

        Assert.Equal(["orders"], menu.Sections.Select(x => x.Id));
        Assert.Equal(["vue.orders"], Ids(menu, "orders"));
        Assert.Equal(["vue.orders"], menu.Pinned.Select(x => x.Id)); // a pinned item the user can't see is dropped
    }
}
