import {describe, expect, it, mock} from "bun:test";

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
});
