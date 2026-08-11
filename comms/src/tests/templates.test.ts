import {describe, it} from "bun:test";
import {assert} from "chai";

import {renderTemplate} from "../templates";

describe("renderTemplate", () => {
  it("interpolates values across subject, text, and HTML", (): void => {
    const rendered = renderTemplate({
      data: {name: "Ada", product: "Terreno"},
      template: {
        html: "<p>Hello {{name}}</p>",
        subject: "Welcome to {{product}}, {{name}}",
        text: "Hello {{name}}",
      },
    });

    assert.deepEqual(rendered, {
      html: "<p>Hello Ada</p>",
      subject: "Welcome to Terreno, Ada",
      text: "Hello Ada",
    });
  });

  it("leaves unknown placeholders intact for later diagnosis", (): void => {
    const rendered = renderTemplate({
      data: {},
      template: {subject: "Hello {{name}}"},
    });

    assert.equal(rendered.subject, "Hello {{name}}");
  });
});
