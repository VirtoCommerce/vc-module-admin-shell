<template>
  <VcBlade
    :title="title"
    :subtitle="moduleId"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="60%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <div
          v-for="s in settings"
          :key="s.name"
          class="platform-setting"
          :data-setting="s.name"
        >
          <template v-if="s.isDictionary">
            <VcField
              :label="settingTitle(s)"
              :model-value="dictionaryText(s)"
              :tooltip="settingDescription(s)"
            />
            <VcButton
              class="platform-setting__dictionary"
              variant="outline"
              size="sm"
              icon="lucide-pencil"
              @click="openDictionary(s)"
            >
              {{ $t("PLATFORM.SETTINGS.GROUP.EDIT_VALUES") }}
            </VcButton>
          </template>
          <VcSelect
            v-else-if="s.allowedValues?.length"
            v-model="item[s.name]"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :options="s.allowedValues.map((x) => ({ id: x, title: String(x) }))"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :clearable="!s.isRequired"
            :error-message="requiredError(s)"
            searchable
          />
          <VcSwitch
            v-else-if="s.valueType === 'Boolean'"
            v-model="item[s.name] as boolean"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :disabled="readonly(s)"
          />
          <VcInput
            v-else-if="s.valueType === 'Integer' || s.valueType === 'PositiveInteger'"
            v-model="item[s.name] as number"
            type="integer"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :error-message="requiredError(s)"
          />
          <VcInput
            v-else-if="s.valueType === 'Decimal'"
            v-model="item[s.name] as number"
            type="number"
            step="any"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :error-message="requiredError(s)"
          />
          <VcDatePicker
            v-else-if="s.valueType === 'DateTime'"
            v-model="item[s.name] as Date"
            type="datetime-local"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :error-message="requiredError(s)"
          />
          <template v-else-if="s.valueType === 'Json'">
            <VcTextarea
              v-model="item[s.name] as string"
              class="platform-code"
              maxlength="1000000"
              :label="settingTitle(s)"
              :hint="settingDescription(s)"
              :required="s.isRequired"
              :disabled="readonly(s)"
              :error-message="jsonError(s) || requiredError(s)"
            />
            <VcButton
              class="platform-setting__dictionary"
              variant="ghost"
              size="sm"
              icon="lucide-braces"
              :disabled="readonly(s) || !!jsonError(s) || !item[s.name]"
              @click="formatJson(s)"
            >
              {{ $t("PLATFORM.SETTINGS.GROUP.FORMAT_JSON") }}
            </VcButton>
          </template>
          <VcTextarea
            v-else-if="s.valueType === 'LongText'"
            v-model="item[s.name] as string"
            maxlength="1000000"
            :label="settingTitle(s)"
            :hint="settingDescription(s)"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :error-message="requiredError(s)"
          />
          <VcInput
            v-else
            v-model="item[s.name] as string"
            :type="s.valueType === 'SecureString' ? 'password' : 'text'"
            :label="settingTitle(s)"
            :hint="s.valueType === 'Cron' ? cronHint(s) : settingDescription(s)"
            :required="s.isRequired"
            :disabled="readonly(s)"
            :error-message="requiredError(s)"
          />
          <div class="platform-setting__meta">
            <span
              v-if="isChanged(s)"
              class="platform-setting__dot"
              :title="$t('PLATFORM.SETTINGS.GROUP.CHANGED')"
            ></span>
            <code>{{ s.name }}</code>
            <span v-if="s.restartRequired">· {{ $t("PLATFORM.SETTINGS.GROUP.RESTART_REQUIRED") }}</span>
            <span v-if="s.assignedToTenants?.length">· {{ s.assignedToTenants.join(", ") }}</span>
            <VcButton
              v-if="canResetToDefault(s)"
              variant="link"
              size="sm"
              @click="resetToDefault(s)"
            >
              {{ $t("PLATFORM.SETTINGS.GROUP.RESET_TO_DEFAULT") }}
            </VcButton>
          </div>
        </div>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { useAsync, useBlade, useLoading, usePermissions, notification, type IBladeToolbar } from "@vc-shell/framework";
import {
  VcBlade,
  VcButton,
  VcContainer,
  VcDatePicker,
  VcField,
  VcForm,
  VcInput,
  VcSelect,
  VcSwitch,
  VcTextarea,
} from "@vc-shell/framework/ui";
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import {
  groupPath,
  isEmpty,
  sameValue,
  settingDescription,
  settingTitle,
  toEditor,
  useSettingsStore,
  type SettingSchema,
  type SettingValues,
} from "../../composables/settings";

defineBlade({
  url: "/group",
  name: "PlatformSettingsGroup",
  permissions: ["platform:setting:access"],
});

