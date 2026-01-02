import {Box, Slider} from "@terreno/ui";
import {type ReactElement, useState} from "react";

export const SliderDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(0.5);
  return (
    <Box width="100%">
      <Slider maximumValue={1} minimumValue={0} onChange={setValue} step={0.1} value={value} />
    </Box>
  );
};

export const SliderWithValueDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider
      maximumValue={100}
      minimumValue={0}
      onChange={setValue}
      showSelection
      step={1}
      title="Volume"
      value={value}
    />
  );
};

export const SliderWithSmileysDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider
      inlineLabels
      labels={{
        max: "\u{1F604}",
        min: "\u{1F61E}",
      }}
      maximumValue={100}
      minimumValue={0}
      onChange={setValue}
      showSelection
      step={25}
      title="Smileys"
      value={value}
      valueMapping={[
        {label: "\u{1F61E}", value: 0},
        {label: "\u{1F641}", value: 25},
        {label: "\u{1F610}", value: 50},
        {label: "\u{1F642}", value: 75},
        {label: "\u{1F604}", value: 100},
      ]}
    />
  );
};

export const SliderWithIconsDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider
      maximumValue={100}
      minimumValue={0}
      onChange={setValue}
      showSelection
      step={25}
      title="Volume"
      useIcons
      value={value}
      valueMapping={[
        {label: "volume-xmark", size: "md", value: 0},
        {label: "volume-off", size: "md", value: 25},
        {label: "volume-low", size: "md", value: 50},
        {label: "volume-high", size: "md", value: 75},
        {label: "volume-high", size: "lg", value: 100},
      ]}
    />
  );
};

export const SliderWithLabelsDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider
      labels={{
        custom: [
          {index: 25, label: "|"},
          {index: 50, label: "|"},
          {index: 75, label: "|"},
        ],
        max: "High",
        min: "Low",
      }}
      maximumValue={100}
      minimumValue={0}
      onChange={setValue}
      step={1}
      title="Temperature"
      value={value}
    />
  );
};

export const SliderWithInlineLabelsDemo = (): ReactElement => {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider
      inlineLabels
      labels={{
        max: "High",
        min: "Low",
      }}
      maximumValue={100}
      minimumValue={0}
      onChange={setValue}
      step={1}
      title="Temperature"
      value={value}
    />
  );
};
