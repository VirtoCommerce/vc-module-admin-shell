<template>
  <VcBlade
    :title="$t('PLATFORM.SIGN_IN_METHODS.TITLE')"
    :subtitle="$t('PLATFORM.SIGN_IN_METHODS.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcContainer>
      <p
        v-if="readOnly"
        class="platform-note"
      >
        {{ $t("PLATFORM.SIGN_IN_METHODS.READ_ONLY") }}
      </p>

      <section
        v-for="method in rows"
        :key="method.name"
        class="platform-sim"
        :aria-labelledby="`platform-sim-${method.name}`"
      >
        <header class="platform-sim__head">
          <span
            class="platform-sim__icon"
            aria-hidden="true"
          >
            <img
              v-if="!method.icon && method.logo"
              :src="method.logo"
              alt=""
            />
            <VcIcon
              v-else
              :icon="method.icon ?? 'lucide-key-round'"
              size="m"
            />
          </span>
          <h3
            :id="`platform-sim-${method.name}`"
            class="platform-sim__title"
          >
            {{ method.title }}
          </h3>
          <VcButton
            v-if="method.addTitle"
            size="sm"
            outline
            icon="lucide-plus"
            :disabled="loading"
            @click="add(method)"
          >
            {{ method.addTitle }}
          </VcButton>
        </header>

        <ul
          v-if="method.keys.length"
          class="platform-sim__keys"
        >
          <li
            v-for="key in method.keys"
            :key="key.id"
            class="platform-sim__key"
          >
            <VcIcon
              class="platform-sim__key-icon"
              :icon="key.icon"
              size="m"
              aria-hidden="true"
            />
            <div class="platform-sim__key-body">
              <!-- Enter saves and Escape cancels, from the field itself: VcButton cancels a form's implicit submit -->
              <div
                v-if="renaming === renameId(method, key)"
                class="platform-sim__rename"
              >
                <input
                  ref="renameInput"
                  v-model="renameValue"
                  class="platform-sim__rename-input"
                  maxlength="200"
                  :aria-label="$t('PLATFORM.SIGN_IN_METHODS.KEY_NAME')"
                  @keydown.enter.prevent="rename(method, key)"
                  @keydown.esc.prevent="renaming = undefined"
                />
                <VcButton
                  size="sm"
                  icon="lucide-check"
                  :disabled="!renameValue.trim()"
                  :aria-label="$t('PLATFORM.COMMON.SAVE')"
                  :title="$t('PLATFORM.COMMON.SAVE')"
                  @click="rename(method, key)"
                />
                <VcButton
                  size="sm"
                  text
                  icon="lucide-x"
                  :aria-label="$t('PLATFORM.SIGN_IN_METHODS.CANCEL')"
                  :title="$t('PLATFORM.SIGN_IN_METHODS.CANCEL')"
                  @click="renaming = undefined"
                />
              </div>
              <span
                v-else
                class="platform-sim__key-name"
                :title="key.hint"
                >{{ key.label }}</span
              >
              <span
                v-if="key.details"
                class="platform-sim__key-details"
                >{{ key.details }}</span
              >
            </div>
            <div
              v-if="renaming !== renameId(method, key)"
              class="platform-sim__actions"
            >
              <VcButton
                v-if="method.kind === 'Password' && method.canChange"
                size="sm"
                text
                icon="lucide-pencil"
                :title="$t('SHELL.ACCOUNT.CHANGE_PASSWORD')"
                :aria-label="$t('SHELL.ACCOUNT.CHANGE_PASSWORD')"
                @click="changePassword()"
              />
              <VcButton
                v-if="method.canRenameKey"
                size="sm"
                text
                icon="lucide-pencil"
                :title="$t('PLATFORM.SIGN_IN_METHODS.RENAME')"
                :aria-label="`${$t('PLATFORM.SIGN_IN_METHODS.RENAME')}: ${key.label}`"
                @click="startRename(method, key)"
              />
              <VcButton
                v-if="method.canDeleteKey"
                size="sm"
                text
                icon="lucide-trash-2"
                :disabled="loading || isLastKey"
                :title="isLastKey ? $t('PLATFORM.SIGN_IN_METHODS.LAST_KEY') : $t('PLATFORM.SIGN_IN_METHODS.DELETE')"
                :aria-label="`${$t('PLATFORM.SIGN_IN_METHODS.DELETE')}: ${key.label}`"
                @click="remove(method, key)"
              />
            </div>
          </li>
        </ul>
        <p
          v-else
          class="platform-sim__empty"
        >
          {{ method.empty }}
        </p>
      </section>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
