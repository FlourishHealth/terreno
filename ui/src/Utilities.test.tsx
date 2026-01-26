import {describe, expect, it} from "bun:test";

import {
  concat,
  findAddressComponent,
  formattedCountyCode,
  fromClassName,
  fromInlineStyle,
  iconNumberToSize,
  identity,
  isAPIError,
  isNative,
  isTestUser,
  isValidGoogleApiKey,
  mergeInlineStyles,
  printAPIError,
  processAddressComponents,
  toProps,
} from "./Utilities";

describe("Utilities", () => {
  describe("mergeInlineStyles", () => {
    it("merges inline styles", () => {
      const existing = {__style: {color: "red"}};
      const newStyle = {backgroundColor: "blue"};
      const result = mergeInlineStyles(existing, newStyle);
      expect(result.__style).toEqual({backgroundColor: "blue", color: "red"});
    });

    it("handles undefined existing style", () => {
      const result = mergeInlineStyles(undefined, {color: "red"});
      expect(result.__style).toEqual({color: "red"});
    });
  });

  describe("isTestUser", () => {
    it("returns true for nang.io email", () => {
      expect(isTestUser({email: "test@nang.io"} as any)).toBe(true);
    });

    it("returns true for example.com email", () => {
      expect(isTestUser({email: "test@example.com"} as any)).toBe(true);
    });

    it("returns false for regular email", () => {
      expect(isTestUser({email: "user@company.com"} as any)).toBe(false);
    });

    it("returns falsy for undefined profile", () => {
      expect(isTestUser(undefined)).toBeFalsy();
    });
  });

  describe("iconNumberToSize", () => {
    it("returns xs for size less than 8", () => {
      expect(iconNumberToSize(5)).toBe("xs");
    });

    it("returns sm for size 8-11", () => {
      expect(iconNumberToSize(10)).toBe("sm");
    });

    it("returns md for size 12-13", () => {
      expect(iconNumberToSize(12)).toBe("md");
    });

    it("returns lg for size 14-19", () => {
      expect(iconNumberToSize(16)).toBe("lg");
    });

    it("returns xl for size 20+", () => {
      expect(iconNumberToSize(24)).toBe("xl");
    });

    it("returns lg for default size (16)", () => {
      expect(iconNumberToSize()).toBe("lg");
    });
  });

  describe("Style utilities", () => {
    describe("identity", () => {
      it("returns empty style", () => {
        const result = identity();
        expect(result.className.size).toBe(0);
        expect(Object.keys(result.inlineStyle).length).toBe(0);
      });
    });

    describe("fromClassName", () => {
      it("creates style from classnames", () => {
        const result = fromClassName("class1", "class2");
        expect(result.className.has("class1")).toBe(true);
        expect(result.className.has("class2")).toBe(true);
      });
    });

    describe("fromInlineStyle", () => {
      it("creates style from inline styles", () => {
        const result = fromInlineStyle({color: "red", fontSize: 14});
        expect(result.inlineStyle).toEqual({color: "red", fontSize: 14});
      });
    });

    describe("concat", () => {
      it("concatenates multiple styles", () => {
        const style1 = fromClassName("class1");
        const style2 = fromClassName("class2");
        const style3 = fromInlineStyle({color: "red"});
        const result = concat([style1, style2, style3]);
        expect(result.className.has("class1")).toBe(true);
        expect(result.className.has("class2")).toBe(true);
        expect(result.inlineStyle.color).toBe("red");
      });
    });

    describe("toProps", () => {
      it("converts style to props object", () => {
        const style = concat([fromClassName("a", "b"), fromInlineStyle({color: "red"})]);
        const props = toProps(style);
        expect(props.className).toBe("a b");
        expect(props.style).toEqual({color: "red"});
      });

      it("omits empty className", () => {
        const style = fromInlineStyle({color: "red"});
        const props = toProps(style);
        expect(props.className).toBeUndefined();
      });

      it("omits empty style", () => {
        const style = fromClassName("class1");
        const props = toProps(style);
        expect(props.style).toBeUndefined();
      });
    });
  });

  describe("isNative", () => {
    it("returns boolean", () => {
      const result = isNative();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("findAddressComponent", () => {
    const components = [
      {long_name: "123", short_name: "123", types: ["street_number"]},
      {long_name: "Main Street", short_name: "Main St", types: ["route"]},
      {long_name: "New York", short_name: "NY", types: ["locality"]},
    ];

    it("finds component by type", () => {
      expect(findAddressComponent(components, "locality")).toBe("New York");
    });

    it("returns empty string for missing type", () => {
      expect(findAddressComponent(components, "country")).toBe("");
    });
  });

  describe("processAddressComponents", () => {
    const components = [
      {long_name: "123", short_name: "123", types: ["street_number"]},
      {long_name: "Main Street", short_name: "Main St", types: ["route"]},
      {long_name: "Boston", short_name: "Boston", types: ["locality"]},
      {long_name: "Massachusetts", short_name: "MA", types: ["administrative_area_level_1"]},
      {long_name: "02101", short_name: "02101", types: ["postal_code"]},
    ];

    it("processes address components correctly", () => {
      const result = processAddressComponents(components);
      expect(result.address1).toBe("123 Main Street");
      expect(result.city).toBe("Boston");
      expect(result.state).toBe("Massachusetts");
      expect(result.zipcode).toBe("02101");
    });

    it("handles empty components", () => {
      const result = processAddressComponents([]);
      expect(result.address1).toBe("");
    });

    it("handles undefined components", () => {
      const result = processAddressComponents(undefined);
      expect(result.address1).toBe("");
    });
  });

  describe("isValidGoogleApiKey", () => {
    it("returns true for valid-looking API key", () => {
      expect(isValidGoogleApiKey("AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(isValidGoogleApiKey("")).toBe(false);
    });

    it("returns false for too short key", () => {
      expect(isValidGoogleApiKey("short")).toBe(false);
    });

    it("returns false for key with invalid characters", () => {
      expect(isValidGoogleApiKey("invalid key with spaces!!!")).toBe(false);
    });
  });

  describe("isAPIError", () => {
    it("returns truthy for API error object", () => {
      const error = {data: {detail: "Something went wrong", title: "Error"}};
      expect(isAPIError(error)).toBeTruthy();
    });

    it("returns falsy for non-API error", () => {
      expect(isAPIError({message: "error"})).toBeFalsy();
    });

    it("returns falsy for null", () => {
      expect(isAPIError(null)).toBeFalsy();
    });
  });

  describe("printAPIError", () => {
    it("prints error title", () => {
      const error = {data: {title: "Not Found"}};
      expect(printAPIError(error as any)).toBe("Not Found");
    });

    it("prints error title and detail", () => {
      const error = {data: {detail: "Resource does not exist", title: "Not Found"}};
      expect(printAPIError(error as any)).toBe("Not Found: Resource does not exist");
    });

    it("omits detail when details is false", () => {
      const error = {data: {detail: "Resource does not exist", title: "Not Found"}};
      expect(printAPIError(error as any, false)).toBe("Not Found");
    });
  });
});
