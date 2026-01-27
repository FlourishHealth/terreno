import {Box, Button, type ButtonProps, Heading} from "@terreno/ui";

export const ButtonDemo = (props: Partial<ButtonProps>) => {
  return (
    <Box alignItems="center" justifyContent="center">
      <Button iconName="plus" onClick={() => console.info("clicked")} text="Button" {...props} />
    </Box>
  );
};

export const ButtonVariants = (props: Partial<ButtonProps>) => {
  return (
    <>
      <Box direction="row" wrap>
        <Box padding={1}>
          <Button onClick={() => console.info("clicked")} text="Default/Primary" {...props} />
        </Box>
        <Box padding={1}>
          <Button
            onClick={() => console.info("clicked")}
            text="Secondary"
            variant="secondary"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            onClick={() => console.info("clicked")}
            text="Outline"
            variant="outline"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            onClick={() => console.info("clicked")}
            text="Destructive"
            variant="destructive"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button onClick={() => console.info("clicked")} text="Muted" variant="muted" {...props} />
        </Box>
        <Box padding={1}>
          <Button disabled onClick={() => console.info("clicked")} text="Disabled" {...props} />
        </Box>
      </Box>
      <Box direction="column" paddingX={1} paddingY={4}>
        <Heading>Disabled Variants</Heading>
      </Box>
      <Box direction="row" wrap>
        <Box padding={1}>
          <Button
            disabled
            onClick={() => console.info("clicked")}
            text="Default/Primary"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            disabled
            onClick={() => console.info("clicked")}
            text="Secondary"
            variant="secondary"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            disabled
            onClick={() => console.info("clicked")}
            text="Outline"
            variant="outline"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            disabled
            onClick={() => console.info("clicked")}
            text="Destructive"
            variant="destructive"
            {...props}
          />
        </Box>
        <Box padding={1}>
          <Button
            disabled
            onClick={() => console.info("clicked")}
            text="Muted"
            variant="muted"
            {...props}
          />
        </Box>
      </Box>
    </>
  );
};

export const ButtonIconPosition = () => {
  return (
    <Box direction="row" wrap>
      <Box padding={1}>
        <Button iconName="check" onClick={() => console.info("clicked")} text="Icon default" />
      </Box>
      <Box padding={1}>
        <Button
          iconName="check"
          iconPosition="right"
          onClick={() => console.info("clicked")}
          text="Icon Right"
        />
      </Box>
    </Box>
  );
};

export const ButtonLoading = () => {
  return (
    <Box direction="row" wrap>
      <Box padding={1}>
        <Button
          onClick={async () => {
            return new Promise((resolve) => {
              setTimeout(resolve, 2 * 1000);
            });
          }}
          text="Async Loading Button"
        />
      </Box>
      <Box padding={1}>
        <Button loading onClick={() => console.info("clicked")} text="Is Loading" />
      </Box>
    </Box>
  );
};

export const ConfirmationButton = () => {
  return (
    <Box>
      <Box paddingX={3} paddingY={3}>
        <Button
          onClick={() => console.info("clicked")}
          text="Default Confirmation Modal"
          withConfirmation
        />
      </Box>
      <Box paddingX={3} paddingY={1}>
        <Button
          confirmationText="And some custom text body!"
          modalTitle="A Custom Title"
          onClick={() => console.info("clicked")}
          text="With Custom Modal Props"
          withConfirmation
        />
      </Box>
    </Box>
  );
};

export const FullWidthButtons = (props: Partial<ButtonProps>) => {
  return (
    <>
      <Box paddingY={1}>
        <Button
          onClick={() => console.info("clicked")}
          text="Default/Primary Full Width"
          {...props}
          fullWidth
        />
      </Box>
      <Box paddingY={1}>
        <Button
          onClick={() => console.info("clicked")}
          text="Full Width with tooltip"
          tooltipText="This is a tooltip"
          {...props}
          fullWidth
        />
      </Box>
    </>
  );
};

export const MultilineButtons = () => (
  <Box direction="row" wrap>
    <Box maxWidth={400} padding={1}>
      <Button onClick={() => {}} text={"Here is some text\nAnd a second line"} />
    </Box>
    <Box maxWidth={400} padding={1}>
      <Button
        iconName="plus"
        onClick={() => {}}
        text={"Here is some text and \nA second line with an icon"}
      />
    </Box>
  </Box>
);

export const ButtonWidthInLayouts = () => (
  <Box gap={4}>
    <Box gap={2}>
      <Heading>Buttons in Column Layout (default width)</Heading>
      <Box color="secondary" direction="column" gap={2} padding={2}>
        <Button onClick={() => {}} text="Button 1" />
        <Button onClick={() => {}} text="Longer Button 2" />
        <Button onClick={() => {}} text="Button 3" variant="secondary" />
      </Box>
    </Box>

    <Box gap={2}>
      <Heading>Buttons in Column Layout (fullWidth)</Heading>
      <Box color="secondary" direction="column" gap={2} padding={2}>
        <Button fullWidth onClick={() => {}} text="Button 1" />
        <Button fullWidth onClick={() => {}} text="Longer Button 2" />
        <Button fullWidth onClick={() => {}} text="Button 3" variant="secondary" />
      </Box>
    </Box>

    <Box gap={2}>
      <Heading>Buttons in Row Layout</Heading>
      <Box color="secondary" direction="row" gap={2} padding={2}>
        <Button onClick={() => {}} text="Button 1" />
        <Button onClick={() => {}} text="Longer Button 2" />
        <Button onClick={() => {}} text="Button 3" variant="secondary" />
      </Box>
    </Box>
  </Box>
);
