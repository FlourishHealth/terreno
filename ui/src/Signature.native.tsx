import {type FC, useRef} from "react";
import {Text, View} from "react-native";
import SignatureScreen, {type SignatureViewRef} from "react-native-signature-canvas";

import {useTheme} from "./Theme";

interface Props {
  onChange: (signature: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

const style = `.m-signature-pad--footer {display: none; margin: 0px;}`;

export const Signature: FC<Props> = ({onChange, onStart, onEnd}: Props) => {
  const ref = useRef<SignatureViewRef>(null);
  const {theme} = useTheme();

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const onBegin = () => {
    onStart?.();
  };

  // Called after end of stroke. Kind of goofy if you ask me,
  // but you need this in order to trigger the 'onOK' callback that gives us the actual image.
  const handleEnd = () => {
    ref.current?.readSignature();
    onEnd?.();
  };

  return (
    <View style={{minWidth: 220}}>
      <View style={{borderColor: theme.border.dark, borderWidth: 1, minHeight: 90}}>
        <SignatureScreen
          backgroundColor={theme.surface.base}
          onBegin={onBegin}
          onEnd={handleEnd}
          onOK={(img) => onChange(img)}
          ref={ref}
          trimWhitespace
          webStyle={style}
        />
      </View>
      <View style={{flexDirection: "row"}}>
        <Text
          onPress={handleClear}
          style={{color: theme.text.link, textDecorationLine: "underline"}}
        >
          Clear
        </Text>
      </View>
    </View>
  );
};
