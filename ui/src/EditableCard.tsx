import type React from "react";

import {Badge} from "./Badge";
import {Box} from "./Box";
import {Card} from "./Card";
import type {EditableCardProps} from "./Common";
import {Icon} from "./Icon";
import {IconButton} from "./IconButton";
import {Text} from "./Text";

export const EditableCard = ({
  children,
  attention = false,
  badge,
  color,
  description,
  editAccessibilityLabel = "Edit",
  helperText,
  iconName,
  onEdit,
  padding = 3,
  title,
  ...rest
}: EditableCardProps): React.ReactElement => {
  return (
    <Card
      borderLeft="default"
      borderRight="default"
      color={color ?? (attention ? "secondaryExtraLight" : "base")}
      direction="row"
      gap={2}
      padding={padding}
      rounding="md"
      width="100%"
      {...rest}
    >
      {Boolean(iconName) && (
        <Box paddingY={1}>
          <Icon iconName={iconName!} size="md" />
        </Box>
      )}
      <Box direction="column" flex="grow" gap={1} minWidth={0}>
        {(Boolean(title) || Boolean(badge)) && (
          <Box alignItems="center" direction="row" gap={2}>
            {Boolean(title) && (
              <Box flex="shrink" minWidth={0}>
                <Text bold size="md" truncate>
                  {title}
                </Text>
              </Box>
            )}
            {Boolean(badge) && <Badge {...badge!} />}
          </Box>
        )}
        {Boolean(description) && <Text size="md">{description}</Text>}
        {Boolean(helperText) && (
          <Text color="secondaryLight" size="sm">
            {helperText}
          </Text>
        )}
        {children}
      </Box>
      {Boolean(onEdit) && (
        <IconButton
          accessibilityLabel={editAccessibilityLabel}
          iconName="pencil"
          onClick={onEdit!}
          variant="ghost"
        />
      )}
    </Card>
  );
};