// The current user's ways to sign in and their keys (vc-platform#3144), as the AngularJS profile's "Sign-in methods":
// the password, linked external accounts, and methods modules add (passkeys). A module's plugin adds the "Add" of its
// method and how its keys read (shell/signInMethods.ts); the platform says what may be renamed or deleted.
import { ChangePassword, notification, useAsync, useBlade, usePopup, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcButton, VcContainer, VcIcon } from "@vc-shell/framework/ui";
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { rootedUrl } from "../../../../utils/url";
import {
  deleteSignInKey,
  loadUserSignInMethods,
  renameSignInKey,
  signInMethods,
  type SignInKey,
  type SignInMethod,
} from "../../../../shell/signInMethods";
import { refreshItem } from "../../composables/blade";

defineBlade({
  url: "/sign-in-methods",
  name: "PlatformUserSignInMethods",
});

const { t, locale } = useI18n({ useScope: "global" });
const { openBlade, callParent, exposeToChildren } = useBlade();
const { showConfirmation } = usePopup();

const methods = ref<SignInMethod[]>([]);

const { loading: loadLoading, action: load } = useAsync(async () => {
  methods.value = (await loadUserSignInMethods()) ?? [];
});

const date = (value?: string) =>
  value ? new Date(value).toLocaleDateString(locale.value, { dateStyle: "medium" }) : undefined;

// the platform's kinds read the same everywhere; a module's method reads as its plugin says, else as the platform names it
const rows = computed(() =>
  [...methods.value]
    // the password first, then the methods by name, as the AngularJS list
    .sort((a, b) => Number(b.kind === "Password") - Number(a.kind === "Password") || title(a).localeCompare(title(b)))
    .map((method) => {
      const extension = signInMethods.get(method.name);
      const isPassword = method.kind === "Password";
      const isExternal = method.kind === "External";
      const canAdd = !!method.canCreateKey && (isPassword || !!extension?.createKey);
      return {
        ...method,
        title: title(method),
        icon: extension?.icon ?? (isPassword ? "lucide-lock" : undefined),
        logo: rootedUrl(method.logoUrl),
        // the password has no "Add": it is set, once there is none
        addTitle: !canAdd
          ? undefined
          : isPassword
            ? t("PLATFORM.SIGN_IN_METHODS.SET_PASSWORD")
            : (extension?.createKeyTitle?.() ?? t("PLATFORM.SIGN_IN_METHODS.ADD")),
        canChange: isPassword && !readOnly.value,
        empty: isPassword
          ? t("PLATFORM.SIGN_IN_METHODS.NO_PASSWORD")
          : isExternal
            ? t("PLATFORM.SIGN_IN_METHODS.NO_LINKED_ACCOUNT")
            : t("PLATFORM.SIGN_IN_METHODS.NO_KEYS"),
        keys: (method.keys ?? []).map((key) => ({
          ...key,
          icon: extension?.keyIcon?.(key) ?? (isPassword ? "lucide-lock" : "lucide-key-round"),
          label: isPassword
            ? t("PLATFORM.SIGN_IN_METHODS.PASSWORD_SET")
            : isExternal
              ? t("PLATFORM.SIGN_IN_METHODS.LINKED_ACCOUNT")
              : key.name || t("PLATFORM.SIGN_IN_METHODS.UNNAMED"),
          hint: isExternal ? key.id : undefined,
          details: [
            extension?.describeKey?.(key),
            isPassword
              ? key.modifiedDate && t("PLATFORM.SIGN_IN_METHODS.CHANGED", { date: date(key.modifiedDate) })
              : key.createdDate && t("PLATFORM.SIGN_IN_METHODS.CREATED", { date: date(key.createdDate) }),
          ]
            .filter(Boolean)
            .join(" · "),
        })),
      };
    }),
);

function title(method: SignInMethod) {
  const extension = signInMethods.get(method.name);
  if (extension?.title) return extension.title();
  if (method.kind === "Password") return t("PLATFORM.SIGN_IN_METHODS.PASSWORD");
  return method.displayName || method.name;
}

// impersonating, or an account the platform keeps read-only: the platform allows no change of any method
const readOnly = computed(
  () => methods.value.length > 0 && methods.value.every((m) => !m.canCreateKey && !m.canDeleteKey && !m.canRenameKey),
);
// the platform refuses to delete the only way to sign in; the button says so before the user tries
const isLastKey = computed(() => methods.value.reduce((count, m) => count + (m.keys?.length ?? 0), 0) <= 1);

