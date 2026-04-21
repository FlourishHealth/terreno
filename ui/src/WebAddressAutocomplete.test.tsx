import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import type {AddressInterface} from "./Common";
import {renderWithTheme} from "./test-utils";
import {WebAddressAutocomplete} from "./WebAddressAutocomplete";

describe("WebAddressAutocomplete", () => {
  const defaultProps = {
    handleAddressChange: () => {},
    handleAutoCompleteChange: () => {},
    inputValue: "",
  };

  it("renders correctly without Google API key", () => {
    const {toJSON} = renderWithTheme(<WebAddressAutocomplete {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(WebAddressAutocomplete).toBeDefined();
    expect(typeof WebAddressAutocomplete).toBe("function");
  });

  it("renders with input value", () => {
    const {toJSON} = renderWithTheme(
      <WebAddressAutocomplete {...defaultProps} inputValue="123 Main St" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<WebAddressAutocomplete {...defaultProps} disabled />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without calling handleAutoCompleteChange until a place is selected", () => {
    const handleAutoCompleteChange = mock((_arg: AddressInterface) => {});
    renderWithTheme(
      <WebAddressAutocomplete
        {...defaultProps}
        handleAutoCompleteChange={handleAutoCompleteChange}
      />
    );
    expect(handleAutoCompleteChange).not.toHaveBeenCalled();
  });

  it("renders with includeCounty flag", () => {
    const {toJSON} = renderWithTheme(<WebAddressAutocomplete {...defaultProps} includeCounty />);
    expect(toJSON()).toMatchSnapshot();
  });

  describe("with Google Maps available", () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    interface PlaceResult {
      address_components: {
        long_name: string;
        short_name: string;
        types: string[];
      }[];
    }

    let listeners: Record<string, () => void>;
    let placeResult: PlaceResult | null;
    let autocompleteConstructor: ReturnType<typeof mock>;

    beforeEach(() => {
      listeners = {};
      placeResult = null;

      autocompleteConstructor = mock((_input: unknown, _opts: unknown) => ({
        addListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        getPlace: () => placeResult,
      }));

      (global as any).window = {
        google: {
          maps: {
            places: {
              Autocomplete: autocompleteConstructor,
            },
          },
        },
      };
      (global as any).document = originalDocument ?? {
        createElement: () => ({}) as HTMLScriptElement,
        head: {appendChild: () => {}},
      };
    });

    afterEach(() => {
      // Leave a minimal window so React's effect cleanup (which assigns
      // `window[callbackName] = null`) does not blow up after teardown.
      (global as any).window = originalWindow ?? {};
      (global as any).document = originalDocument;
    });

    it("initializes the Autocomplete and wires up the place_changed listener", async () => {
      const handleAutoCompleteChange = mock((_arg: AddressInterface) => {});
      renderWithTheme(
        <WebAddressAutocomplete
          googleMapsApiKey="test-key"
          handleAddressChange={() => {}}
          handleAutoCompleteChange={handleAutoCompleteChange}
          inputValue=""
        />
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(autocompleteConstructor).toHaveBeenCalled();
      expect(typeof listeners.place_changed).toBe("function");

      // Simulate a selected place.
      placeResult = {
        address_components: [
          {long_name: "5", short_name: "5", types: ["street_number"]},
          {long_name: "Elm", short_name: "Elm", types: ["route"]},
          {long_name: "Oakland", short_name: "OAK", types: ["locality"]},
          {long_name: "California", short_name: "CA", types: ["administrative_area_level_1"]},
          {long_name: "94601", short_name: "94601", types: ["postal_code"]},
        ],
      };
      listeners.place_changed();
      expect(handleAutoCompleteChange).toHaveBeenCalled();
    });

    it("invokes handleAddressChange from the fallback TextField's onChange", async () => {
      const handleAddressChange = mock(() => {});
      const {UNSAFE_getAllByType} = renderWithTheme(
        <WebAddressAutocomplete
          googleMapsApiKey="test-key"
          handleAddressChange={handleAddressChange}
          handleAutoCompleteChange={() => {}}
          inputValue=""
        />
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const {TextInput} = require("react-native");
      const inputs = UNSAFE_getAllByType(TextInput);
      expect(inputs.length).toBeGreaterThan(0);
      fireEvent.changeText(inputs[0], "321 Pine");
      expect(handleAddressChange).toHaveBeenCalledWith("321 Pine");
    });
  });
});
