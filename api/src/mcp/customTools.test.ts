import {beforeEach, describe, expect, it} from "bun:test";
import {z} from "zod";

import type {User} from "../auth";
import {clearMCPRegistry, registerMCPTool} from "./registry";
import {getAllMCPTools} from "./toolGenerator";

describe("registerMCPTool", () => {
  beforeEach(() => {
    clearMCPRegistry();
  });

  it("includes custom tools in getAllMCPTools", async () => {
    registerMCPTool({
      description: "Echo a message",
      handler: async (args) => {
        return {
          content: [{text: JSON.stringify({echo: args.message}), type: "text"}],
        };
      },
      name: "echo_message",
      zodSchema: z.object({message: z.string()}).strict(),
    });

    const tools = getAllMCPTools();
    expect(tools.map((tool) => tool.name)).toEqual(["echo_message"]);

    const result = await tools[0].handler({message: "hi"}, {_id: "u1"} as unknown as User);
    expect(JSON.parse(result.content[0].text)).toEqual({echo: "hi"});
  });

  it("replaces a custom tool registered with the same name", () => {
    registerMCPTool({
      description: "first",
      handler: async () => {
        return {content: [{text: "first", type: "text"}]};
      },
      name: "echo_message",
      zodSchema: z.object({}).strict(),
    });
    registerMCPTool({
      description: "second",
      handler: async () => {
        return {content: [{text: "second", type: "text"}]};
      },
      name: "echo_message",
      zodSchema: z.object({}).strict(),
    });

    const tools = getAllMCPTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("second");
  });
});