type Row = (typeof rows.value)[number];
type KeyRow = Row["keys"][number];

const { loading: changeLoading, action: change } = useAsync<() => Promise<unknown>>(async (work) => {
  try {
    await work!();
  } catch (e) {
    notification.error(e instanceof Error ? e.message : String(e));
  }
  await load();
  // the profile's widget counts the keys
  await callParent("reload").catch(() => undefined);
});

function add(method: Row) {
  if (method.kind === "Password") {
    openBlade({ name: "PlatformUserSetPassword" });
    return;
  }
  const createKey = signInMethods.get(method.name)?.createKey;
  if (!createKey) return;
  change(async () => {
    // false: the user closed the browser's prompt
    if ((await createKey()) !== false)
      notification.success(t("PLATFORM.SIGN_IN_METHODS.ADDED", { name: method.title }));
  });
}

// the key being renamed, by method and id: the rows are rebuilt on every change
const renaming = ref<string>();
const renameId = (method: SignInMethod, key: SignInKey) => `${method.name}/${key.id}`;
const renameValue = ref("");
const renameInput = ref<HTMLInputElement[]>();

async function startRename(method: Row, key: KeyRow) {
  renaming.value = renameId(method, key);
  renameValue.value = key.name ?? "";
  await nextTick();
  renameInput.value?.[0]?.focus();
  renameInput.value?.[0]?.select();
}

function rename(method: Row, key: KeyRow) {
  const name = renameValue.value.trim();
  renaming.value = undefined;
  if (!name || name === key.name) return;
  change(() => renameSignInKey(method, key as SignInKey, name));
}

async function remove(method: Row, key: KeyRow) {
  const message =
    method.kind === "Password"
      ? t("PLATFORM.SIGN_IN_METHODS.DELETE_PASSWORD_CONFIRM")
      : t("PLATFORM.SIGN_IN_METHODS.DELETE_CONFIRM", { name: key.label, method: method.title });
  if (!(await showConfirmation(message))) return;
  change(() => deleteSignInKey(method, key as SignInKey));
}

const { open: changePassword } = usePopup({ component: ChangePassword });

const loading = computed(() => loadLoading.value || changeLoading.value);

const toolbar = ref<IBladeToolbar[]>([refreshItem(() => load())]);

// the set-password blade reloads the list when it saves
exposeToChildren({
  reload: async () => {
    await load();
    await callParent("reload").catch(() => undefined);
  },
});

load();
</script>

<style lang="scss">
.platform-sim {
  border-bottom: 1px solid var(--color-neutral-200);
  padding: 16px 0;

  &:first-of-type {
    padding-top: 4px;
  }

  &:last-of-type {
    border-bottom: 0;
  }
}

.platform-sim__head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.platform-sim__icon {
  align-items: center;
  color: var(--color-neutral-600);
  display: inline-flex;
  height: 24px;
  justify-content: center;
  width: 24px;

  img {
    height: 20px;
    object-fit: contain;
    width: 20px;
  }
}

.platform-sim__title {
  color: var(--color-neutral-900);
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  min-width: 0;
}

.platform-sim__keys {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.platform-sim__key {
  align-items: center;
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
  border-radius: 10px;
  display: flex;
  gap: 12px;
  min-height: 56px;
  padding: 8px 8px 8px 12px;
}

.platform-sim__key-icon {
  color: var(--color-neutral-500);
  flex-shrink: 0;
}

.platform-sim__key-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.platform-sim__key-name {
  color: var(--color-neutral-900);
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-sim__key-details {
  color: var(--color-neutral-500);
  font-size: 13px;
}

.platform-sim__actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;

  // vc-shell 2.7 draws a disabled text button white (--button-primary-text-color-disabled): the last key's delete stays
  // visible, greyed, with its reason in the tooltip
  .vc-button.vc-button-primary.vc-button--text:disabled {
    color: var(--color-neutral-400);
  }
}

.platform-sim__rename {
  align-items: center;
  display: flex;
  gap: 6px;
}

.platform-sim__rename-input {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  color: var(--color-neutral-900);
  flex: 1;
  font: inherit;
  font-size: 14px;
  height: 32px;
  min-width: 0;
  padding: 0 10px;

  &:focus {
    border-color: var(--color-primary-500);
    outline: 2px solid color-mix(in srgb, var(--color-primary-500) 25%, transparent);
  }
}

.platform-sim__empty {
  color: var(--color-neutral-500);
  font-size: 14px;
  margin: 8px 0 0 36px;
}
</style>
