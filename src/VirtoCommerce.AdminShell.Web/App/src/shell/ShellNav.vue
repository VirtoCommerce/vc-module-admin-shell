<template>
  <!-- Navigation of the new design (concept D): an icon rail of sections and the open section's panel -->
  <div
    ref="navRef"
    class="as-nav"
    :class="{ 'as-nav--drawer': drawer }"
  >
    <nav
      class="as-rail"
      :aria-label="$t('SHELL.NAV.SECTIONS')"
    >
      <button
        type="button"
        class="as-rail__logo"
        :aria-label="$t('SHELL.NAV.HOME', { name: companyName })"
        :title="$t('SHELL.NAV.HOME', { name: companyName })"
        @click="goHome"
      >
        <img
          :src="brandMark() ?? logoMark"
          alt=""
        />
      </button>
      <button
        v-for="section in menu.sections"
        :key="section.id"
        type="button"
        class="as-rail__item"
        :class="{ 'as-rail__item--active': section.id === shown?.id }"
        :aria-pressed="section.id === shown?.id && panelVisible"
        :title="section.title"
        @click="pickSection(section.id)"
      >
        <VcIcon
          class="as-rail__icon"
          :icon="section.icon || 'lucide-circle'"
        />
        <span class="as-rail__label">{{ railLabel(section) }}</span>
        <span
          v-if="sectionCount(section)"
          class="as-badge as-rail__badge"
          >{{ formatBadgeCount(sectionCount(section)) }}</span
        >
      </button>
      <span class="as-rail__spacer" />
      <button
        ref="bellRef"
        type="button"
        class="as-rail__button"
        :aria-label="$t('SHELL.NAV.NOTIFICATIONS')"
        :title="$t('SHELL.NAV.NOTIFICATIONS')"
        @click="notificationsOpen = !notificationsOpen"
      >
        <VcIcon icon="lucide-bell" />
        <span
          v-if="notifications.unreadCount.value"
          class="as-badge as-rail__badge as-rail__badge--bell"
          >{{ formatBadgeCount(notifications.unreadCount.value) }}</span
        >
      </button>
      <button
        ref="avatarRef"
        type="button"
        class="as-rail__user"
        :aria-label="$t('SHELL.NAV.ACCOUNT')"
        :title="$t('SHELL.NAV.ACCOUNT')"
        :aria-expanded="userMenuOpen"
        @click="userMenuOpen = !userMenuOpen"
      >
        <img
          :src="avatar"
          alt=""
        />
      </button>
    </nav>
    <VcPopover
      v-model:show="userMenuOpen"
      :anchor-ref="avatarRef"
      placement="right-end"
      :width="drawer ? '300px' : '320px'"
      :max-height="640"
      content-scrollable
    >
      <UserMenu
        :avatar="avatar"
        @close="userMenuOpen = false"
      />
    </VcPopover>
    <VcPopover
      v-model:show="notificationsOpen"
      :anchor-ref="bellRef"
      placement="right-end"
      width="320px"
      :content-scrollable="false"
    >
      <NotificationDropdown />
    </VcPopover>

    <!-- folded, a rail button shows its section over the page; the panel stays folded until "keep open" -->
    <aside
      v-if="panelVisible && shown"
      class="as-panel"
      :class="{ 'as-panel--flyout': isFlyout }"
      :aria-label="shown.title"
    >
      <!-- Home carries the logo; every other section its title (as in Buyer24) -->
      <div
        class="as-panel__top"
        :class="{ 'as-panel__top--logo': isHome }"
      >
        <button
          v-if="isHome"
          type="button"
          class="as-panel__logo"
          :aria-label="$t('SHELL.NAV.HOME', { name: companyName })"
          :title="$t('SHELL.NAV.HOME', { name: companyName })"
          @click="goHome"
        >
          <img
            :src="logoImage"
            alt=""
          />
        </button>
        <h2
          v-else
          class="as-panel__title"
        >
          {{ shown.title }}
        </h2>
        <button
          type="button"
          class="as-panel__hide"
          :aria-label="topButton.label"
          :title="topButton.label"
          @click="topButton.action"
        >
          <VcIcon :icon="topButton.icon" />
        </button>
      </div>

      <!-- only the list scrolls; the title row above stays -->
      <div class="as-panel__body">
        <!-- phones have no header: the drawer carries a search box too, which opens the search sheet -->
        <ShellSearch
          v-if="drawer"
          trigger
          @open-sheet="openSearchSheet"
        />
        <!-- a busy section reads as headed groups (each folds), any other as one list; then Pinned, and on Home Recent -->
        <div
          v-for="group in groups"
          :key="group.key"
          class="as-panel__group"
        >
          <button
            v-if="group.title"
            type="button"
            class="as-panel__label as-panel__label--toggle"
            :aria-expanded="!isFolded(group)"
            @click="toggleFolded(group.key)"
          >
            <span>{{ group.title }}</span>
            <VcIcon
              class="as-panel__label-chevron"
              :icon="isFolded(group) ? 'lucide-chevron-right' : 'lucide-chevron-down'"
            />
          </button>
          <template
            v-for="item in isFolded(group) ? [] : group.items"
            :key="item.id"
          >
            <!-- a pinned copy is a shortcut: it names its section, has no pages under it and lights up for any of them -->
            <div
              class="as-item"
              :class="
                group.shortcut
                  ? { 'as-item--pinned': true, 'as-item--active': shortcutActive(item) }
                  : { 'as-item--active': ownActive(item), 'as-item--inside': inside(item) }
              "
            >
              <button
                type="button"
                class="as-item__main"
                :aria-current="!group.shortcut && ownActive(item) ? 'page' : undefined"
                :aria-expanded="pagesOf(group, item).length ? inside(item) : undefined"
                @click="go(item)"
              >
                <span class="as-item__icon">
                  <img
                    v-if="item.iconUrl"
                    :src="item.iconUrl"
                    alt=""
                  />
                  <VcIcon
                    v-else
                    :icon="item.icon || 'lucide-circle'"
                  />
                </span>
                <span class="as-item__label">{{ item.title }}</span>
                <VcIcon
                  v-if="item.target?.type === 'url'"
                  class="as-item__external"
                  icon="lucide-arrow-up-right"
                  :title="$t('SHELL.NAV.NEW_TAB')"
                />
                <span
                  v-if="counterValues[item.id]"
                  class="as-item__count"
                  :title="counterTitle(item.id)"
                  >{{ formatBadgeCount(counterValues[item.id]) }}</span
                >
                <span
                  v-if="group.shortcut"
                  class="as-item__where"
                  >{{ sectionOf.get(item.id) }}</span
                >
                <VcIcon
                  v-if="pagesOf(group, item).length"
                  class="as-item__chevron"
                  :icon="inside(item) ? 'lucide-chevron-down' : 'lucide-chevron-right'"
                />
              </button>
              <span class="as-item__actions">
                <button
                  type="button"
                  class="as-item__action"
                  :title="pinnedIds.has(item.id) ? $t('SHELL.NAV.UNPIN') : $t('SHELL.NAV.PIN')"
                  :aria-label="pinnedIds.has(item.id) ? $t('SHELL.NAV.UNPIN') : $t('SHELL.NAV.PIN')"
                  @click="togglePin(item)"
                >
                  <VcIcon :icon="pinnedIds.has(item.id) ? 'lucide-pin-off' : 'lucide-pin'" />
                </button>
                <button
                  v-if="!group.shortcut"
                  type="button"
                  class="as-item__action"
                  :title="$t('SHELL.NAV.HIDE_ITEM')"
                  :aria-label="$t('SHELL.NAV.HIDE_ITEM')"
                  @click="hide(item)"
                >
                  <VcIcon icon="lucide-eye-off" />
                </button>
              </span>
            </div>
            <!-- an app's own navigation (News' lists) lives here, not in a column inside the app -->
            <div
              v-if="pagesOf(group, item).length && inside(item)"
              class="as-sub"
            >
              <button
                v-for="child in item.children"
                :key="child.id"
                type="button"
                class="as-sub__item"
                :class="{ 'as-sub__item--active': isActive(child) }"
                :aria-current="isActive(child) ? 'page' : undefined"
                @click="go(child)"
              >
                {{ child.title }}
              </button>
            </div>
          </template>
        </div>

        <button
          v-if="menu.hidden.length"
          type="button"
          class="as-panel__restore"
          @click="restoreHidden"
        >
          {{ $t("SHELL.NAV.SHOW_HIDDEN", { count: menu.hidden.length }) }}
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { NotificationDropdown, formatBadgeCount, useNotificationStore, useTheme } from "@vc-shell/framework";
import { VcIcon, VcPopover } from "@vc-shell/framework/ui";
import { onClickOutside, useEventListener } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import type { MenuItem, MenuSection } from "../api/adminMenu";
import { HOME_SECTION_ID, useAdminMenu } from "../composables/useAdminMenu";
import { counterHint, counterValues } from "./menuCounters";
import { foldedGroups, groupItems, panelOpen, panelSection, railLabel, searchSheetOpen, toggleFolded } from "./navState";
import ShellSearch from "./ShellSearch.vue";
import UserMenu from "./UserMenu.vue";
import logoMark from "/assets/logo-mark.svg";
import darkLogo from "/assets/logo-shell-dark.svg";
import lightLogo from "/assets/logo-shell.svg";
import { brandLogo, brandMark, companyName } from "./branding";

