using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using VirtoCommerce.AdminShell.Core;
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

    /* ---- Recent ---- */

    private static readonly DateTime Now = new(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);
    private const double HalfLife = 7;

    private static List<RecentUse> Use(IList<RecentUse> uses, string id, DateTime at) =>
        MenuComposer.RecordUse(uses, id, at, HalfLife, 30);

    private static List<string> Ranked(IList<RecentUse> uses, DateTime at) =>
        MenuComposer.RankRecent(uses, at, HalfLife).Select(x => x.Id).ToList();

    [Fact]
    public void Recent_ranks_by_use_so_a_one_off_page_does_not_jump_to_the_top()
    {
        List<RecentUse> uses = [];
        for (var day = -5; day < 0; day++)
        {
            uses = Use(uses, "vue.orders", Now.AddDays(day));
            uses = Use(uses, "legacy.catalog", Now.AddDays(day).AddHours(1));
        }

        uses = Use(uses, "legacy.pricing", Now); // opened once, just now

        Assert.Equal(["legacy.catalog", "vue.orders", "legacy.pricing"], Ranked(uses, Now));
    }

    [Fact]
    public void Recent_lets_pages_no_longer_used_fade_out()
    {
        var uses = Use([], "legacy.catalog", Now.AddDays(-60));
        uses = Use(uses, "legacy.catalog", Now.AddDays(-59));
        uses = Use(uses, "legacy.catalog", Now.AddDays(-58)); // used a lot, two months ago
        uses = Use(uses, "vue.orders", Now.AddDays(-1)); // used once, yesterday

        Assert.Equal(["vue.orders", "legacy.catalog"], Ranked(uses, Now));
    }

    [Fact]
    public void Recent_breaks_ties_by_the_last_use_and_keeps_a_bounded_list()
    {
        var uses = MenuComposer.RecordUse([], "a", Now.AddMinutes(-2), HalfLife, 2);
        uses = MenuComposer.RecordUse(uses, "b", Now.AddMinutes(-1), HalfLife, 2);
        uses = MenuComposer.RecordUse(uses, "c", Now, HalfLife, 2);

        Assert.Equal(["c", "b"], uses.Select(x => x.Id));
    }

    [Fact]
    public void Recent_reads_the_first_version_that_stored_only_ids()
    {
        var uses = MenuComposer.ReadRecent("[\"legacy.catalog\",\"vue.orders\"]", Now);
        Assert.Equal(["legacy.catalog", "vue.orders"], Ranked(uses, Now));

        var roundTrip = MenuComposer.ReadRecent(JsonConvert.SerializeObject(Use(uses, "vue.orders", Now)), Now);
        Assert.Equal(["vue.orders", "legacy.catalog"], Ranked(roundTrip, Now));
        Assert.Empty(MenuComposer.ReadRecent(null, Now));
    }

    [Fact]
    public void Recent_skips_malformed_entries()
    {
        var uses = MenuComposer.ReadRecent("[1, [\"x\"], null, \"vue.orders\", {\"id\":\"y\",\"score\":\"abc\"}]", Now);
        Assert.Equal(["vue.orders"], Ranked(uses, Now));
        Assert.Empty(MenuComposer.ReadRecent("[{\"id\":\"x\",\"score\":1", Now)); // half-written
    }

    [Fact]
    public void Recent_skips_pinned_items_and_items_the_user_cannot_see()
    {
        var menu = MenuComposer.Compose(
            Default(), null, null, new UserMenuPrefs { Pinned = ["vue.orders"] }, p => p != "pricing:access",
            ["legacy.catalog", "vue.orders", "legacy.pricing", "legacy.orders"]);

        // vue.orders is pinned, legacy.pricing needs a permission, legacy.orders is replaced by vue.orders
        Assert.Equal(["legacy.catalog"], menu.Recent.Select(x => x.Id));
    }

    /* ---- a Vue screen replacing an AngularJS one ---- */

    // configuration holds the AngularJS Units of measure; the module's Vue screen is contributed elsewhere
    private static MenuDocument WithVueMeasures(string group = null) => new()
    {
        Sections =
        [
            new MenuSection
            {
                Id = "configuration", Title = "Settings", Priority = 90,
                Items = [Item("legacy.stores", 10), Item("legacy.measures", 56)],
                Groups =
                [
                    new MenuGroup { Title = "Store", Items = ["legacy.stores"] },
                    new MenuGroup { Title = "Catalog & search", Items = ["legacy.measures"] },
                ],
            },
            new MenuSection
            {
                Id = "catalog", Title = "Products", Priority = 10,
                Items =
                [
                    Item("legacy.catalog", 10),
                    new MenuItem
                    {
                        Id = "measures", Title = "Units of measure", Priority = 40, Replaces = "legacy.measures", Group = group,
                        Target = new MenuTarget { Type = MenuTargetTypes.Vue, Route = "/measures" },
                    },
                ],
            },
        ],
    };

    [Fact]
    public void A_Vue_screen_takes_the_place_and_group_of_the_AngularJS_one_it_replaces()
    {
        var menu = MenuComposer.Compose(WithVueMeasures(), null, null, null, _ => true);

        Assert.Equal(["legacy.stores", "measures"], Ids(menu, "configuration"));
        Assert.Equal(["legacy.catalog"], Ids(menu, "catalog"));
        var measures = menu.Sections.Single(x => x.Id == "configuration").Items.Single(x => x.Id == "measures");
        Assert.Equal(56, measures.Priority);
        Assert.Equal("Catalog & search", measures.Group);
    }

    [Fact]
    public void A_contributions_own_group_wins()
    {
        var menu = MenuComposer.Compose(WithVueMeasures(group: "Store"), null, null, null, _ => true);

        Assert.Equal("Store", menu.Sections.Single(x => x.Id == "configuration").Items.Single(x => x.Id == "measures").Group);
    }

    [Fact]
    public void Pins_hides_order_patches_and_Recent_on_the_AngularJS_id_follow_the_Vue_screen()
    {
        var prefs = new UserMenuPrefs { Pinned = ["legacy.measures"], Order = new() { ["configuration"] = ["legacy.measures", "legacy.stores"] } };
        var global = new MenuPatch { Items = new() { ["legacy.measures"] = new ItemPatch { Title = "Measures" } } };

        var menu = MenuComposer.Compose(WithVueMeasures(), global, null, prefs, _ => true, ["legacy.measures", "legacy.catalog"]);

        Assert.Equal(["measures"], menu.Pinned.Select(x => x.Id));
        Assert.Equal(["measures", "legacy.stores"], Ids(menu, "configuration"));
        Assert.Equal("Measures", menu.Pinned.Single().Title);
        Assert.Equal(["legacy.catalog"], menu.Recent.Select(x => x.Id)); // the use moved to measures, which is pinned

        var hidden = MenuComposer.Compose(WithVueMeasures(), null, null, new UserMenuPrefs { Hidden = ["legacy.measures"] }, _ => true);
        Assert.Equal(["legacy.stores"], Ids(hidden, "configuration"));
        Assert.Equal(["measures"], hidden.Hidden);
    }

    [Fact]
    public void Prefs_for_editing_carry_the_ids_the_menu_shows()
    {
        var prefs = MenuComposer.WithCurrentIds(WithVueMeasures(), new UserMenuPrefs { Pinned = ["legacy.measures", "legacy.catalog"], Hidden = ["legacy.measures"] });

        // unpinning "measures" now finds it in the prefs it edits
        Assert.Equal(["measures", "legacy.catalog"], prefs.Pinned);
        Assert.Equal(["measures"], prefs.Hidden);
    }

    [Fact]
    public void An_item_a_patch_moves_takes_the_group_its_new_section_gives_it()
    {
        var global = new MenuPatch { Items = new() { ["legacy.catalog"] = new ItemPatch { SectionId = "configuration" } } };

        var menu = MenuComposer.Compose(WithVueMeasures(), global, null, null, _ => true);

        var items = menu.Sections.Single(x => x.Id == "configuration").Items;
        Assert.Null(items.Single(x => x.Id == "legacy.catalog").Group); // configuration's groups don't list it: untitled
        Assert.Equal("Store", items.Single(x => x.Id == "legacy.stores").Group);
    }

    [Fact]
    public void Recent_skips_the_pages_Home_lists_itself()
    {
        var defaultMenu = Default();
        defaultMenu.Sections.Add(new MenuSection { Id = ModuleConstants.HomeSectionId, Title = "Home", Items = [Item("home", 0, null)] });

        var menu = MenuComposer.Compose(defaultMenu, null, null, null, _ => true, ["home", "legacy.catalog"]);

        Assert.Equal(["legacy.catalog"], menu.Recent.Select(x => x.Id));
    }
}
