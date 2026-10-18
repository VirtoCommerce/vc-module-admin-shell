// The dashboard grid (gridstack, in vc-shell's stylesheet) places its widgets itself with inline left/top and has its own
// right-to-left rules; a mirror of its rules would move every widget twice. Its rules are left out of the mirroring.
const keepGridstack = {
  postcssPlugin: "keep-gridstack-ltr",
  // before the mirroring, which reads the whole stylesheet once
  Once(root) {
    root.walkRules(/grid-stack|ui-resizable|ui-draggable/, (rule) => {
      if (rule.prev()?.text !== "rtl:ignore") rule.before({ text: "rtl:ignore" });
    });
  },
};

module.exports = {
  plugins: [
    require("tailwindcss"),
    keepGridstack,
    // right-to-left languages (ar, he, fa, ur): every left/right rule of the shell, Tailwind and vc-shell's stylesheet gets
    // its mirror under [dir="rtl"] (the shell sets dir on <html>, see src/locales/direction.ts). safeBothPrefix keeps the
    // cascade as written: a rule's direction-neutral declarations get the same prefix as its mirrored ones.
    require("postcss-rtlcss")({ mode: "combined", safeBothPrefix: true }),
    require("autoprefixer"),
  ],
};
