import {describe, it} from "bun:test";
import {assert} from "chai";

import {renderAuthMail, renderTemplate} from "./templates";

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

  it("renders empty strings for null and undefined own properties", (): void => {
    const rendered = renderTemplate({
      data: {name: null, title: undefined},
      template: {
        html: "<p>{{name}}</p>",
        subject: "{{title}} {{name}}",
        text: "{{name}}",
      },
    });
    assert.deepEqual(rendered, {
      html: "<p></p>",
      subject: " ",
      text: "",
    });
  });
});

describe("auth mail templates", () => {
  it("renders resetPassword and verifyEmail links from publicAppUrl", (): void => {
    const reset = renderAuthMail({
      publicAppUrl: "https://app.example.com/",
      templateId: "resetPassword",
      token: "abc123",
    });
    const verify = renderAuthMail({
      publicAppUrl: "https://app.example.com/",
      templateId: "verifyEmail",
      token: "def456",
    });

    assert.deepEqual(reset, {
      html: '<p><a href="https://app.example.com/resetPassword?token=abc123">Reset your password</a></p>',
      subject: "Reset your password",
      text: "Reset your password using this link: https://app.example.com/resetPassword?token=abc123",
    });
    assert.deepEqual(verify, {
      html: '<p><a href="https://app.example.com/verifyEmail?token=def456">Verify your email</a></p>',
      subject: "Verify your email",
      text: "Verify your email using this link: https://app.example.com/verifyEmail?token=def456",
    });
  });

  it("uses app-provided template overrides when present", (): void => {
    const rendered = renderAuthMail({
      publicAppUrl: "https://app.example.com",
      templateId: "resetPassword",
      templates: {
        resetPassword: {
          html: "<p>{{resetUrl}}</p>",
          subject: "Reset for {{token}}",
          text: "{{resetUrl}}",
        },
      },
      token: "abc123",
    });
    assert.deepEqual(rendered, {
      html: "<p>https://app.example.com/resetPassword?token=abc123</p>",
      subject: "Reset for abc123",
      text: "https://app.example.com/resetPassword?token=abc123",
    });
  });
});
