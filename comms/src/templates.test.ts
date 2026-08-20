import {describe, it} from "bun:test";
import {assert} from "chai";

import {renderTemplate} from "./templates";

describe("renderTemplate", () => {
  it("interpolates own data fields across subject, text, and html", (): void => {
    const rendered = renderTemplate({
      data: {name: "Ada"},
      template: {
        html: "<p>Hello {{name}}</p>",
        subject: "Welcome, {{ name }}",
        text: "Hello {{name}}",
      },
    });

    assert.deepEqual(rendered, {
      html: "<p>Hello Ada</p>",
      subject: "Welcome, Ada",
      text: "Hello Ada",
    });
  });

  it("does not resolve inherited or missing values", (): void => {
    const data = Object.create({constructor: "unsafe"}) as Record<string, unknown>;
    data.name = "Ada";

    const rendered = renderTemplate({
      data,
      template: {
        subject: "{{constructor}} {{missing}} {{name}}",
      },
    });

    assert.equal(rendered.subject, "  Ada");
  });
});
