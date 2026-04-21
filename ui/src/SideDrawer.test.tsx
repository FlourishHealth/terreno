import {describe, expect, it, mock} from "bun:test";
import {Pressable, Text as RNText, View} from "react-native";

// Capture the props passed to Drawer so we can exercise the render callbacks.
let lastDrawerProps: any = null;
mock.module("react-native-drawer-layout", () => ({
  Drawer: (props: any) => {
    lastDrawerProps = props;
    return (
      <View testID="mock-drawer">
        {props.renderDrawerContent ? props.renderDrawerContent() : null}
        <Pressable onPress={props.onOpen} testID="mock-drawer-open">
          <RNText>open</RNText>
        </Pressable>
        <Pressable onPress={props.onClose} testID="mock-drawer-close">
          <RNText>close</RNText>
        </Pressable>
        {props.children}
      </View>
    );
  },
}));

import {SideDrawer} from "./SideDrawer";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("SideDrawer", () => {
  it("renders correctly when closed", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer isOpen={false} renderContent={() => <Text>Drawer content</Text>}>
        <Text>Main content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly when open", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer isOpen={true} renderContent={() => <Text>Drawer content</Text>}>
        <Text>Main content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with left position (default)", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer isOpen={true} position="left" renderContent={() => <Text>Left drawer</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right position", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer isOpen={true} position="right" renderContent={() => <Text>Right drawer</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with front drawer type (default)", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer drawerType="front" isOpen={true} renderContent={() => <Text>Front drawer</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with back drawer type", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer drawerType="back" isOpen={true} renderContent={() => <Text>Back drawer</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with slide drawer type", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer drawerType="slide" isOpen={true} renderContent={() => <Text>Slide drawer</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom drawer styles", () => {
    const {toJSON} = renderWithTheme(
      <SideDrawer
        drawerStyles={{width: "50%"}}
        isOpen={true}
        renderContent={() => <Text>Styled drawer</Text>}
      >
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts onOpen and onClose callbacks", () => {
    const handleOpen = mock(() => {});
    const handleClose = mock(() => {});
    const {toJSON} = renderWithTheme(
      <SideDrawer
        isOpen={false}
        onClose={handleClose}
        onOpen={handleOpen}
        renderContent={() => <Text>Drawer</Text>}
      >
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("invokes onOpen and onClose when Drawer triggers the callbacks", () => {
    const handleOpen = mock(() => {});
    const handleClose = mock(() => {});
    renderWithTheme(
      <SideDrawer
        isOpen
        onClose={handleClose}
        onOpen={handleOpen}
        renderContent={() => <Text>Drawer body</Text>}
      >
        <Text>Content</Text>
      </SideDrawer>
    );
    lastDrawerProps.onOpen();
    lastDrawerProps.onClose();
    expect(handleOpen).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders the drawer content via the render callback", () => {
    const {getByText} = renderWithTheme(
      <SideDrawer isOpen renderContent={() => <Text>Rendered drawer body</Text>}>
        <Text>Main</Text>
      </SideDrawer>
    );
    expect(getByText("Rendered drawer body")).toBeTruthy();
  });

  it("exercises the default no-op callbacks when onOpen/onClose are omitted", () => {
    renderWithTheme(
      <SideDrawer isOpen renderContent={() => <Text>Default callbacks</Text>}>
        <Text>Content</Text>
      </SideDrawer>
    );
    expect(() => {
      lastDrawerProps.onOpen();
      lastDrawerProps.onClose();
    }).not.toThrow();
  });
});
