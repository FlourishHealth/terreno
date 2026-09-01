import {Box, Heading, Icon, Spinner, Text, useTheme} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback, useEffect, useState} from "react";
import {useWindowDimensions} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {type AdminBreadcrumbSegment, AdminBreadcrumbs} from "./AdminBreadcrumbs";
import {isAdminPageForbiddenError} from "./adminPageAccess";
import {
  adminScreenGroupTestId,
  groupAdminCustomScreens,
  groupAdminModelsByGroup,
} from "./adminShellNav";
import type {AdminApi, AdminConfigResponse, AdminCustomScreen, AdminModelConfig} from "./types";
import {resolveAdminBases} from "./types";
import {useAdminConfig} from "./useAdminConfig";

/** Sidebar chrome: matches Flourish admin v2 prototype (`adminv2` HTML shell). */
export type AdminShellSidebarVariant = "clinical" | "colorful";

/** Viewport widths below this use the hamburger + drawer navigation. */
export const ADMIN_SHELL_MOBILE_BREAKPOINT = 768;

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
  /** Path to RBAC roles screen (e.g. "/roles") */
  rolesPath?: string;
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

const isAuditLogModel = (model: AdminModelConfig): boolean => {
  return model.name === "AdminAuditLog" || model.routePath.includes("audit-log");
};

const isFeatureFlagModel = (model: AdminModelConfig): boolean => {
  return model.name === "FeatureFlag" || model.displayName === "Feature Flags";
};

interface AdminShellSidebarNavProps {
  allCustomScreens: AdminCustomScreen[];
  configurationPath?: string;
  footer?: React.ReactNode;
  grouped: ReturnType<typeof groupAdminModelsByGroup>;
  navigate: (path: string) => void;
  onNavigate?: () => void;
  platformTools: NonNullable<AdminConfigResponse["platformTools"]>;
  rolesPath?: string;
  scripts: {name: string}[];
  sidebarVariant: AdminShellSidebarVariant;
  versionConfigPath: string;
}

