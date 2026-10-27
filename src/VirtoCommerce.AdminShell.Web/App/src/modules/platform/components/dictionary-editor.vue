<template>
  <div class="platform-dictionary">
    <div
      v-if="canEdit"
      class="platform-dictionary__form"
    >
      <VcInput
        v-model="draft.alias"
        :label="editingId ? $t('PLATFORM.DICTIONARY.VALUE') : $t('PLATFORM.DICTIONARY.NEW_VALUE')"
        :error-message="duplicate ? $t('PLATFORM.DICTIONARY.DUPLICATE') : undefined"
        maxlength="512"
        @keyup.enter="commit"
      />
      <VcInput
        v-for="language in languages"
        :key="language"
        v-model="draft[language]"
        :label="language"
        maxlength="512"
        @keyup.enter="commit"
      />
      <div class="platform-dictionary__actions">
        <VcButton
          :icon="editingId ? 'lucide-check' : 'lucide-plus'"
          size="sm"
          :disabled="!draft.alias.trim() || duplicate"
          @click="commit"
        >
          {{ editingId ? $t("PLATFORM.DICTIONARY.APPLY") : $t("PLATFORM.COMMON.ADD") }}
        </VcButton>
        <VcButton
          v-if="editingId"
          variant="secondary"
          size="sm"
          @click="reset"
        >
          {{ $t("PLATFORM.DICTIONARY.CANCEL") }}
        </VcButton>
      </div>
    </div>
    <VcDataTable
      v-model:selection="selection"
      v-model:search-value="keyword"
      selection-mode="multiple"
      :items="visible"
      :total-count="visible.length"
      :searchable="true"
      :state-key="stateKey"
      :active-item-id="editingId"
      :empty-state="{ icon: 'lucide-list', title: $t('PLATFORM.DICTIONARY.EMPTY') }"
      @row-click="(e: { data: DictionaryRow }) => edit(e.data)"
    >
      <VcColumn
        id="alias"
        :title="$t('PLATFORM.DICTIONARY.VALUE')"
        always-visible
      />
      <VcColumn
        v-for="language in languages"
        :id="language"
        :key="language"
        :title="language"
      />
    </VcDataTable>
  </div>
</template>

<script lang="ts">
/** Aliases compare trimmed and case-insensitively: a duplicate here, a removal when the dictionary saves. */
export const sameAlias = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
</script>

<script setup lang="ts">
// Value list editor shared by dictionary settings and dynamic property dictionaries (legacy: add form on top, a row
// opens in the same form for editing, translations per language). Changes stay local until the blade saves.
import { VcButton, VcColumn, VcDataTable, VcInput } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";

export type DictionaryRow = Record<string, string> & { id: string; alias: string };

const props = defineProps<{ languages: string[]; canEdit: boolean; stateKey: string }>();
const rows = defineModel<DictionaryRow[]>("rows", { required: true });
const selection = defineModel<DictionaryRow[]>("selection", { default: () => [] });

let seq = 0;
const blank = (): DictionaryRow => ({ id: "", alias: "", ...Object.fromEntries(props.languages.map((l) => [l, ""])) }) as DictionaryRow;

const draft = ref<DictionaryRow>(blank());
const editingId = ref<string>();
const keyword = ref("");

const duplicate = computed(
  () => !!draft.value.alias.trim() && rows.value.some((r) => r.id !== editingId.value && sameAlias(r.alias, draft.value.alias)),
);
const visible = computed(() => {
  const text = keyword.value.toLowerCase();
  return rows.value.filter((r) => !text || Object.values(r).some((x) => String(x).toLowerCase().includes(text)));
});

function reset() {
  draft.value = blank();
  editingId.value = undefined;
}

function edit(row: DictionaryRow) {
  if (!props.canEdit) return;
  draft.value = { ...blank(), ...row };
  editingId.value = row.id;
}

function commit() {
  if (!draft.value.alias.trim() || duplicate.value) return;
  const value = { ...draft.value, alias: draft.value.alias.trim() };
  rows.value = editingId.value
    ? rows.value.map((r) => (r.id === editingId.value ? value : r))
    : [{ ...value, id: `new-${seq++}` }, ...rows.value];
  reset();
}
</script>
