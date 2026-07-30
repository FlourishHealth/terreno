import {type ReactElement, useState} from "react";
import {Image, Text as NativeText, View} from "react-native";

import type {
  SignatureCaptureFieldProps,
  SignatureCaptureValue,
  SignatureMode,
  TypedSignatureValue,
} from "./Common";
import {FieldError} from "./fieldElements/FieldError";
import {FieldHelperText} from "./fieldElements/FieldHelperText";
import {FieldTitle} from "./fieldElements/FieldTitle";
import {SegmentedControl} from "./SegmentedControl";
import {Signature} from "./Signature";
import {useTheme} from "./Theme";
import {TypedSignatureField} from "./TypedSignatureField";
import {resolveFieldTestIDsFromProps} from "./testing/resolveTestId";

const MODE_ITEMS: {label: string; mode: SignatureMode}[] = [
  {label: "Draw", mode: "draw"},
  {label: "Type", mode: "type"},
];

/**
 * Read-only preview of a drawn signature, mirroring SignatureField's disabled rendering.
 * Shows the captured image, or a grayed placeholder box when there is nothing to show.
 */
const DrawnSignaturePreview = ({image}: {image?: string}): ReactElement => {
  const {theme} = useTheme();
  if (!image) {
    return (
      <View
        style={{
          backgroundColor: theme.surface.neutralLight,
          height: 90,
          marginVertical: 8,
          width: 300,
        }}
      />
    );
  }
  return (
    <Image
      accessibilityIgnoresInvertColors={false}
      resizeMode="contain"
      source={{uri: image}}
      style={{
        borderColor: theme.border.dark,
        borderWidth: 1,
        height: 80,
        marginVertical: 8,
        width: 300,
      }}
    />
  );
};

/**
 * A cross-platform signature field that lets the signer either draw their signature or type
 * their name and pick a font, chosen via a Draw/Type toggle. Draw mode reuses the platform
 * signature pad (Skia on native, canvas on web); type mode reuses {@link TypedSignatureField}.
 *
 * Emits a discriminated {@link SignatureCaptureValue} on every change so a parent can gate
 * "signature required" and persist whichever representation the signer produced. The active
 * mode is tracked internally (initialized from `value.mode` or `defaultMode`); switching modes
 * does not emit a value on its own — a value is emitted only once the signer draws or types.
 */
export const SignatureCaptureField = ({
  title = "Signature",
  value,
  onChange,
  defaultMode = "type",
  fonts,
  nameLabel,
  placeholder,
  fullWidth = false,
  onStart,
  onEnd,
  helperText,
  errorText,
  disabled = false,
  testID,
  testIDs,
}: SignatureCaptureFieldProps): ReactElement => {
  const {theme} = useTheme();
  const fieldTestIDs = resolveFieldTestIDsFromProps({testID, testIDs});
  const [mode, setMode] = useState<SignatureMode>(value?.mode ?? defaultMode);

  const drawnImage = value?.mode === "draw" ? value.image : undefined;
  const typedValue: TypedSignatureValue | undefined =
    value?.mode === "type" ? {fontKey: value.fontKey, typedName: value.typedName} : undefined;

  const emitDrawn = (image: string): void => {
    const next: SignatureCaptureValue = {image, mode: "draw"};
    onChange(next);
  };

  const emitTyped = (typed: TypedSignatureValue): void => {
    const next: SignatureCaptureValue = {mode: "type", ...typed};
    onChange(next);
  };

  // When disabled, render a read-only view of whichever representation was captured — no toggle.
  if (disabled) {
    return (
      <View style={{flexDirection: "column", width: "100%"}} {...(testID ? {testID} : {})}>
        {Boolean(title) && <FieldTitle testID={fieldTestIDs.label} text={title} />}
        {value?.mode === "draw" ? (
          <DrawnSignaturePreview image={drawnImage} />
        ) : (
          <TypedSignatureField
            disabled
            fonts={fonts}
            nameLabel={nameLabel}
            onChange={emitTyped}
            placeholder={placeholder}
            title=""
            value={typedValue}
          />
        )}
        {Boolean(helperText) && <FieldHelperText testID={fieldTestIDs.helper} text={helperText!} />}
      </View>
    );
  }

  return (
    <View style={{flexDirection: "column", width: "100%"}} {...(testID ? {testID} : {})}>
      {Boolean(title) && <FieldTitle testID={fieldTestIDs.label} text={title} />}
      {Boolean(errorText) && <FieldError testID={fieldTestIDs.error} text={errorText!} />}

      <View style={{marginTop: 8}}>
        <SegmentedControl
          items={MODE_ITEMS.map((item) => item.label)}
          onChange={(index) => setMode(MODE_ITEMS[index].mode)}
          selectedIndex={MODE_ITEMS.findIndex((item) => item.mode === mode)}
        />
      </View>

      <View style={{marginTop: 12}}>
        {mode === "draw" ? (
          <View>
            <Signature fullWidth={fullWidth} onChange={emitDrawn} onEnd={onEnd} onStart={onStart} />
            {!drawnImage && (
              <NativeText style={{color: theme.text.secondaryLight, fontSize: 12, marginTop: 4}}>
                Draw your signature above, then it will be saved automatically.
              </NativeText>
            )}
          </View>
        ) : (
          <TypedSignatureField
            fonts={fonts}
            nameLabel={nameLabel}
            onChange={emitTyped}
            placeholder={placeholder}
            title=""
            value={typedValue}
          />
        )}
      </View>

      {Boolean(helperText) && <FieldHelperText testID={fieldTestIDs.helper} text={helperText!} />}
    </View>
  );
};