const AdminShellSidebarNav: React.FC<AdminShellSidebarNavProps> = ({
  allCustomScreens,
  configurationPath,
  footer,
  grouped,
  navigate,
  onNavigate,
  platformTools,
  rolesPath,
  scripts,
  sidebarVariant,
  versionConfigPath,
}) => {
  const sidebarIsColorful = sidebarVariant === "colorful";
  const sectionLabelColor = sidebarIsColorful ? "inverted" : "secondaryDark";
  const models = grouped.flatMap(({models: groupModels}) => groupModels);
  const auditLogModel = models.find(isAuditLogModel);
  const featureFlagModel = models.find(isFeatureFlagModel);
  const {grouped: groupedScreens, ungrouped: ungroupedScreens} =
    groupAdminCustomScreens(allCustomScreens);
  const visibleGrouped = grouped
    .map(({group, models: groupModels}) => ({
      group,
      models: groupModels.filter((model) => !isAuditLogModel(model) && !isFeatureFlagModel(model)),
    }))
    .filter(({models: groupModels}) => groupModels.length > 0);
  const hasPlatformLinks = Boolean(
    (platformTools.scripts && scripts.length > 0) ||
      (platformTools.roles && rolesPath) ||
      (platformTools.version && versionConfigPath) ||
      auditLogModel ||
      featureFlagModel ||
      (platformTools.configuration && configurationPath)
  );

  const runNav = useCallback(
    (action: () => void): void => {
      action();
      onNavigate?.();
    },
    [onNavigate]
  );

  return (
    <>
      <Box direction="column" flex="grow" gap={4} minHeight={0} overflow="scrollY">
        <Box direction="column">
          <NavButton
            label="Home"
            onPress={() => {
              runNav(() => {
                navigate("/");
              });
            }}
            sidebarVariant={sidebarVariant}
            testID="admin-shell-nav-home"
          />
        </Box>
        {visibleGrouped.length > 0 ? (
          <Box direction="column" gap={3} testID="admin-shell-nav-models">
            <Text bold color={sectionLabelColor} size="sm">
              Models
            </Text>
            {visibleGrouped.map(({group, models: groupModels}) => (
              <Box direction="column" gap={1} key={group}>
                <Text bold color={sectionLabelColor} size="sm">
                  {group}
                </Text>
                {groupModels.map((model) => (
                  <NavButton
                    key={model.name}
                    label={model.displayName}
                    onPress={() => {
                      runNav(() => {
                        navigate(`/${model.name}`);
                      });
                    }}
                    sidebarVariant={sidebarVariant}
                    testID={`admin-shell-nav-model-${model.name}`}
                  />
                ))}
              </Box>
            ))}
          </Box>
        ) : null}
        {groupedScreens.map(({group, screens}) => (
          <Box direction="column" gap={1} key={group} testID={adminScreenGroupTestId(group)}>
            <Text bold color={sectionLabelColor} size="sm">
              {group}
            </Text>
            {screens.map((screen) => (
              <NavButton
                key={screen.name}
                label={screen.displayName}
                onPress={() => {
                  runNav(() => {
                    navigate(`/${screen.name}`);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID={`admin-shell-nav-screen-${screen.name}`}
              />
            ))}
          </Box>
        ))}
        {ungroupedScreens.length > 0 ? (
          <Box direction="column" gap={1} testID="admin-shell-nav-screens">
            <Text bold color={sectionLabelColor} size="sm">
              Screens
            </Text>
            {ungroupedScreens.map((screen) => (
              <NavButton
                key={screen.name}
                label={screen.displayName}
                onPress={() => {
                  runNav(() => {
                    navigate(`/${screen.name}`);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID={`admin-shell-nav-screen-${screen.name}`}
              />
            ))}
          </Box>
        ) : null}
        <Box flex="grow" />
        {hasPlatformLinks ? (
          <Box direction="column" gap={1} testID="admin-shell-nav-platform">
            <Text bold color={sectionLabelColor} size="sm">
              Platform
            </Text>
            {platformTools.scripts && scripts.length > 0 ? (
              <NavButton
                label="Scripts"
                onPress={() => {
                  runNav(() => {
                    navigate("/__scripts");
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-scripts"
              />
            ) : null}
            {platformTools.roles && rolesPath ? (
              <NavButton
                label="Roles"
                onPress={() => {
                  runNav(() => {
                    navigate(rolesPath);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-roles"
              />
            ) : null}
            {platformTools.version && versionConfigPath ? (
              <NavButton
                label="Version"
                onPress={() => {
                  runNav(() => {
                    navigate(versionConfigPath);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-version"
              />
            ) : null}
            {auditLogModel ? (
              <NavButton
                label="Audit Log"
                onPress={() => {
                  runNav(() => {
                    navigate(`/${auditLogModel.name}`);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-audit-log"
              />
            ) : null}
            {featureFlagModel ? (
              <NavButton
                label="Feature Flags"
                onPress={() => {
                  runNav(() => {
                    navigate(`/${featureFlagModel.name}`);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-feature-flags"
              />
            ) : null}
            {platformTools.configuration && configurationPath ? (
              <NavButton
                label="Configuration"
                onPress={() => {
                  runNav(() => {
                    router.push(configurationPath as Href);
                  });
                }}
                sidebarVariant={sidebarVariant}
                testID="admin-shell-nav-configuration"
              />
            ) : null}
          </Box>
        ) : null}
      </Box>
      {footer ? <Box marginTop={4}>{footer}</Box> : null}
    </>
  );
};

/**
 * Admin UI v2 shell: grouped sidebar navigation, optional breadcrumbs, and main area.
 *
 * Intended for standalone admin SPA or embedded admin: pair with list/table/form screens
 * as `children`. Fetches `/admin/config` once for the sidebar (Tools, grouped Models, Screens).
 *
 * Below {@link ADMIN_SHELL_MOBILE_BREAKPOINT}px, the fixed sidebar becomes a hamburger-triggered
 * left slide-over drawer.
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
  rolesPath,
  routeBase,
  sidebarVariant = "colorful",
  versionConfigPath = "/version-config",
}) => {
  const {theme} = useTheme();
  const {width: windowWidth} = useWindowDimensions();
  const isMobileLayout = windowWidth < ADMIN_SHELL_MOBILE_BREAKPOINT;
  const [isNavOpen, setIsNavOpen] = useState(false);
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

  const closeNav = useCallback((): void => {
    setIsNavOpen(false);
  }, []);

  const openNav = useCallback((): void => {
    setIsNavOpen(true);
  }, []);

  // Close the mobile drawer when the viewport returns to desktop width.
  useEffect(() => {
    if (!isMobileLayout && isNavOpen) {
      setIsNavOpen(false);
    }
  }, [isMobileLayout, isNavOpen]);

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
    if (isAdminPageForbiddenError(error)) {
      return (
        <Box padding={4} testID="admin-shell-forbidden">
          <Text color="error">
            You do not have permission to open the admin page. Grant the admin:access permission.
          </Text>
        </Box>
      );
    }
    return (
      <Box padding={4} testID="admin-shell-error">
        <Text color="error">Failed to load admin configuration.</Text>
      </Box>
    );
  }

  const backendScreens = config.customScreens ?? [];
  const allCustomScreens = config.platformTools
    ? backendScreens
    : [...backendScreens, ...(propCustomScreens ?? [])];
  const scripts = config.scripts ?? [];
  const platformTools = config.platformTools ?? {
    configuration: true,
    roles: true,
    scripts: true,
    version: true,
  };
  const grouped = groupAdminModelsByGroup(config.models as AdminModelConfig[]);

  const sidebarIsColorful = sidebarVariant === "colorful";
  const showTopBar = Boolean(headerActions) || Boolean(breadcrumbs && breadcrumbs.length > 0);

  const sidebarNavProps: AdminShellSidebarNavProps = {
    allCustomScreens,
    configurationPath,
    footer,
    grouped,
    navigate,
    platformTools,
    rolesPath,
    scripts,
    sidebarVariant,
    versionConfigPath,
  };

  const sidebarChromeProps = {
    border: sidebarIsColorful ? undefined : ("default" as const),
    color: sidebarIsColorful ? ("secondaryDark" as const) : ("base" as const),
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{flex: 1}}>
      <Box
        dangerouslySetInlineStyle={{
          __style: {position: "relative"},
        }}
        direction="row"
        flex="grow"
        minHeight="100%"
        testID="admin-shell"
      >
        {!isMobileLayout ? (
          <Box
            {...sidebarChromeProps}
            direction="column"
            gap={3}
            padding={3}
            testID="admin-shell-sidebar"
            width={280}
          >
            <Heading {...(sidebarIsColorful ? {color: "inverted"} : {})} size="sm">
              Admin
            </Heading>
            <AdminShellSidebarNav {...sidebarNavProps} />
          </Box>
        ) : null}
        <Box
          dangerouslySetInlineStyle={{
            __style: {backgroundColor: theme.primitives.neutral050},
          }}
          direction="column"
          flex="grow"
          minWidth={0}
        >
          {isMobileLayout ? (
            <Box
              alignItems="center"
              borderBottom="default"
              color="base"
              direction="row"
              gap={2}
              padding={2}
              testID="admin-shell-mobile-header"
            >
              <Box
                accessibilityHint="Opens the admin navigation menu"
                accessibilityLabel="Open navigation menu"
                onClick={openNav}
                padding={1}
                testID="admin-shell-menu-button"
              >
                <Icon color="primary" iconName="bars" size="md" />
              </Box>
              <Heading size="sm">Admin</Heading>
            </Box>
          ) : null}
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
          <Box
            alignItems="stretch"
            flex="grow"
            minHeight={0}
            testID="admin-shell-main"
            width="100%"
          >
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
        {isMobileLayout && isNavOpen ? (
          <Box
            dangerouslySetInlineStyle={{
              __style: {
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
                zIndex: 1000,
              },
            }}
            direction="row"
            testID="admin-shell-drawer"
          >
            <Box
              {...sidebarChromeProps}
              direction="column"
              gap={3}
              padding={3}
              testID="admin-shell-drawer-panel"
              width={280}
            >
              <Box alignItems="center" direction="row" justifyContent="between">
                <Heading {...(sidebarIsColorful ? {color: "inverted"} : {})} size="sm">
                  Admin
                </Heading>
                <Box
                  accessibilityHint="Closes the admin navigation menu"
                  accessibilityLabel="Close navigation menu"
                  onClick={closeNav}
                  padding={1}
                  testID="admin-shell-drawer-close"
                >
                  <Icon
                    color={sidebarIsColorful ? "inverted" : "primary"}
                    iconName="xmark"
                    size="md"
                  />
                </Box>
              </Box>
              <AdminShellSidebarNav {...sidebarNavProps} onNavigate={closeNav} />
            </Box>
            <Box
              accessibilityHint="Dismisses the navigation menu"
              accessibilityLabel="Dismiss navigation menu"
              dangerouslySetInlineStyle={{
                __style: {backgroundColor: "rgba(0, 0, 0, 0.45)", flex: 1},
              }}
              flex="grow"
              onClick={closeNav}
              testID="admin-shell-drawer-backdrop"
            />
          </Box>
        ) : null}
      </Box>
    </SafeAreaView>
  );
};
