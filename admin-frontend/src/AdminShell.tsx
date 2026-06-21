import {Box, Heading, Spinner, Text, useTheme} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";
import {type AdminBreadcrumbSegment, AdminBreadcrumbs} from "./AdminBreadcrumbs";
import {groupAdminModelsByGroup} from "./adminShellNav";
import type {AdminApi, AdminCustomScreen, AdminModelConfig} from "./types";
import {resolveAdminBases} from "./types";
import {useAdminConfig} from "./useAdminConfig";

/** Sidebar chrome: matches Flourish admin v2 prototype (`adminv2` HTML shell). */
export type AdminShellSidebarVariant = "clinical" | "colorful";

export interface AdminShellProps {
  /** @deprecated Use `apiBase`/`routeBase`. */
  baseUrl?: string;
  api: AdminApi;
  apiBase?: string;
  /** Breadcrumb segments for the top bar */
  breadcrumbs?: AdminBreadcrumbSegment[];
  /** Path to configuration screen (e.g. "/configuration") */
  configurationPath?: string;
  /** Path to version / build metadata screen. Default matches admin-spa's `/version-config` route. */
  versionConfigPath?: string;
  /** Main column content */
  children: React.ReactNode;
  /** Optional footer (e.g. signed-in user) */
  footer?: React.ReactNode;
  /** Optional right side of the top bar (e.g. primary action for the current screen). */
  headerActions?: React.ReactNode;
  routeBase?: string;
  /** Extra custom screens merged with backend config for nav cards */
  customScreens?: AdminCustomScreen[];
  /** Sidebar look: `colorful` (teal rail) vs `clinical` (light bordered rail). */
  sidebarVariant?: AdminShellSidebarVariant;
}

const NavButton: React.FC<{
  label: string;
  onPress: () => void;
  sidebarVariant: AdminShellSidebarVariant;
  testID?: string;
}> = ({label, onPress, sidebarVariant, testID}) => (
  <Box
    accessibilityHint={`Open ${label}`}
    accessibilityLabel={label}
    onClick={onPress}
    padding={1}
    testID={testID}
  >
    <Text color={sidebarVariant === "colorful" ? "inverted" : "link"} size="sm">
      {label}
    </Text>
  </Box>
);

/**
 * Admin UI v2 shell: grouped sidebar navigation, optional breadcrumbs, and main area.
 *
 * Intended for standalone admin SPA or embedded admin: pair with list/table/form screens
 * as `children`. Fetches `/admin/config` once for the sidebar (Tools, grouped Models, Screens).
 *
 * For Expo Router admin roots, prefer {@link AdminShellLayout}: it wraps `children` in a flex
 * main column so a nested `<Stack />` fills the area beside the sidebar without repeating layout
 * boilerplate in each app.
 */
