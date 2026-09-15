import {describe, expect, it} from "bun:test";
import {Box} from "@terreno/ui";

import {collectRegisteredStoryRenders, defaultDemoProps} from "./collectRegisteredStoryRenders";
import type {DemoConfiguration} from "./demoConfig";

const stubConfig = (overrides: Partial<DemoConfiguration>): DemoConfiguration => {
  return {
    a11yNotes: [],
    category: "Component",
    component: Box,
    demo: () => <Box />,
    demoOptions: {},
    description: "stub",
    interfaceName: "BoxProps",
    name: "Stub",
    props: {},
    related: [],
    status: {
      android: "ready",
      documentation: "ready",
      figma: "notSupported",
      ios: "ready",
      web: "ready",
    },
    stories: {},
    usage: {do: [], doNot: []},
    ...overrides,
  };
};

describe("collectRegisteredStoryRenders", () => {
  it("includes the demo plus each named story from the configs it is given", () => {
    const configs = [
      stubConfig({
        name: "One",
        stories: {Alpha: {render: () => <Box />}},
      }),
      stubConfig({
        name: "Two",
        stories: {
          Beta: {render: () => <Box />},
          Gamma: {render: () => <Box />},
        },
      }),
    ];
    const ids = collectRegisteredStoryRenders(configs).map((entry) => entry.id);
    expect(ids).toEqual(["One / demo", "One / Alpha", "Two / demo", "Two / Beta", "Two / Gamma"]);
  });

  it("passes control defaultValue into the demo render", () => {
    let received: unknown;
    const configs = [
      stubConfig({
        demo: (props) => {
          received = props;
          return <Box />;
        },
        demoOptions: {
          controls: {
            title: {defaultValue: "hello", type: "text"},
          },
        },
        name: "Controlled",
      }),
    ];
    collectRegisteredStoryRenders(configs)[0]?.render();
    expect(received).toEqual({title: "hello"});
  });
});

describe("defaultDemoProps", () => {
  it("returns an empty object when there are no controls", () => {
    expect(defaultDemoProps(stubConfig({}))).toEqual({});
  });
});
