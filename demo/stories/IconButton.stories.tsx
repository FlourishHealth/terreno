import {Box, IconButton, type IconButtonProps, Text} from "ferns-ui";

export const IconButtonDemo = (props: Partial<IconButtonProps>) => {
  return (
    <Box alignItems="center" justifyContent="center">
      <IconButton
        accessibilityLabel="Demo IconButton"
        iconName="lightbulb"
        onClick={() => console.info("clicked")}
        {...props}
      />
    </Box>
  );
};

export const ConfirmationIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box padding={4}>
      <IconButton
        accessibilityLabel="add item"
        iconName="plus"
        onClick={() => {
          console.info("Clicked!");
        }}
        withConfirmation
        {...props}
      />
    </Box>
  );
};

export const ToolTipIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box direction="row" padding={4} wrap>
      <Box marginRight={1}>
        <IconButton
          accessibilityLabel=""
          iconName="trash"
          onClick={() => {
            console.info("Click delete");
          }}
          tooltipIdealPosition="bottom"
          tooltipText="Delete Demo"
          {...props}
        />
      </Box>
      <IconButton
        accessibilityLabel=""
        iconName="floppy-disk"
        onClick={() => {
          console.info("Click delete");
        }}
        tooltipIdealPosition="top"
        tooltipIncludeArrow
        tooltipText="Save With Arrow Demo"
        {...props}
      />
    </Box>
  );
};

export const LoadingIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box direction="row" wrap>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="plus"
          onClick={async () => {
            return new Promise((resolve) => {
              setTimeout(resolve, 2 * 1000);
            });
          }}
          {...props}
        />
      </Box>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="plus"
          loading
          onClick={async () => {
            return new Promise((resolve) => {
              setTimeout(resolve, 2 * 1000);
            });
          }}
          {...props}
        />
      </Box>
    </Box>
  );
};

export const IndicatorIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box direction="row" wrap>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="plus"
          indicator="primary"
          indicatorText="2"
          onClick={() => {}}
          {...props}
        />
      </Box>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="plus"
          indicator="error"
          onClick={() => {}}
          {...props}
        />
      </Box>
    </Box>
  );
};

export const NavigationIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box direction="row" wrap>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="house"
          indicator="primary"
          indicatorText="2"
          onClick={() => {}}
          variant="navigation"
          {...props}
        />
      </Box>
      <Box padding={4}>
        <IconButton
          accessibilityLabel="add item"
          iconName="triangle-exclamation"
          indicator="error"
          indicatorText="8"
          onClick={() => {}}
          variant="navigation"
          {...props}
        />
      </Box>
    </Box>
  );
};

export const DisabledIconButton = (props: Partial<IconButtonProps>) => {
  return (
    <Box padding={4}>
      <IconButton
        accessibilityLabel="add item"
        disabled
        iconName="plus"
        onClick={() => {}}
        {...props}
      />
    </Box>
  );
};

export const AllButtonIconVariants = (props: Partial<IconButtonProps>) => {
  return (
    <Box direction="row" wrap>
      <Box alignItems="center" paddingX={2}>
        <Text>Primary</Text>
        <Box padding={1}>
          <IconButton
            accessibilityLabel="add item"
            iconName="plus"
            onClick={() => console.info("clicked")}
            {...props}
          />
        </Box>
      </Box>
      <Box alignItems="center" paddingX={2}>
        <Text>Secondary</Text>
        <Box padding={1}>
          <IconButton
            accessibilityLabel="add item"
            iconName="plus"
            onClick={() => console.info("clicked")}
            variant="secondary"
            {...props}
          />
        </Box>
      </Box>
      <Box alignItems="center" paddingX={2}>
        <Text>Muted</Text>
        <Box padding={1}>
          <IconButton
            accessibilityLabel="add item"
            iconName="plus"
            onClick={() => console.info("clicked")}
            variant="muted"
            {...props}
          />
        </Box>
      </Box>
      <Box alignItems="center" paddingX={2}>
        <Text>Destructive</Text>
        <Box padding={1}>
          <IconButton
            accessibilityLabel="remove item"
            iconName="trash"
            onClick={() => console.info("clicked")}
            variant="destructive"
            {...props}
          />
        </Box>
      </Box>
      <Box alignItems="center" paddingX={2}>
        <Text>Disabled</Text>
        <IconButton
          accessibilityLabel="add item"
          disabled
          iconName="plus"
          onClick={() => {}}
          {...props}
        />
      </Box>
    </Box>
  );
};
