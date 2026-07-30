import {Caveat_400Regular} from "@expo-google-fonts/caveat";
import {DancingScript_400Regular} from "@expo-google-fonts/dancing-script";
import {GreatVibes_400Regular} from "@expo-google-fonts/great-vibes";
import {Sacramento_400Regular} from "@expo-google-fonts/sacramento";
import {useFonts} from "expo-font";
import type {ReactElement} from "react";
import {Text as NativeText, Pressable, View} from "react-native";

import type {SignatureFont, TypedSignatureFieldProps, TypedSignatureValue} from "./Common";
import {FieldError} from "./fieldElements/FieldError";
import {FieldHelperText} from "./fieldElements/FieldHelperText";
import {FieldTitle} from "./fieldElements/FieldTitle";
import {TextField} from "./TextField";
import {useTheme} from "./Theme";
import {resolveFieldTestIDsFromProps} from "./testing/resolveTestId";

/**
 * Font families registered by this component via expo-font. Prefixed with "signature-" to
 * avoid colliding with the app's text/heading font families.
 */
const SIGNATURE_FONT_MODULES = {
  "signature-caveat": Caveat_400Regular,
  "signature-dancing-script": DancingScript_400Regular,
  "signature-great-vibes": GreatVibes_400Regular,
  "signature-sacramento": Sacramento_400Regular,
} as const;

/**
 * The default set of signature typefaces bundled with the library. Consumers persist the
 * `key`; the `fontFamily` values match the families loaded by this component.
 */
export const DEFAULT_SIGNATURE_FONTS: SignatureFont[] = [
  {fontFamily: "signature-dancing-script", key: "dancing-script", label: "Dancing Script"},
  {fontFamily: "signature-great-vibes", key: "great-vibes", label: "Great Vibes"},
  {fontFamily: "signature-sacramento", key: "sacramento", label: "Sacramento"},
  {fontFamily: "signature-caveat", key: "caveat", label: "Caveat"},
];

/**
 * Resolves the currently selected font from the value, falling back to the first font when
 * the stored `fontKey` is unknown (e.g. a font was removed) or no value is set yet.
 */
const resolveSelectedFont = (
  fonts: SignatureFont[],
  fontKey: string | undefined
): SignatureFont => {
  return fonts.find((font) => font.key === fontKey) ?? fonts[0];
};

/**
 * A cross-platform typed signature field. The signer types their name and picks a font from a
 * live-previewing picker; the same UI and output are produced on web and native. Emits a
 * {@link TypedSignatureValue} (typed name + font key) on every change so parents can gate
 * "signature required" and persist the result directly.
 *
 * Font fidelity depends on the chosen font families being loaded. The bundled default fonts
 * are loaded by this component; when a custom `fonts` list is supplied the consumer must load
 * those families themselves.
 */
export const TypedSignatureField = ({
  title = "Signature",
  value,
  onChange,
  fonts = DEFAULT_SIGNATURE_FONTS,
  nameLabel = "Full name",
  placeholder = "Type your full name",
  helperText,
  errorText,
  disabled = false,
  testID,
  testIDs,
}: TypedSignatureFieldProps): ReactElement => {
  const {theme} = useTheme();
  // Load the bundled signature fonts. Rendering is not blocked on load — previews fall back to
  // the system font briefly, then re-render once the families are available.
  useFonts(SIGNATURE_FONT_MODULES);

  const fieldTestIDs = resolveFieldTestIDsFromProps({testID, testIDs});

  const typedName = value?.typedName ?? "";
  const selectedFont = resolveSelectedFont(fonts, value?.fontKey);
  const hasName = typedName.trim().length > 0;

  const emitChange = (next: Partial<TypedSignatureValue>): void => {
    onChange({
      fontKey: next.fontKey ?? selectedFont.key,
      typedName: next.typedName ?? typedName,
    });
  };

  return (
    <View style={{flexDirection: "column", width: "100%"}} {...(testID ? {testID} : {})}>
      {Boolean(title) && <FieldTitle testID={fieldTestIDs.label} text={title} />}
      {Boolean(errorText) && <FieldError testID={fieldTestIDs.error} text={errorText!} />}

      <View style={{marginTop: 8}}>
        <TextField
          disabled={disabled}
          onChange={(nextName) => emitChange({typedName: nextName})}
          placeholder={placeholder}
          testID={fieldTestIDs.input}
          title={nameLabel}
          type="text"
          value={typedName}
        />
      </View>

      {/* Font picker: each option renders its own label in its own typeface so the signer can
          compare styles before selecting. */}
      <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12}}>
        {fonts.map((font) => {
          const isSelected = font.key === selectedFont.key;
          return (
            <Pressable
              accessibilityHint="Sets the style of your signature"
              accessibilityLabel={`Signature font ${font.label}`}
              accessibilityState={{disabled, selected: isSelected}}
              aria-role="button"
              disabled={disabled}
              hitSlop={8}
              key={font.key}
              onPress={() => emitChange({fontKey: font.key})}
              style={{
                backgroundColor: isSelected ? theme.surface.neutralLight : theme.surface.base,
                borderColor: isSelected ? theme.border.activeAccent : theme.border.default,
                borderRadius: 8,
                borderWidth: isSelected ? 2 : 1,
                minWidth: 96,
                opacity: disabled ? 0.5 : 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <NativeText
                numberOfLines={1}
                style={{color: theme.text.primary, fontFamily: font.fontFamily, fontSize: 22}}
              >
                {font.label}
              </NativeText>
            </Pressable>
          );
        })}
      </View>

      {/* Live preview of the finished signature in the selected font. */}
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.surface.base,
          borderColor: theme.border.dark,
          borderRadius: 4,
          borderWidth: 1,
          justifyContent: "center",
          marginTop: 12,
          minHeight: 96,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        testID={fieldTestIDs.helper ? `${fieldTestIDs.helper}-preview` : undefined}
      >
        <NativeText
          numberOfLines={1}
          style={{
            color: hasName ? theme.text.primary : theme.text.secondaryLight,
            fontFamily: selectedFont.fontFamily,
            fontSize: 40,
          }}
        >
          {hasName ? typedName : placeholder}
        </NativeText>
      </View>

      {Boolean(helperText) && <FieldHelperText testID={fieldTestIDs.helper} text={helperText!} />}
    </View>
  );
};
