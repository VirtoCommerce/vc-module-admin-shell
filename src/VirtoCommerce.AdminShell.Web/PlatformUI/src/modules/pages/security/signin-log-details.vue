<template>
  <VcBlade
    :title="record?.userName || $t('PLATFORM.SECURITY.SIGNIN.RECORD')"
    :subtitle="record?.signInType"
    width="40%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcField
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
          :model-value="field.value"
          :type="field.key === 'createdDate' ? 'date' : 'text'"
          orientation="horizontal"
          :aspect-ratio="[1, 2]"
          copyable
        />
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { useBlade } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcField, VcForm } from "@vc-shell/framework/ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { UserSignInLog } from "../../composables/security";

defineBlade({
  url: "/sign-in-record",
  name: "PlatformSecuritySignInLogDetails",
  permissions: ["platform:security:sign_in_log:read"],
});

const { t } = useI18n({ useScope: "global" });
const { options } = useBlade<{ record?: UserSignInLog }>();
const record = computed(() => options.value?.record);

// legacy metaform "signInLogDetails": every non-empty field, in this order
const KEYS = [
  "createdDate", "userName", "succeeded", "failureReason", "signInType", "provider", "operatorUserName", "operatorUserId",
  "userId", "memberId", "ipAddress", "host", "userAgent", "clientId", "sessionId", "storeId", "storeName", "organizationName", "organizationId",
] as const;

function textOf(value: unknown) {
  if (typeof value !== "boolean") return value as string;
  return t(value ? "PLATFORM.COMMON.YES" : "PLATFORM.COMMON.NO");
}

const fields = computed(() =>
  KEYS.map((key) => ({ key, label: t(`PLATFORM.SECURITY.SIGNIN.FIELDS.${key}`), value: record.value?.[key] }))
    .filter((f) => f.value !== null && f.value !== undefined && f.value !== "")
    .map((f) => ({ ...f, value: f.key === "createdDate" ? new Date(f.value as string) : textOf(f.value) })),
);
</script>