const props = defineProps<{
  /** inside the phone drawer: the panel is always shown and its button closes the drawer */
  drawer?: boolean;
  avatar?: string;
}>();

const emit = defineEmits<{ (e: "navigate"): void; (e: "close"): void }>();

const { menu, open, isActive, active, togglePin, hide, restoreHidden, pinnedIds } = useAdminMenu();
const router = useRouter();
const route = useRoute();
const { t, te } = useI18n({ useScope: "global" });

// a counter's tooltip: its hint, a translation key or a text, with the count in place of {count}
function counterTitle(itemId: string) {
  const hint = counterHint(itemId);
  const count = counterValues.value[itemId];
  if (!hint) return undefined;
  return te(hint) ? t(hint, { count }) : hint.replace("{count}", String(count));
}
const { currentThemeKey } = useTheme();
// the company's logo (white-labeling), else Virto's: its wordmark is near-black, so dark gets a light copy
const logoImage = computed(() => {
  const dark = currentThemeKey.value === "dark";
  return brandLogo(dark) ?? (dark ? darkLogo : lightLogo);
});
const notifications = useNotificationStore();

const bellRef = ref<HTMLElement | null>(null);
const notificationsOpen = ref(false);
const avatarRef = ref<HTMLElement | null>(null);
const userMenuOpen = ref(false);
// folded panel: the section shown over the page by its rail button, until an item is picked or the user clicks away
const flyout = ref<string | null>(null);
const isFlyout = computed(() => !props.drawer && !panelOpen.value && !!flyout.value);
const navRef = ref<HTMLElement | null>(null);
onClickOutside(navRef, () => (flyout.value = null));
useEventListener(window, "keydown", (event: KeyboardEvent) => event.key === "Escape" && (flyout.value = null));
watch(
  () => route.fullPath,
  () => (flyout.value = null),
);

