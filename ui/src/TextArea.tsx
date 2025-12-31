import type React from "react";

import type {TextAreaProps} from "./Common";
import {TextField} from "./TextField";

export const TextArea = (props: TextAreaProps): React.ReactElement => {
  return <TextField {...props} multiline type="text" />;
};
