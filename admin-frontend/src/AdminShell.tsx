import {Box, Heading, Spinner, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";
import {type AdminBreadcrumbSegment, AdminBreadcrumbs} from "./AdminBreadcrumbs";
import {groupAdminModelsByGroup} from "./adminShellNav";
import type {AdminApi, AdminCustomScreen, AdminModelConfig} from "./types";
import {resolveAdminBases} from "./types";
import {useAdminConfig} from "./useAdminConfig";

export interface AdminShellProps {
  /** @deprecated Use `apiBase`/`routeBase`. */
  baseUrl?: string;
  api: AdminApi;
  apiBase?: string;
  /** Breadcrumb segments for the top bar */
  breadcrumbs?: AdminBreadcrumbSegment[];
  /** Path to configuration screen (e.g. "/configuration") */
  configurationPath?: string;
  /** Main column content */
  children: React.ReactNode;
  /** Optional footer (e.g. signed-in user) */
  footer?: React.ReactNode;
  routeBase?: string;
  /** Extra custom screens merged with backend config for nav cards */
  customScreens?: AdminCustomScreen[];
}

const NavButton: React.FC<{
  label: string;
  onPress: () => void;
  testID?: string;
}> = ({label, onPress, testID}) => (
  <Box
    accessibilityHint={`Open ${label}`}
    accessibilityLabel={label}
    onClick={onPress}
    padding={1}
    testID={testID}
  >
    <Text color="link" size="sm">
      {label}
    </Text>
  </Box>
);

/**
 * Admin UI v2 shell: grouped sidebar navigation, optional breadcrumbs, and main area.
 *
 * Intended for standalone admin SPA or embedded admin: pair with list/table/form screens
 * as `children`. Fetches `/admin/config` once for the sidebar.
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
  routeBase,
}) => {
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

  return (
    <Box direction="row" flex="grow" minHeight="100%" testID="admin-shell">
      <Box
        border="default"
        direction="column"
        gap={3}
        padding={3}
        testID="admin-shell-sidebar"
        width={260}
      >
        <Heading size="sm">Admin</Heading>
        <Box direction="column" flex="grow" gap={3} minHeight={0}>
          <NavButton
            label="Home"
            onPress={() => {
              navigate("/");
            }}
            testID="admin-shell-nav-home"
          />
          {grouped.map(({group, models}) => (
            <Box direction="column" gap={1} key={group}>
              <Text bold color="secondaryDark" size="sm">
                {group}
              </Text>
              {models.map((model) => (
                <NavButton
                  key={model.name}
                  label={model.displayName}
                  onPress={() => {
                    navigate(`/${model.name}`);
                  }}
                  testID={`admin-shell-nav-model-${model.name}`}
                />
              ))}
            </Box>
          ))}
          {allCustomScreens.length > 0 ? (
            <Box direction="column" gap={1}>
              <Text bold color="secondaryDark" size="sm">
                Screens
              </Text>
              {allCustomScreens.map((screen) => (
                <NavButton
                  key={screen.name}
                  label={screen.displayName}
                  onPress={() => {
                    navigate(`/${screen.name}`);
                  }}
                  testID={`admin-shell-nav-screen-${screen.name}`}
                />
              ))}
            </Box>
          ) : null}
          {scripts.length > 0 ? (
            <NavButton
              label="Scripts"
              onPress={() => {
                navigate("/__scripts");
              }}
              testID="admin-shell-nav-scripts"
            />
          ) : null}
          {configurationPath ? (
            <NavButton
              label="Configuration"
              onPress={() => {
                router.push(configurationPath as Href);
              }}
              testID="admin-shell-nav-configuration"
            />
          ) : null}
        </Box>
        {footer ? <Box marginTop={4}>{footer}</Box> : null}
      </Box>
      <Box direction="column" flex="grow" minWidth={0}>
        {breadcrumbs && breadcrumbs.length > 0 ? <AdminBreadcrumbs segments={breadcrumbs} /> : null}
        <Box flex="grow" minHeight={0} testID="admin-shell-main">
          {children}
        </Box>
      </Box>
    </Box>
  );
};
