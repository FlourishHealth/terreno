import {Box, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";

export interface AdminBreadcrumbSegment {
  /** Path for expo-router (e.g. "/", "/FeatureFlag", "/__scripts") */
  href?: string;
  label: string;
}

export interface AdminBreadcrumbsProps {
  segments: AdminBreadcrumbSegment[];
}

/**
 * Compact breadcrumb row for the admin shell top bar.
 */
export const AdminBreadcrumbs: React.FC<AdminBreadcrumbsProps> = ({segments}) => {
  const handleCrumbPress = useCallback((href: string) => {
    router.push(href as Href);
  }, []);

  if (segments.length === 0) {
    return null;
  }

  return (
    <Box alignItems="center" direction="row" gap={2} testID="admin-breadcrumbs">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <Box alignItems="center" direction="row" gap={2} key={`${segment.label}-${index}`}>
            {index > 0 ? (
              <Text color="secondaryDark" size="sm" testID={`admin-breadcrumb-sep-${index}`}>
                /
              </Text>
            ) : null}
            {segment.href && !isLast ? (
              <Box
                accessibilityHint={`Navigate to ${segment.label}`}
                accessibilityLabel={segment.label}
                onClick={() => {
                  handleCrumbPress(segment.href as string);
                }}
                padding={1}
                testID={`admin-breadcrumb-link-${index}`}
              >
                <Text color="link" size="sm">
                  {segment.label}
                </Text>
              </Box>
            ) : (
              <Text bold={isLast} size="sm">
                {segment.label}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
