<template>
  <VcBlade
    :title="$t('PLATFORM.MENU_EDITOR.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="dirty"
    :width="jsonOpen ? '50%' : '100%'"
  >
    <div class="menu-editor">
      <nav
        class="menu-editor__tabs"
        role="tablist"
      >
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          role="tab"
          class="menu-editor__tab"
          :class="{ 'menu-editor__tab--active': tab === item.id }"
          :aria-selected="tab === item.id"
          @click="tab = item.id"
        >
          {{ item.title }}
        </button>
        <span
          v-if="dirty"
          class="menu-editor__unsaved"
          >{{ $t("PLATFORM.MENU_EDITOR.UNSAVED") }}</span
        >
      </nav>

      <!-- ---- Menu: the Virto Commerce menu with the SI's changes (the global patch) ---- -->
      <div
        v-if="tab === 'menu'"
        class="menu-editor__body"
      >
        <p class="platform-note">{{ $t("PLATFORM.MENU_EDITOR.INTRO") }}</p>
        <p
          v-if="loadError"
          class="menu-editor__error"
        >
          {{ $t("PLATFORM.MENU_EDITOR.LOAD_FAILED", { error: loadError }) }}
        </p>

        <div class="menu-editor__adders">
          <button
            type="button"
            class="menu-editor__button"
            :class="{ 'menu-editor__button--pressed': adding }"
            :aria-pressed="adding"
            aria-controls="menu-editor-add-form"
            @click="adding ? closeAdder() : openAdder()"
          >
            <VcIcon
              icon="lucide-folder-plus"
              size="s"
            />{{ $t("PLATFORM.MENU_EDITOR.ADD_SECTION") }}
          </button>
          <span class="platform-note">{{ $t("PLATFORM.MENU_EDITOR.DRAG_HINT") }}</span>
        </div>
        <form
          v-if="adding"
          id="menu-editor-add-form"
          class="menu-editor__form"
          :aria-label="$t('PLATFORM.MENU_EDITOR.SECTION.HEADING')"
          @submit.prevent="addSection"
          @keydown.esc="closeAdder"
        >
          <header class="menu-editor__form-head">
            <strong>{{ $t("PLATFORM.MENU_EDITOR.SECTION.HEADING") }}</strong>
            <button
              type="button"
              class="menu-editor__icon"
              :title="$t('PLATFORM.MENU_EDITOR.CLOSE')"
              :aria-label="$t('PLATFORM.MENU_EDITOR.CLOSE')"
              @click="closeAdder"
            >
              <VcIcon
                icon="lucide-x"
                size="s"
              />
            </button>
          </header>
          <label class="menu-editor__field">
            <span>{{ $t("PLATFORM.MENU_EDITOR.SECTION.TITLE") }}</span>
            <input
              id="menu-editor-section-title"
              ref="firstField"
              v-model="newTitle"
              required
            />
          </label>
          <div class="menu-editor__field menu-editor__field--actions">
            <span aria-hidden="true">&nbsp;</span>
            <span class="menu-editor__form-actions">
              <button
                type="submit"
                class="menu-editor__button menu-editor__button--primary"
              >
                {{ $t("PLATFORM.MENU_EDITOR.SECTION.ADD") }}
              </button>
              <button
                type="button"
                class="menu-editor__button"
                @click="closeAdder"
              >
                {{ $t("PLATFORM.MENU_EDITOR.CANCEL") }}
              </button>
            </span>
          </div>
        </form>

        <!-- sections and their items are dragged (mouse, or a short press on touch); the grips also move them with the
             arrow keys. A drop moves the elements in place; they are rendered again once the server's preview is back. -->
        <div
          :key="renderKey"
          ref="sectionsEl"
          class="menu-editor__sections"
          :class="{ 'menu-editor__sections--dragging': dragging }"
        >
          <section
            v-for="(section, sectionIndex) in shown.sections"
            :key="section.id"
            class="menu-editor__section"
            :class="{ 'menu-editor__section--hidden': section.hidden }"
            :data-section="section.id"
          >
            <header class="menu-editor__row menu-editor__row--section">
              <span class="menu-editor__name">
                <button
                  type="button"
                  class="menu-editor__grip"
                  :data-grip="`section:${section.id}`"
                  :title="$t('PLATFORM.MENU_EDITOR.ACTIONS.DRAG')"
                  :aria-label="`${$t('PLATFORM.MENU_EDITOR.ACTIONS.DRAG')}: ${section.title}`"
                  @keydown.up.prevent="moveSection(sectionIndex, -1)"
                  @keydown.down.prevent="moveSection(sectionIndex, 1)"
                >
                  <VcIcon
                    icon="lucide-grip-vertical"
                    size="s"
                  />
                </button>
                <VcIcon :icon="section.icon || 'lucide-circle'" />
                <strong>{{ section.title }}</strong>
                <span
                  v-for="badge in sectionBadges(section)"
                  :key="badge.id"
                  class="menu-editor__badge"
                  :class="`menu-editor__badge--${badge.id}`"
                  >{{ badge.title }}</span
                >
              </span>
              <span class="menu-editor__actions">
                <button
                  v-for="action in sectionActions(section)"
                  :key="action.id"
                  type="button"
                  class="menu-editor__icon"
                  :title="action.title"
                  :aria-label="`${action.title}: ${section.title}`"
                  @click="action.run()"
                >
                  <VcIcon
                    :icon="action.icon"
                    size="s"
                  />
                </button>
              </span>
            </header>
            <RenameForm
              v-if="renaming?.kind === 'section' && renaming.id === section.id"
              :language="languageName"
              :english="locale !== 'en'"
              :value="renaming.value"
              :english-value="renaming.english"
              @apply="applyRename"
              @cancel="renaming = null"
            />
            <p
              v-if="section.id === MORE && section.items.some((x) => x.source === 'discovered')"
              class="platform-note menu-editor__more"
            >
              {{ $t("PLATFORM.MENU_EDITOR.MORE_NOTE") }}
            </p>

            <template
              v-for="list in listsOf(section)"
              :key="`${section.id}:${list.value}`"
            >
              <h4
                v-if="list.label"
                class="menu-editor__group"
              >
                {{ list.label }}
              </h4>
              <div
                class="menu-editor__list"
                :class="{
                  'menu-editor__list--empty': !list.items.length,
                  'menu-editor__list--rest': !list.value && listsOf(section).length > 1,
                }"
                :data-section="section.id"
                :data-group="list.value"
                :data-empty="
                  list.value || listsOf(section).length === 1
                    ? $t('PLATFORM.MENU_EDITOR.DROP_HERE')
                    : $t('PLATFORM.MENU_EDITOR.DROP_NO_GROUP')
                "
              >
                <div
                  v-for="item in list.items"
                  :key="item.id"
                  class="menu-editor__entry"
                  :data-id="item.id"
                >
                  <div
                    class="menu-editor__row menu-editor__row--item"
                    :class="{ 'menu-editor__row--hidden': item.hidden }"
                  >
                    <span class="menu-editor__name">
                      <button
                        type="button"
                        class="menu-editor__grip"
                        :data-grip="`item:${item.id}`"
                        :title="$t('PLATFORM.MENU_EDITOR.ACTIONS.DRAG')"
                        :aria-label="`${$t('PLATFORM.MENU_EDITOR.ACTIONS.DRAG')}: ${item.title}`"
                        @keydown.up.prevent="stepItem(item.id, -1)"
                        @keydown.down.prevent="stepItem(item.id, 1)"
                      >
                        <VcIcon
                          icon="lucide-grip-vertical"
                          size="s"
                        />
                      </button>
                      <VcIcon :icon="item.icon || 'lucide-circle'" />
                      <span>{{ item.title }}</span>
                      <VcIcon
                        v-if="item.target?.type === 'url'"
                        icon="lucide-arrow-up-right"
                        size="xs"
                      />
                      <span
                        v-for="badge in itemBadges(item)"
                        :key="badge.id"
                        class="menu-editor__badge"
                        :class="`menu-editor__badge--${badge.id}`"
                        >{{ badge.title }}</span
                      >
                    </span>
                    <span class="menu-editor__actions">
                      <button
                        v-for="action in itemActions(item)"
                        :key="action.id"
                        type="button"
                        class="menu-editor__icon"
                        :title="action.title"
                        :aria-label="`${action.title}: ${item.title}`"
                        @click="action.run()"
                      >
                        <VcIcon
                          :icon="action.icon"
                          size="s"
                        />
                      </button>
                    </span>
                  </div>
                  <RenameForm
                    v-if="renaming?.kind === 'item' && renaming.id === item.id"
                    :language="languageName"
                    :english="locale !== 'en'"
                    :value="renaming.value"
                    :english-value="renaming.english"
                    @apply="applyRename"
                    @cancel="renaming = null"
                  />
                  <template
                    v-for="child in item.children"
                    :key="child.id"
                  >
                    <div
                      class="menu-editor__row menu-editor__row--child"
                      :class="{ 'menu-editor__row--hidden': hiddenInPatch(child.id) }"
                    >
                      <span class="menu-editor__name">
                        <span>{{ child.title }}</span>
                        <span
                          v-for="badge in itemBadges(child)"
                          :key="badge.id"
                          class="menu-editor__badge"
                          :class="`menu-editor__badge--${badge.id}`"
                          >{{ badge.title }}</span
                        >
                      </span>
                      <span class="menu-editor__actions">
                        <button
                          v-for="action in childActions(child)"
                          :key="action.id"
                          type="button"
                          class="menu-editor__icon"
                          :title="action.title"
                          :aria-label="`${action.title}: ${child.title}`"
                          @click="action.run()"
                        >
                          <VcIcon
                            :icon="action.icon"
                            size="s"
                          />
                        </button>
                      </span>
                    </div>
                    <RenameForm
                      v-if="renaming?.kind === 'item' && renaming.id === child.id"
                      :language="languageName"
                      :english="locale !== 'en'"
                      :value="renaming.value"
                      :english-value="renaming.english"
                      @apply="applyRename"
                      @cancel="renaming = null"
                    />
                  </template>
                </div>
              </div>
            </template>

            <!-- a link is added where it goes: at the end of its section -->
            <form
              v-if="linkSection === section.id"
              class="menu-editor__form menu-editor__form--inline"
              :aria-label="`${$t('PLATFORM.MENU_EDITOR.LINK.HEADING')}: ${section.title}`"
              @submit.prevent="addLink(section.id)"
              @keydown.esc="closeLink"
            >
              <label class="menu-editor__field">
                <span>{{ $t("PLATFORM.MENU_EDITOR.LINK.TITLE") }}</span>
                <input
                  :id="`menu-editor-link-title-${section.id}`"
                  v-model="newTitle"
                  required
                />
              </label>
              <label class="menu-editor__field menu-editor__field--wide">
                <span>{{ $t("PLATFORM.MENU_EDITOR.LINK.URL") }}</span>
                <input
                  :id="`menu-editor-link-url-${section.id}`"
                  v-model="newUrl"
                  type="url"
                  required
                  placeholder="https://"
                />
                <small>{{ $t("PLATFORM.MENU_EDITOR.LINK.URL_HINT") }}</small>
              </label>
              <div class="menu-editor__field menu-editor__field--actions">
                <span aria-hidden="true">&nbsp;</span>
                <span class="menu-editor__form-actions">
                  <button
                    type="submit"
                    class="menu-editor__button menu-editor__button--primary"
                  >
                    {{ $t("PLATFORM.MENU_EDITOR.LINK.ADD") }}
                  </button>
                  <button
                    type="button"
                    class="menu-editor__button"
                    @click="closeLink"
                  >
                    {{ $t("PLATFORM.MENU_EDITOR.CANCEL") }}
                  </button>
                </span>
              </div>
            </form>
            <button
              v-else
              type="button"
              class="menu-editor__add-link"
              @click="openLink(section.id)"
            >
              <VcIcon
                icon="lucide-plus"
                size="s"
              />{{ $t("PLATFORM.MENU_EDITOR.ADD_LINK") }}
            </button>
          </section>
        </div>
      </div>

      <!-- ---- Personalization: what users may change ---- -->
      <div
        v-else-if="tab === 'personalization'"
        class="menu-editor__body"
      >
        <p class="platform-note">{{ $t("PLATFORM.MENU_EDITOR.PERSONALIZATION.INTRO") }}</p>
        <label
          v-for="option in personalizationOptions"
          :key="option.key"
          class="menu-editor__check"
        >
          <input
            :id="`menu-editor-${option.key}`"
            v-model="personalization[option.key]"
            type="checkbox"
          />
          <span>{{ option.title }}</span>
        </label>
      </div>

      <!-- ---- AngularJS screens: the classic admin's menu, to add what the menu doesn't have ---- -->
      <div
        v-else
        class="menu-editor__body"
      >
        <p class="platform-note">{{ $t("PLATFORM.MENU_EDITOR.LEGACY.INTRO") }}</p>
        <div class="menu-editor__adders">
          <button
            type="button"
            class="menu-editor__button"
            :disabled="legacyBusy"
            @click="findLegacy"
          >
            <VcIcon
              icon="lucide-search"
              size="s"
            />{{ legacyBusy ? $t("PLATFORM.MENU_EDITOR.LEGACY.FINDING") : $t("PLATFORM.MENU_EDITOR.LEGACY.FIND") }}
          </button>
          <span
            v-if="legacyScreens"
            class="platform-note"
            >{{
              $t("PLATFORM.MENU_EDITOR.LEGACY.SUMMARY", {
                count: legacyScreens.length,
                missing: legacyMissing.length,
              })
            }}</span
          >
        </div>
        <p
          v-if="legacyError"
          class="menu-editor__error"
        >
          {{ $t("PLATFORM.MENU_EDITOR.LEGACY.FAILED", { error: legacyError }) }}
        </p>
        <p
          v-else-if="legacyScreens && !legacyScreens.length"
          class="platform-note"
        >
          {{ $t("PLATFORM.MENU_EDITOR.LEGACY.NONE") }}
        </p>
        <p
          v-else-if="legacyScreens && !legacyMissing.length"
          class="platform-note"
        >
          {{ $t("PLATFORM.MENU_EDITOR.LEGACY.ALL_IN_MENU") }}
        </p>
        <!-- the screens the menu doesn't have; the ones it has show on demand -->
        <div
          v-for="screen in legacyShown"
          :key="screen.state"
          class="menu-editor__row"
        >
          <span class="menu-editor__name">
            <VcIcon icon="lucide-app-window" />
            <span>{{ legacyTitle(screen) }}</span>
            <code class="platform-mono">{{ screen.legacyUrl }}</code>
            <span
              v-if="inMenu(screen)"
              class="menu-editor__badge menu-editor__badge--in-menu"
              >{{ $t("PLATFORM.MENU_EDITOR.LEGACY.IN_MENU") }}</span
            >
          </span>
          <span
            v-if="!inMenu(screen)"
            class="menu-editor__actions"
          >
            <select
              :id="`menu-editor-legacy-${screen.state}`"
              v-model="legacyTargets[screen.state]"
              class="menu-editor__select"
              :aria-label="`${$t('PLATFORM.MENU_EDITOR.LEGACY.ADD_TO')}: ${legacyTitle(screen)}`"
            >
              <option
                v-for="target in legacySections"
                :key="target.id"
                :value="target.id"
              >
                {{ target.title }}
              </option>
            </select>
            <button
              type="button"
              class="menu-editor__button"
              @click="addLegacy(screen)"
            >
              {{ $t("PLATFORM.MENU_EDITOR.LEGACY.ADD") }}
            </button>
          </span>
        </div>
        <button
          v-if="legacyPresent.length"
          type="button"
          class="menu-editor__disclosure"
          :aria-expanded="showPresent"
          @click="showPresent = !showPresent"
        >
          <VcIcon
            :icon="showPresent ? 'lucide-chevron-up' : 'lucide-chevron-down'"
            size="s"
          />{{
            showPresent
              ? $t("PLATFORM.MENU_EDITOR.LEGACY.HIDE_IN_MENU")
              : $t("PLATFORM.MENU_EDITOR.LEGACY.SHOW_IN_MENU", { count: legacyPresent.length })
          }}
        </button>
      </div>
    </div>
  </VcBlade>