const panelVisible = computed(() => props.drawer || panelOpen.value || isFlyout.value);

/** an item is inside the open screen when it or one of its pages is open */
const inside = (item: MenuItem) => active.value?.item.id === item.id;
/** highlighted itself only when none of its pages carries the highlight */
const ownActive = (item: MenuItem) => inside(item) && !active.value?.child;
/** a Pinned or Recent shortcut: lit for its item, or for the very page when it is one (News · Drafts) */
const shortcutActive = (item: MenuItem) => inside(item) || isActive(item);

const activeSectionId = computed(() => active.value?.section.id);
// opening a screen brings its section's panel
watch(activeSectionId, (id) => id && (panelSection.value = id), { immediate: true });

const shown = computed(
  () =>
    menu.value.sections.find((s) => s.id === (isFlyout.value ? flyout.value : panelSection.value)) ??
    menu.value.sections[0],
);

/** shortcut: a Pinned or Recent group, whose items are copies of items elsewhere in the menu */
type Group = { key: string; title: string; items: MenuItem[]; shortcut?: boolean };
const groups = computed(() => {
  const list: Group[] = groupItems(shown.value).map((group) => ({ ...group, key: `${shown.value?.id}:${group.title}` }));
  if (menu.value.pinned.length) list.push({ key: ":pinned", title: t("SHELL.NAV.PINNED"), items: menu.value.pinned, shortcut: true });
  // Home also lists the pages used most, below Pinned (the server leaves out pinned items and Home's own)
  if (isHome.value && menu.value.recent.length) {
    list.push({ key: ":recent", title: t("SHELL.NAV.RECENT"), items: menu.value.recent, shortcut: true });
  }
  return list;
});
// a folded group still opens when it holds the screen that's open
const isFolded = (group: Group) => !!foldedGroups.value[group.key] && !group.items.some(inside);
const pagesOf = (group: Group, item: MenuItem) => (group.shortcut ? [] : (item.children ?? []));

// the Home section shows the logo in place of its title
const isHome = computed(() => shown.value?.id === HOME_SECTION_ID);

// the button by the logo or title: close the drawer, unfold the panel for good, or fold it
const topButton = computed(() => {
  if (props.drawer) return { icon: "lucide-x", label: t("COMPONENTS.ORGANISMS.VC_APP.CLOSE_MENU"), action: () => emit("close") };
  if (isFlyout.value) return { icon: "lucide-panel-left-open", label: t("SHELL.NAV.KEEP_OPEN"), action: keepOpen };
  return { icon: "lucide-panel-left-close", label: t("SHELL.NAV.HIDE_MENU"), action: () => (panelOpen.value = false) };
});

function keepOpen() {
  panelSection.value = flyout.value ?? panelSection.value;
  flyout.value = null;
  panelOpen.value = true;
}

const sectionOf = computed(
  () =>
    new Map(
      // pages too: a pinned or recent page (News · Drafts) names its section like any item
      menu.value.sections.flatMap((s) => s.items.flatMap((i) => [i, ...(i.children ?? [])]).map((i) => [i.id, railLabel(s)] as const)),
    ),
);

// a rail button only changes the section shown; folding and unfolding the panel are the user's explicit choice
function pickSection(id: string) {
  if (props.drawer || panelOpen.value) {
    panelSection.value = id;
    return;
  }
  flyout.value = flyout.value === id ? null : id;
}

function go(item: MenuItem) {
  open(item);
  flyout.value = null;
  emit("navigate");
}

// the drawer gives way to the search sheet
function openSearchSheet() {
  emit("close");
  searchSheetOpen.value = true;
}

function goHome() {
  flyout.value = null;
  router.push({ path: "/" });
  emit("navigate");
}

// a section's counter: the sum of its items' counters
const sectionCount = (section: MenuSection) =>
  section.items.reduce((sum, item) => sum + (counterValues.value[item.id] ?? 0), 0);
</script>