const { t } = useI18n({ useScope: "global" });
// options.focus: a setting to scroll to and flash (global search opens a setting this way)
const { param, options, openBlade, exposeToChildren } = useBlade<{ includeTenant?: boolean; focus?: string }>();
const { hasAccess } = usePermissions();
const store = useSettingsStore();

const item = ref<SettingValues>({});

const settings = computed(() =>
  store.schema.value.filter(
    (s) => groupPath(s).join("|") === param.value && (options.value?.includeTenant || !s.assignedToTenants?.length),
  ),
);
const title = computed(() => (param.value ?? "").split("|").join(" › "));
const moduleId = computed(() => settings.value[0]?.moduleId ?? undefined);

const canUpdate = computed(() => hasAccess("platform:setting:update"));
const readonly = (s: SettingSchema) => !!s.isReadOnly || !canUpdate.value;

const changed = computed(() =>
  settings.value.filter((s) => !s.isDictionary && !sameValue(item.value[s.name], store.stored.value[s.name], s.valueType)),
);
const isChanged = (s: SettingSchema) => changed.value.includes(s);

const requiredError = (s: SettingSchema) => (s.isRequired && isEmpty(item.value[s.name]) ? t("PLATFORM.COMMON.REQUIRED") : undefined);

function jsonError(s: SettingSchema) {
  const value = item.value[s.name];
  if (isEmpty(value)) return undefined;
  try {
    JSON.parse(String(value));
    return undefined;
  } catch (e) {
    return t("PLATFORM.SETTINGS.GROUP.INVALID_JSON", { error: (e as Error).message });
  }
}

const valid = computed(() =>
  settings.value.every((s) => !requiredError(s) && (s.valueType !== "Json" || !jsonError(s))),
);

const form = usePlatformBladeForm({
  data: item,
  canSaveOverride: computed(() => changed.value.length > 0 && valid.value && canUpdate.value),
});

function fill() {
  item.value = Object.fromEntries(settings.value.map((s) => [s.name, toEditor(store.stored.value[s.name], s.valueType)]));
  form.setBaseline();
}

const { loading: loadLoading, action: load } = useAsync(async () => {
  if (!store.loaded.value) await store.load();
  fill();
  focusSetting();
});

async function focusSetting() {
  const name = options.value?.focus;
  if (!name) return;
  await nextTick();
  const element = document.querySelector<HTMLElement>(`.platform-setting[data-setting="${CSS.escape(name)}"]`);
  if (!element) return;
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.classList.add("platform-setting--found");
  setTimeout(() => element.classList.remove("platform-setting--found"), 2400);
  element.querySelector<HTMLElement>("input, textarea, [tabindex]:not([tabindex='-1'])")?.focus({ preventScroll: true });
}

const { loading: saveLoading, action: save } = useAsync(async () => {
  await store.save(Object.fromEntries(changed.value.map((s) => [s.name, item.value[s.name]])));
  // the list reads the same store
  await store.load();
  fill();
  notification.success(t("PLATFORM.SETTINGS.SAVED"));
});

const loading = useLoading(loadLoading, saveLoading);

const defaultOf = (s: SettingSchema) => toEditor(s.defaultValue, s.valueType);
const canResetToDefault = (s: SettingSchema) =>
  !s.isDictionary && !readonly(s) && !sameValue(item.value[s.name], defaultOf(s), s.valueType);
// legacy: reset only changes the value locally, Save persists it
const resetToDefault = (s: SettingSchema) => (item.value[s.name] = defaultOf(s));

function formatJson(s: SettingSchema) {
  item.value[s.name] = JSON.stringify(JSON.parse(String(item.value[s.name])), null, 2);
}

const dictionaryText = (s: SettingSchema) => {
  const values = store.stored.value[s.name];
  return Array.isArray(values) && values.length ? values.join(", ") : "—";
};

const CRON = /^\s*(\S+\s+){4}\S+(\s+\S+)?\s*$/;
const cronHint = (s: SettingSchema) =>
  CRON.test(String(item.value[s.name] ?? ""))
    ? settingDescription(s) ?? t("PLATFORM.SETTINGS.GROUP.CRON_HINT")
    : t("PLATFORM.SETTINGS.GROUP.CRON_INVALID");

function openDictionary(s: SettingSchema) {
  openBlade({ name: "PlatformSettingDictionary", param: s.name });
}

const toolbar = ref<IBladeToolbar[]>([
  ...saveResetItems(form, { save: () => save(), reset: () => fill(), resetDisabled: computed(() => !changed.value.length) }),
]);

load();

// the dictionary blade has reloaded the store (which the list reads too); its edit changes only its own list: unsaved values here stay
exposeToChildren({
  reload() {
    if (!form.isModified.value) fill();
  },
});
</script>

<style lang="scss">

.platform-setting {
  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-neutral-500);
    code {
      font-size: 11px;
    }
  }
  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary-500);
  }
  &__dictionary {
    margin-top: 6px;
  }
}

</style>