</template>

<script setup lang="ts">
import { notification, useBlade, useBladeStack, usePopup, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcIcon } from "@vc-shell/framework/ui";
import SortableJS from "sortablejs";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  adminMenuApi,
  type MenuDocument,
  type MenuItem,
  type MenuPatch,
  type MenuPersonalization,
  type MenuSection,
} from "../../../../api/adminMenu";
import { useAdminMenu } from "../../../../composables/useAdminMenu";
import { useLeaveGuard } from "../../../../shell/leaveGuard";
import { discoverLegacyScreens, type LegacyScreen } from "../../../../shell/legacyDiscovery";
import { loadServerTexts, localizeMenu, menuLocale, titleOfItem } from "../../../../shell/menuTitles";
import { refreshItem } from "../../composables/blade";
import { clean, emptyPatch } from "./patch";
import RenameForm from "./RenameForm.vue";

defineBlade({
  url: "/menu-editor",
  name: "PlatformMenuEditor",
  isWorkspace: true,
  permissions: ["admin-shell:menu:manage"],
});

const MORE = "more";
// the default menu's sections and items are 100 apart, so an entry can go between two
const PRIORITY_STEP = 100;
// after the default menu's sections (Apps is 700)
const MORE_PRIORITY = 800;
// after every item of the default menu
const END_PRIORITY = 100_000;

