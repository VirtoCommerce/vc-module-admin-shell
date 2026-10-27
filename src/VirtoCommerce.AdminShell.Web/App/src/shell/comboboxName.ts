import type { Directive } from "vue";

/**
 * Names the combobox of a VcSelect that has no `label` of its own (its title is shown elsewhere, as in Settings, or by
 * a panel's own label). vc-shell names the combobox only from `label`, so without one a screen reader announces an
 * unnamed combobox. Usage: <VcSelect v-combobox-name="settingTitle(s)" ... />
 */
export const vComboboxName: Directive<HTMLElement, string | undefined> = {
  mounted: name,
  updated: name,
};

function name(el: HTMLElement, binding: { value: string | undefined }) {
  const box = el.matches('[role="combobox"]') ? el : el.querySelector<HTMLElement>('[role="combobox"]');
  if (!box) return;
  if (binding.value) box.setAttribute("aria-label", binding.value);
  else box.removeAttribute("aria-label");
}