export const AdminShell: React.FC<AdminShellProps> = ({
  api,
  apiBase,
  baseUrl,
  breadcrumbs,
  children,
  configurationPath,
  customScreens: propCustomScreens,
  footer,
  headerActions,
  routeBase,
  sidebarVariant = "colorful",
  versionConfigPath = "/version-config",
}) => {
  const {theme} = useTheme();
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {config, error, isLoading} = useAdminConfig(api, resolvedApiBase);

  const navigate = useCallback(
    (path: string) => {
      const prefix = resolvedRouteBase.endsWith("/")
        ? resolvedRouteBase.slice(0, -1)
        : resolvedRouteBase;
      const normalized = path.startsWith("/") ? path : `/${path}`;
      const href = `${prefix}${normalized}` as Href;
      router.push(href);
    },
    [resolvedRouteBase]
  );

  if (isLoading) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        justifyContent="center"
        padding={6}
        testID="admin-shell-loading"
      >
        <Spinner />
      </Box>
    );
  }

  if (error || !config) {
    return (
      <Box padding={4} testID="admin-shell-error">
        <Text color="error">Failed to load admin configuration.</Text>
      </Box>
    );
  }

  const backendScreens = config.customScreens ?? [];
  const allCustomScreens = [...backendScreens, ...(propCustomScreens ?? [])];
  const scripts = config.scripts ?? [];
  const grouped = groupAdminModelsByGroup(config.models as AdminModelConfig[]);

  const sidebarIsColorful = sidebarVariant === "colorful";
  const sectionLabelColor = sidebarIsColorful ? "inverted" : "secondaryDark";

  const showTopBar = Boolean(headerActions) || Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <Box direction="row" flex="grow" minHeight="100%" testID="admin-shell">
      <Box
        border={sidebarIsColorful ? undefined : "default"}
        color={sidebarIsColorful ? "secondaryDark" : "base"}
        direction="column"
        gap={3}
        padding={3}
        testID="admin-shell-sidebar"
        width={280}
      >
        <Heading {...(sidebarIsColorful ? {color: "inverted"} : {})} size="sm">
          Admin
        </Heading>
        <Box direction="column" flex="grow" gap={3} minHeight={0}>
          <NavButton
            label="Home"
            onPress={() => {
              navigate("/");
            }}
            sidebarVariant={sidebarVariant}
            testID="admin-shell-nav-home"
          />
          <Box direction="column" gap={1}>
            <Text bold color={sectionLabelColor} size="sm">
              Tools
            </Text>
            {scripts.map((script) => (
              <NavButton
                key={script.name}
                label={script.name}
                onPress={() => {
                  navigate("/__scripts");
                }}
                sidebarVariant={sidebarVariant}
                testID={`admin-shell-nav-tool-${script.name}`}
              />
            ))}
            <NavButton
              label="Version"
              onPress={() => {
                navigate(versionConfigPath);
              }}
              sidebarVariant={sidebarVariant}
              testID="admin-shell-nav-version"
            />
          </Box>
          <Box direction="column" gap={1}>
            <Text bold color={sectionLabelColor} size="sm">
              Models
            </Text>
            {grouped.map(({group, models}) => (
              <Box direction="column" gap={1} key={group}>
                <Text bold color={sectionLabelColor} size="sm">
                  {group}
                </Text>
                {models.map((model) => (
                  <NavButton
                    key={model.name}
                    label={model.displayName}
                    onPress={() => {
                      navigate(`/${model.name}`);
                    }}
                    sidebarVariant={sidebarVariant}
                    testID={`admin-shell-nav-model-${model.name}`}
                  />
                ))}
              </Box>
            ))}
          </Box>
          {allCustomScreens.length > 0 ? (
            <Box direction="column" gap={1}>
              <Text bold color={sectionLabelColor} size="sm">
                Screens
              </Text>
              {allCustomScreens.map((screen) => (
                <NavButton
                  key={screen.name}
                  label={screen.displayName}
                  onPress={() => {
                    navigate(`/${screen.name}`);
                  }}
                  sidebarVariant={sidebarVariant}
                  testID={`admin-shell-nav-screen-${screen.name}`}
                />
              ))}
            </Box>
          ) : null}
          {configurationPath ? (
            <NavButton
              label="Configuration"
              onPress={() => {
                router.push(configurationPath as Href);
              }}
              sidebarVariant={sidebarVariant}
              testID="admin-shell-nav-configuration"
            />
          ) : null}
        </Box>
        {footer ? <Box marginTop={4}>{footer}</Box> : null}
      </Box>
      <Box
        dangerouslySetInlineStyle={{
          __style: {backgroundColor: theme.primitives.neutral050},
        }}
        direction="column"
        flex="grow"
        minWidth={0}
      >
        {showTopBar ? (
          <Box
            alignItems="center"
            borderBottom="default"
            color="base"
            dangerouslySetInlineStyle={{
              __style: {
                paddingBottom: 12,
                paddingLeft: 28,
                paddingRight: 28,
                paddingTop: 12,
              },
            }}
            direction="row"
            justifyContent="between"
            minWidth={0}
            testID="admin-shell-top-bar"
          >
            <Box flex="grow" minWidth={0}>
              {breadcrumbs && breadcrumbs.length > 0 ? (
                <AdminBreadcrumbs segments={breadcrumbs} />
              ) : (
                <Box />
              )}
            </Box>
            {headerActions ? (
              <Box flex="shrink" marginLeft={3}>
                {headerActions}
              </Box>
            ) : null}
          </Box>
        ) : null}
        <Box alignItems="stretch" flex="grow" minHeight={0} testID="admin-shell-main" width="100%">
          <Box
            alignSelf="center"
            dangerouslySetInlineStyle={{
              __style: {
                boxSizing: "border-box",
                maxWidth: 1280,
                padding: "24px 28px 80px",
                width: "100%",
              },
            }}
            flex="grow"
            minHeight={0}
            width="100%"
          >
            <Box flex="grow" minHeight={0}>
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
