import { RouteLocationNormalized, RouteRecordRaw } from "vue-router";
import { defineComponent, h, type Component } from "vue";
import App from "../pages/App.vue";
import AuthShell from "../pages/AuthShell.vue";
import Login from "../pages/Login.vue";
import TwoFactorSignIn from "../pages/TwoFactorSignIn.vue";
import AccessDenied from "../pages/AccessDenied.vue";
import FramePage from "../pages/FramePage.vue";
import Dashboard from "../pages/Dashboard.vue";
import { Invite, ResetPassword, ForgotPassword, ChangePasswordPage } from "@vc-shell/framework";
import whiteLogoImage from "/assets/logo-white.svg";

// vc-shell's other auth pages inside the host's sign-in layout; the route props pass through to the page
const inAuthShell = (page: Component) =>
  defineComponent({
    inheritAttrs: false,
    setup: (_, { attrs }) => () => h(AuthShell, null, { default: () => h(page, attrs) }),
  });

// the invitation and password-reset links carry the user and a token
const tokenProps = (route: RouteLocationNormalized) => ({
  userId: route.query.userId,
  token: route.query.token,
  userName: route.query.userName,
  logo: whiteLogoImage,
});

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: App,
    name: "App",
    meta: {
      root: true,
    },
    children: [
      // Home: the Vue dashboard; modules contribute widgets with registerDashboardWidget
      { path: "", name: "Home", component: Dashboard },
      // AngularJS screens: shown by the persistent LegacyHost iframe over this page
      { path: "legacy", name: "Legacy", component: FramePage },
      { path: "app/:appId", name: "EmbeddedApp", component: FramePage },
    ],
  },
  {
    name: "Login",
    path: "/login",
    component: Login,
  },
  {
    // the code step of a password sign-in that the platform asks a second factor for (vc-module-mfa)
    name: "TwoFactorSignIn",
    path: "/sign-in-code",
    component: TwoFactorSignIn,
  },
  {
    // a signed-in user the platform's PlatformUI:Access rules keep out of the admin UI (shell/adminUIAccess.ts)
    name: "AccessDenied",
    path: "/access-denied",
    component: AccessDenied,
  },
  {
    name: "Invite",
    path: "/invite",
    component: inAuthShell(Invite),
    props: tokenProps,
  },
  {
    name: "ResetPassword",
    path: "/resetpassword",
    component: inAuthShell(ResetPassword),
    props: tokenProps,
  },
  {
    // the link in the platform's password-reset email: the AngularJS admin's route ("#!/resetpassword/{userId}/{token}"),
    // which reaches the shell when it is the only admin UI; the hash's "!" makes the path "/!/..."
    path: "/!/resetpassword/:userId/:token(.*)",
    redirect: (to) => ({ name: "ResetPassword", query: { userId: to.params.userId, token: to.params.token } }),
  },
  {
    name: "ForgotPassword",
    path: "/forgot-password",
    component: inAuthShell(ForgotPassword),
    props: () => ({
      logo: whiteLogoImage,
    }),
  },
  {
    name: "ChangePassword",
    path: "/changepassword",
    component: inAuthShell(ChangePasswordPage),
    meta: {
      forced: true,
    },
    props: (_route) => ({
      forced: _route.meta.forced,
      logo: whiteLogoImage,
    }),
  },
];