const { t, getLocaleMessage } = useI18n({ useScope: "global" });
const { showConfirmation } = usePopup();
const { openBlade, exposeToChildren } = useBlade();
const shellMenu = useAdminMenu();

type Tab = "menu" | "personalization" | "legacy";
const tab = ref<Tab>("menu");
const tabs = computed(() => [
  { id: "menu" as Tab, title: t("PLATFORM.MENU_EDITOR.TABS.MENU") },
  { id: "personalization" as Tab, title: t("PLATFORM.MENU_EDITOR.TABS.PERSONALIZATION") },
  { id: "legacy" as Tab, title: t("PLATFORM.MENU_EDITOR.TABS.LEGACY") },
]);

/* ---- the patch being edited and the menu it gives ---- */

const patch = ref<MenuPatch>(emptyPatch());
const storedPatch = ref("");
const doc = ref<MenuDocument>({ sections: [] });
const defaultMenu = ref<MenuDocument>({ sections: [] });
const loading = ref(false);
const loadError = ref("");

const personalization = ref<MenuPersonalization>({ allowPin: true, allowHide: true, allowReorder: true });
const storedPersonalization = ref("");

const dirty = computed(
  () =>
    JSON.stringify(clean(patch.value)) !== storedPatch.value ||
    JSON.stringify(personalization.value) !== storedPersonalization.value,
);

// leaving the editor for another screen, or closing the tab, with changes not saved asks first
useLeaveGuard(dirty, "/menu-editor", () => t("PLATFORM.COMMON.CLOSE_CONFIRMATION"));

// the language the editor renames in: the user's, with English beside it
const locale = computed(() => menuLocale());
const languageName = computed(
  () => (getLocaleMessage(locale.value) as { language_name?: string }).language_name ?? locale.value,
);

/** the editor's menu in the user's language */
const shown = computed(() => localizeMenu(doc.value).menu);

let previewRun = 0;
async function preview() {
  const run = ++previewRun;
  try {
    const next = await adminMenuApi.getEditorMenu(shellMenu.discovered.value, clean(patch.value));
    if (run === previewRun) {
      doc.value = next;
      loadError.value = "";
      afterPreview();
    }
  } catch (error) {
    if (run === previewRun) loadError.value = (error as Error).message;
  }
}
let previewTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  patch,
  () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 150);
  },
  { deep: true },
);

async function load() {
  loading.value = true;
  try {
    const [stored, flags, installed] = await Promise.all([
      adminMenuApi.getGlobalPatch(),
      adminMenuApi.getPersonalization(),
      adminMenuApi.getDefaultMenu(shellMenu.discovered.value),
    ]);
    patch.value = clean({ ...emptyPatch(), ...stored } as MenuPatch);
    storedPatch.value = JSON.stringify(patch.value);
    personalization.value = { allowPin: flags.allowPin, allowHide: flags.allowHide, allowReorder: flags.allowReorder };
    storedPersonalization.value = JSON.stringify(personalization.value);
    defaultMenu.value = installed;
    await preview();
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
}

// opened by a link before the plugins finished loading: the blades found afterwards join More here too
watch(
  () => shellMenu.discovered.value,
  async (discovered) => {
    defaultMenu.value = await adminMenuApi.getDefaultMenu(discovered);
    await preview();
  },
);

async function save() {
  loading.value = true;
  try {
    const cleaned = clean(patch.value);
    if (JSON.stringify(cleaned) !== storedPatch.value) {
      await adminMenuApi.saveGlobalPatch(cleaned);
      storedPatch.value = JSON.stringify(cleaned);
    }
    if (JSON.stringify(personalization.value) !== storedPersonalization.value) {
      await adminMenuApi.savePersonalization(personalization.value);
      storedPersonalization.value = JSON.stringify(personalization.value);
    }
    notification.success(t("PLATFORM.MENU_EDITOR.SAVED"));
    // the menu on the left shows the change at once
    await shellMenu.load();
  } finally {
    loading.value = false;
  }
}

async function undoAll() {
  if (!(await showConfirmation(t("PLATFORM.MENU_EDITOR.UNDO_ALL_CONFIRM")))) return;
  patch.value = emptyPatch();
}

/** Drops the changes made since the last save (or load): the stored menu and personalization show again */
function reset() {
  patch.value = clean({ ...emptyPatch(), ...JSON.parse(storedPatch.value) } as MenuPatch);
  personalization.value = JSON.parse(storedPersonalization.value);
}

const toolbar = computed<IBladeToolbar[]>(() => [
  {
    id: "save",
    title: t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: !dirty.value,
    clickHandler: () => save(),
  },
  {
    id: "reset",
    title: t("PLATFORM.COMMON.RESET"),
    icon: "lucide-undo-2",
    disabled: !dirty.value,
    clickHandler: () => reset(),
  },
  refreshItem(() => load()),
  {
    id: "json",
    // the settings screen's name for the same kind of view
    title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON"),
    icon: "lucide-braces",
    clickHandler: () => openBlade({ name: "PlatformMenuEditorJson" }),
  },
  {
    id: "undo-all",
    title: t("PLATFORM.MENU_EDITOR.UNDO_ALL"),
    icon: "lucide-rotate-ccw",
    disabled:
      !Object.keys(clean(patch.value).items).length &&
      !Object.keys(clean(patch.value).sections).length &&
      !patch.value.addItems.length &&
      !patch.value.addSections.length,
    clickHandler: () => undoAll(),
  },
]);

/* ---- changes ---- */

type Entry = {
  titles?: Record<string, string>;
  hidden?: boolean;
  priority?: number;
  sectionId?: string;
  group?: string;
};
const itemPatch = (id: string): Entry => (patch.value.items[id] ??= {});
const sectionPatch = (id: string): Entry => (patch.value.sections[id] ??= {});
const hiddenInPatch = (id: string) => !!patch.value.items[id]?.hidden;
const rawSection = (id: string) => doc.value.sections.find((x) => x.id === id);

const isAddedItem = (id: string) => patch.value.addItems.some((x) => x.id === id);
const isAddedSection = (id: string) => patch.value.addSections.some((x) => x.id === id);

function toggleHidden(entry: Entry) {
  entry.hidden = entry.hidden ? undefined : true;
}

/** priorities 100, 200, 300... in the given order (the default menu's spacing), so moving one entry keeps the others
 * where they are */
function renumber(ids: string[], entryOf: (id: string) => Entry) {
  ids.forEach((id, index) => (entryOf(id).priority = (index + 1) * PRIORITY_STEP));
}

/* ---- moving: sections and items are dragged (mouse, or a short press on touch), or moved with the arrow keys on their
   grips. A section's items are lists: one per panel group, in the group's order, then the items in no group. ---- */

type EditorList = { value: string; label: string; items: MenuItem[] };

/** a section's lists: every group (also an empty one, which an item can be dropped into), then "" for no group */
function buildLists(section: MenuSection): EditorList[] {
  const raw = rawSection(section.id);
  const titles = (raw?.groups ?? []).map((group) => group.title);
  const groupOf = (id: string) => raw?.items.find((x) => x.id === id)?.group ?? "";
  const groups = titles.map((title, index) => ({
    value: title,
    label: section.groups[index]?.title ?? title,
    items: section.items.filter((x) => groupOf(x.id) === title),
  }));
  return [...groups, { value: "", label: "", items: section.items.filter((x) => !titles.includes(groupOf(x.id))) }];
}
const sectionLists = computed(() => new Map(shown.value.sections.map((x) => [x.id, buildLists(x)])));
const listsOf = (section: MenuSection) => sectionLists.value.get(section.id) ?? [];

/** the section an item is in by default (before the patch moves it) */
const defaultSectionOf = (id: string) =>
  defaultMenu.value.sections.find((x) => x.items.some((item) => item.id === id))?.id;

/** puts an item at `index` of a list (a group of a section; "" for none) and numbers the section's items in their order */
function place(id: string, sectionId: string, group: string, index: number) {
  const section = shown.value.sections.find((x) => x.id === sectionId);
  const fromSectionId = shown.value.sections.find((x) => x.items.some((item) => item.id === id))?.id;
  if (!section || !fromSectionId) return;
  const ids = listsOf(section).flatMap((list) => {
    const listIds = list.items.map((x) => x.id).filter((x) => x !== id);
    if (list.value === group) listIds.splice(Math.min(index, listIds.length), 0, id);
    return listIds;
  });
  const entry = itemPatch(id);
  if (sectionId !== fromSectionId) {
    // back in its own section the item needs no move
    entry.sectionId = sectionId === defaultSectionOf(id) ? undefined : sectionId;
  }
  if (sectionId !== fromSectionId || group !== rawGroupOf(fromSectionId, id)) entry.group = group;
  renumber(ids, itemPatch);
}

/** the arrow keys on an item's grip: a step up or down, into the next group or section at the end of one */
function stepItem(id: string, step: number) {
  const all = shown.value.sections.flatMap((section) =>
    listsOf(section).map((group) => ({ sectionId: section.id, list: group })),
  );
  const at = all.findIndex((x) => x.list.items.some((item) => item.id === id));
  if (at < 0) return;
  const { sectionId, list } = all[at];
  const next = list.items.findIndex((item) => item.id === id) + step;
  const target = next >= 0 && next < list.items.length ? undefined : all[at + step];
  if (next < 0 || next >= list.items.length) {
    if (!target) return;
    place(id, target.sectionId, target.list.value, step < 0 ? target.list.items.length : 0);
  } else {
    place(id, sectionId, list.value, next);
  }
  focusAfterPreview = `item:${id}`;
}

function moveSection(index: number, step: number) {
  const ids = doc.value.sections.map((x) => x.id);
  if (index + step < 0 || index + step >= ids.length) return;
  const [moved] = ids.splice(index, 1);
  ids.splice(index + step, 0, moved);
  renumber(ids, sectionPatch);
  focusAfterPreview = `section:${moved}`;
}

// a drop moves the elements itself: the lists are rendered again from the preview of the new patch
const sectionsEl = ref<HTMLElement>();
const dragging = ref(false);
const renderKey = ref(0);
let rebuildAfterPreview = false;
let focusAfterPreview: string | undefined;

function afterPreview() {
  if (rebuildAfterPreview) {
    rebuildAfterPreview = false;
    renderKey.value++;
  }
  const grip = focusAfterPreview;
  focusAfterPreview = undefined;
  if (grip) nextTick(() => document.querySelector<HTMLElement>(`[data-grip="${CSS.escape(grip)}"]`)?.focus());
}

function dropped() {
  dragging.value = false;
  rebuildAfterPreview = true;
  void preview();
}

function dropSection(event: SortableJS.SortableEvent) {
  if (event.oldIndex === event.newIndex) {
    dragging.value = false;
    return;
  }
  const ids = [...event.to.children].map((x) => (x as HTMLElement).dataset.section).filter((x): x is string => !!x);
  renumber(ids, sectionPatch);
  dropped();
}

function dropItem(event: SortableJS.SortableEvent) {
  const id = event.item.dataset.id;
  const to = event.to;
  if (!id || (event.from === to && event.oldIndex === event.newIndex)) {
    dragging.value = false;
    return;
  }
  place(id, to.dataset.section ?? "", to.dataset.group ?? "", event.newDraggableIndex ?? event.newIndex ?? 0);
  dropped();
}

const dragOptions: SortableJS.Options = {
  animation: 150,
  // on touch a short press starts the drag, so a swipe still scrolls
  delay: 180,
  delayOnTouchOnly: true,
  touchStartThreshold: 4,
  // the same dragged copy for mouse and touch, on the page's top layer so no section clips it
  forceFallback: true,
  fallbackOnBody: true,
  fallbackTolerance: 3,
  // the row's buttons and forms keep working
  filter: "input, select, textarea, a, form, .menu-editor__icon, .menu-editor__add-link",
  preventOnFilter: false,
  ghostClass: "menu-editor__drag-ghost",
  chosenClass: "menu-editor__drag-chosen",
  fallbackClass: "menu-editor__drag-copy",
  scroll: true,
  bubbleScroll: true,
  onStart: () => (dragging.value = true),
};

// the lists come and go with the tab, a section or group and every rebuild: each new one is made sortable
function bindSortables() {
  const root = sectionsEl.value;
  if (!root) return;
  if (!SortableJS.get(root)) {
    SortableJS.create(root, {
      ...dragOptions,
      group: "menu-sections",
      draggable: ".menu-editor__section",
      handle: ".menu-editor__row--section",
      onEnd: dropSection,
    });
  }
  root.querySelectorAll<HTMLElement>(".menu-editor__list").forEach((list) => {
    if (!SortableJS.get(list)) {
      SortableJS.create(list, {
        ...dragOptions,
        group: "menu-items",
        draggable: ".menu-editor__entry",
        onEnd: dropItem,
      });
    }
  });
}
// the lists are rendered in the blade's slot, so the blade (not this component) updates: bind after each render of them
watch([sectionsEl, sectionLists, renderKey], bindSortables, { flush: "post" });

function undoItem(id: string) {
  delete patch.value.items[id];
}

function removeItem(id: string) {
  patch.value.addItems = patch.value.addItems.filter((x) => x.id !== id);
  delete patch.value.items[id];
}

function removeSection(id: string) {
  patch.value.addSections = patch.value.addSections.filter((x) => x.id !== id);
  delete patch.value.sections[id];
}

/* ---- renaming: in the user's language, with English (the fallback of every other language) beside it ---- */

const renaming = ref<{ kind: "section" | "item"; id: string; value: string; english: string } | null>(null);

function startRename(kind: "section" | "item", id: string) {
  const titles = (kind === "section" ? patch.value.sections[id] : patch.value.items[id])?.titles ?? {};
  renaming.value = { kind, id, value: titles[locale.value] ?? "", english: titles.en ?? "" };
}

function applyRename(value: string, english: string) {
  if (!renaming.value) return;
  const entry = renaming.value.kind === "section" ? sectionPatch(renaming.value.id) : itemPatch(renaming.value.id);
  const titles: Record<string, string> = { ...(entry.titles ?? {}) };
  delete titles[locale.value];
  if (value.trim()) titles[locale.value] = value.trim();
  if (locale.value !== "en") {
    delete titles.en;
    if (english.trim()) titles.en = english.trim();
  }
  entry.titles = Object.keys(titles).length ? titles : undefined;
  renaming.value = null;
}

/* ---- adding sections and links ---- */

const adding = ref(false);
/** the section whose link form is open */
const linkSection = ref<string | null>(null);
const newTitle = ref("");
const newUrl = ref("");
const firstField = ref<HTMLInputElement>();

async function openAdder() {
  closeLink();
  adding.value = true;
  await nextTick();
  firstField.value?.focus();
}

function closeAdder() {
  adding.value = false;
  newTitle.value = "";
}

async function openLink(sectionId: string) {
  closeAdder();
  linkSection.value = sectionId;
  newTitle.value = "";
  newUrl.value = "";
  await nextTick();
  document.getElementById(`menu-editor-link-title-${sectionId}`)?.focus();
}

function closeLink() {
  linkSection.value = null;
  newTitle.value = "";
  newUrl.value = "";
}

const newId = (kind: string) => `custom.${kind}.${Date.now().toString(36)}`;
const titlesOf = (title: string) => (locale.value === "en" ? { en: title } : { [locale.value]: title, en: title });

function addSection() {
  const priorities = doc.value.sections.filter((x) => x.id !== MORE && x.id !== "apps").map((x) => x.priority);
  patch.value.addSections.push({
    id: newId("section"),
    title: newTitle.value.trim(),
    titles: titlesOf(newTitle.value.trim()),
    icon: "lucide-folder",
    priority: Math.max(0, ...priorities) + PRIORITY_STEP / 2,
    items: [],
    groups: [],
  });
  closeAdder();
}

function addLink(sectionId: string) {
  patch.value.addItems.push({
    id: newId("link"),
    sectionId,
    title: newTitle.value.trim(),
    titles: titlesOf(newTitle.value.trim()),
    icon: "lucide-link",
    priority: END_PRIORITY,
    target: { type: "url", url: newUrl.value.trim() },
    children: [],
  });
  closeLink();
}

/* ---- what each row shows and offers ---- */

// "Changed" means renamed, moved, regrouped or hidden: moving one entry renumbers its neighbours, which is no change of theirs
const changedBeyondOrder = (entry: Entry) =>
  Object.entries(entry).some(([key, value]) => key !== "priority" && value !== undefined && value !== null);

type Action = { id: string; title: string; icon: string; run: () => void };

function sectionBadges(section: MenuSection) {
  const entry = patch.value.sections[section.id];
  return [
    section.hidden && { id: "hidden", title: t("PLATFORM.MENU_EDITOR.BADGES.HIDDEN") },
    isAddedSection(section.id) && { id: "added", title: t("PLATFORM.MENU_EDITOR.BADGES.ADDED") },
    !isAddedSection(section.id) &&
      entry &&
      changedBeyondOrder(entry) && {
        id: "changed",
        title: t("PLATFORM.MENU_EDITOR.BADGES.CHANGED"),
      },
  ].filter(Boolean) as { id: string; title: string }[];
}

function itemBadges(item: MenuItem) {
  const entry = patch.value.items[item.id];
  return [
    (item.hidden || entry?.hidden) && { id: "hidden", title: t("PLATFORM.MENU_EDITOR.BADGES.HIDDEN") },
    item.source === "discovered" && { id: "discovered", title: t("PLATFORM.MENU_EDITOR.BADGES.DISCOVERED") },
    isAddedItem(item.id) && { id: "added", title: t("PLATFORM.MENU_EDITOR.BADGES.ADDED") },
    !isAddedItem(item.id) &&
      entry &&
      changedBeyondOrder(entry) && {
        id: "changed",
        title: t("PLATFORM.MENU_EDITOR.BADGES.CHANGED"),
      },
  ].filter(Boolean) as { id: string; title: string }[];
}

function sectionActions(section: MenuSection): Action[] {
  const actions: Action[] = [
    {
      id: "rename",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.RENAME"),
      icon: "lucide-pencil",
      run: () => startRename("section", section.id),
    },
    {
      id: "hide",
      title: section.hidden ? t("PLATFORM.MENU_EDITOR.ACTIONS.SHOW") : t("PLATFORM.MENU_EDITOR.ACTIONS.HIDE"),
      icon: section.hidden ? "lucide-eye" : "lucide-eye-off",
      run: () => toggleHidden(sectionPatch(section.id)),
    },
  ];
  if (isAddedSection(section.id)) {
    actions.push({
      id: "remove",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.REMOVE"),
      icon: "lucide-trash-2",
      run: () => removeSection(section.id),
    });
  } else if (patch.value.sections[section.id]) {
    actions.push({
      id: "undo",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.UNDO"),
      icon: "lucide-rotate-ccw",
      run: () => delete patch.value.sections[section.id],
    });
  }
  return actions;
}

function itemActions(item: MenuItem): Action[] {
  const actions: Action[] = [
    {
      id: "rename",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.RENAME"),
      icon: "lucide-pencil",
      run: () => startRename("item", item.id),
    },
    {
      id: "hide",
      title: item.hidden ? t("PLATFORM.MENU_EDITOR.ACTIONS.SHOW") : t("PLATFORM.MENU_EDITOR.ACTIONS.HIDE"),
      icon: item.hidden ? "lucide-eye" : "lucide-eye-off",
      run: () => toggleHidden(itemPatch(item.id)),
    },
  ];
  if (isAddedItem(item.id)) {
    actions.push({
      id: "remove",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.REMOVE"),
      icon: "lucide-trash-2",
      run: () => removeItem(item.id),
    });
  } else if (patch.value.items[item.id]) {
    actions.push({
      id: "undo",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.UNDO"),
      icon: "lucide-rotate-ccw",
      run: () => undoItem(item.id),
    });
  }
  return actions;
}

function childActions(child: MenuItem): Action[] {
  const hidden = hiddenInPatch(child.id);
  const actions: Action[] = [
    {
      id: "rename",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.RENAME"),
      icon: "lucide-pencil",
      run: () => startRename("item", child.id),
    },
    {
      id: "hide",
      title: hidden ? t("PLATFORM.MENU_EDITOR.ACTIONS.SHOW") : t("PLATFORM.MENU_EDITOR.ACTIONS.HIDE"),
      icon: hidden ? "lucide-eye" : "lucide-eye-off",
      run: () => toggleHidden(itemPatch(child.id)),
    },
  ];
  if (patch.value.items[child.id]) {
    actions.push({
      id: "undo",
      title: t("PLATFORM.MENU_EDITOR.ACTIONS.UNDO"),
      icon: "lucide-rotate-ccw",
      run: () => undoItem(child.id),
    });
  }
  return actions;
}

/** the group an item is in, by its English title (what a patch stores); "" for none */
const rawGroupOf = (sectionId: string, itemId: string) =>
  rawSection(sectionId)?.items.find((x) => x.id === itemId)?.group ?? "";

/* ---- Personalization ---- */

const personalizationOptions = computed(() => [
  { key: "allowPin" as const, title: t("PLATFORM.MENU_EDITOR.PERSONALIZATION.PIN") },
  { key: "allowHide" as const, title: t("PLATFORM.MENU_EDITOR.PERSONALIZATION.HIDE") },
  { key: "allowReorder" as const, title: t("PLATFORM.MENU_EDITOR.PERSONALIZATION.REORDER") },
]);

/* ---- AngularJS screens ---- */

const legacyScreens = ref<LegacyScreen[] | null>(null);
const legacyBusy = ref(false);
const legacyError = ref("");
const legacyTargets = ref<Record<string, string>>({});
// the screens the menu already has are listed only on demand: the ones to add are what the tab is for
const showPresent = ref(false);
const legacyMissing = computed(() => (legacyScreens.value ?? []).filter((x) => !inMenu(x)));
const legacyPresent = computed(() => (legacyScreens.value ?? []).filter((x) => inMenu(x)));
const legacyShown = computed(() => [...legacyMissing.value, ...(showPresent.value ? legacyPresent.value : [])]);

const normalizeUrl = (url?: string) => (url ?? "").replace(/\/+$/, "").toLowerCase();

// a screen's name for matching an AngularJS state url with a Vue route: "/workspace/Return" and "/returns" both "return"
const screenKey = (path?: string) =>
  (path ?? "")
    .split("?")[0]
    .replace(/\/+$/, "")
    .split("/")
    .pop()!
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");

/**
 * What the menu already opens: AngularJS screens by url (also ones a Vue screen has replaced since, from the default menu)
 * and Vue screens by name, since most AngularJS screens have a Vue one now under a route of the same name
 */
const opened = computed(() => {
  const urls = new Set<string>();
  const vue = new Set<string>();
  const add = (items: MenuItem[]) =>
    items.forEach((item) => {
      if (item.target?.type === "legacy") urls.add(normalizeUrl(item.target.legacyUrl));
      // a Vue screen that stands in for an AngularJS one
      if (item.fallback?.type === "legacy") urls.add(normalizeUrl(item.fallback.legacyUrl));
      if (item.target?.type === "vue" && item.target.route && item.target.route !== "/")
        vue.add(screenKey(item.target.route));
      add(item.children ?? []);
    });
  [...defaultMenu.value.sections, ...doc.value.sections].forEach((section) => add(section.items));
  add(patch.value.addItems);
  return { urls, vue };
});
const inMenu = (screen: LegacyScreen) =>
  opened.value.urls.has(normalizeUrl(screen.legacyUrl)) || opened.value.vue.has(screenKey(screen.legacyUrl));

const legacySections = computed(() => {
  const list = shown.value.sections.map((x) => ({ id: x.id, title: x.title }));
  return list.some((x) => x.id === MORE) ? list : [...list, { id: MORE, title: t("MENU.SECTIONS.more") }];
});

function legacyTitle(screen: LegacyScreen, lang = locale.value) {
  const title = titleOfItem(
    { id: "", title: screen.titleKey, titleKey: screen.titleKey, priority: 0, children: [] },
    lang,
  );
  return title === screen.titleKey ? (screen.path.split("/").pop() ?? title) : title;
}

async function findLegacy() {
  legacyBusy.value = true;
  legacyError.value = "";
  try {
    // the platform's server texts hold the AngularJS titles: loaded before the list is set, so its titles come translated
    const [screens] = await Promise.all([
      discoverLegacyScreens(),
      loadServerTexts(locale.value),
      loadServerTexts("en"),
    ]);
    legacyScreens.value = screens.sort((a, b) => legacyTitle(a).localeCompare(legacyTitle(b)));
    screens.forEach((screen) => (legacyTargets.value[screen.state] ??= MORE));
  } catch (error) {
    legacyError.value = (error as Error).message;
  } finally {
    legacyBusy.value = false;
  }
}

function addLegacy(screen: LegacyScreen) {
  const sectionId = legacyTargets.value[screen.state] ?? MORE;
  if (sectionId === MORE && !doc.value.sections.some((x) => x.id === MORE)) {
    patch.value.addSections.push({
      id: MORE,
      title: "More",
      icon: "lucide-ellipsis",
      priority: MORE_PRIORITY,
      items: [],
      groups: [],
    });
  }
  patch.value.addItems.push({
    id: `legacy.${screen.state.replace(/^workspace\./, "")}`,
    sectionId,
    title: legacyTitle(screen, "en"),
    titleKey: screen.titleKey,
    icon: "lucide-app-window",
    permission: screen.permission,
    // after the section's items, in the AngularJS menu's order
    priority: END_PRIORITY + (screen.priority ?? 0),
    target: { type: "legacy", legacyUrl: screen.legacyUrl },
    children: [],
  });
}

// the editor takes the whole width, and half of it while the JSON blade is open beside it (also one a link reopened)
const { blades } = useBladeStack();
const jsonOpen = computed(() => blades.value.some((x: { name: string }) => x.name === "PlatformMenuEditorJson"));

// the JSON blade reads the patch being edited and hands an edited or restored one back (Save stores it)
// (a link or a reload opens both at once: the patch is handed over once it is loaded)
const loaded = load();
exposeToChildren({
  getPatch: async () => {
    await loaded;
    return clean(patch.value);
  },
  applyPatch: (next: MenuPatch) => (patch.value = { ...emptyPatch(), ...clean(next) }),
});
</script>

<style lang="scss">
// inputs, selects and buttons of the add forms share one height, so they line up
$form-control-height: 32px;
// items sit inside their section, sub-items inside their item
$item-indent: 36px;
$child-indent: 88px;

.menu-editor {
  display: flex;
  flex-direction: column;
  min-height: 100%;

  &__tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 22px 0;
    border-bottom: 1px solid var(--color-neutral-200);
    flex-wrap: wrap;
  }

  &__tab {
    padding: 8px 14px;
    font-size: 14px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--color-neutral-600);
    cursor: pointer;

    &--active {
      color: var(--color-neutral-950);
      border-bottom-color: var(--color-primary-500);
      font-weight: 600;
    }
  }

  &__unsaved {
    margin-inline-start: auto;
    font-size: 12px;
    color: var(--color-warning-600);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 22px 36px;
    max-width: 980px;
  }

  &__error {
    margin: 0;
    font-size: 13px;
    color: var(--color-danger-600);
  }

  &__adders {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    background: var(--color-additional-50);
    color: var(--color-neutral-900);
    cursor: pointer;

    &:disabled {
      opacity: 0.55;
      cursor: default;
    }

    &--primary {
      background: var(--color-primary-500);
      border-color: var(--color-primary-500);
      color: var(--color-additional-50);
    }

    &--pressed {
      background: var(--color-primary-50);
      border-color: var(--color-primary-500);
      color: var(--color-primary-700);
    }
  }

  &__form {
    display: flex;
    flex-wrap: wrap;
    // top-aligned: a field's hint below its input (the link's address) doesn't push its label up
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--color-primary-200);
    border-radius: 8px;
    background: var(--color-neutral-50);
  }

  &__form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-basis: 100%;
    font-size: 13px;
    color: var(--color-neutral-900);
  }

  &__form-actions {
    display: inline-flex;
    gap: 8px;

    .menu-editor__button {
      height: $form-control-height;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-neutral-600);
    min-width: 0;

    input,
    select {
      box-sizing: border-box;
      height: $form-control-height;
      font-size: 13px;
      padding: 6px 8px;
      border: 1px solid var(--color-neutral-300);
      border-radius: 6px;
      background: var(--color-additional-50);
      color: var(--color-neutral-950);
      min-width: 180px;
      max-width: 100%;
    }

    &--wide input {
      min-width: 260px;
    }

    // stacked on a phone, the buttons need no empty label line
    @media (max-width: 600px) {
      &--actions > span:first-child {
        display: none;
      }
    }
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__section {
    border: 1px solid color-mix(in srgb, var(--color-primary-500) 25%, var(--color-neutral-200));
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-additional-50);

    &--hidden {
      opacity: 0.6;
    }
  }

  &__grip {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 28px;
    margin-inline-start: -6px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--color-neutral-400);
    cursor: grab;
    // a finger on the grip drags right away instead of scrolling
    touch-action: none;

    &:hover,
    &:focus-visible {
      color: var(--color-neutral-900);
      background: var(--color-neutral-100);
    }
  }

  &__list {
    &--empty::before {
      content: attr(data-empty);
      display: block;
      margin: 4px 12px 8px $item-indent;
      padding: 8px 10px;
      border: 1px dashed var(--color-neutral-300);
      border-radius: 6px;
      font-size: 12px;
      color: var(--color-neutral-500);
    }

    // a grouped section's "no group" list shows only while something is dragged
    &--rest.menu-editor__list--empty {
      display: none;
    }
  }

  &__sections--dragging &__list--rest {
    display: block;
  }

  &__drag-ghost {
    opacity: 0.35;
  }

  &__drag-copy {
    background: var(--color-additional-50);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
    opacity: 0.95;
  }

  &__add-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 6px;
    padding: 6px 12px 6px $item-indent;
    font-size: 13px;
    border: 0;
    background: none;
    color: var(--color-primary-600);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  &__form--inline {
    margin: 4px 12px 12px $item-indent;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
    padding: 6px 12px;
    border-top: 1px solid var(--color-neutral-100);
    font-size: 13px;

    &--section {
      border-top: 0;
      // the section's own color, so sections stand apart from their items
      background: color-mix(in srgb, var(--color-primary-500) 12%, var(--color-additional-50));
      font-size: 14px;
      cursor: grab;
    }

    &--item {
      padding-inline-start: $item-indent;
    }

    &--child {
      padding-inline-start: $child-indent;
    }

    &--hidden .menu-editor__name > span:first-of-type {
      text-decoration: line-through;
      color: var(--color-neutral-500);
    }
  }

  &__name {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__group {
    margin: 0;
    padding: 10px 12px 4px $item-indent;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    border-top: 1px solid var(--color-neutral-100);
  }

  &__badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);

    &--hidden {
      background: var(--color-danger-50);
      color: var(--color-danger-700);
    }
    &--changed {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
    }
    &--added {
      background: var(--color-success-50);
      color: var(--color-success-700);
    }
    &--discovered,
    &--in-menu {
      background: var(--color-warning-50);
      color: var(--color-warning-700);
    }
  }

  &__actions {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
  }

  &__select {
    font-size: 12px;
    padding: 3px 6px;
    margin-inline-end: 4px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    background: var(--color-additional-50);
    color: var(--color-neutral-900);
    max-width: 170px;
  }

  &__icon {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--color-neutral-600);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--color-neutral-100);
      color: var(--color-neutral-950);
    }
    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--color-neutral-900);

    input {
      width: 16px;
      height: 16px;
    }
  }

  &__disclosure {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 4px 0;
    font-size: 13px;
    border: 0;
    background: none;
    color: var(--color-primary-600);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  &__more,
  &__empty {
    padding: 8px 12px;
  }
}
</style>
