import type {FC} from "react";
import {View} from "react-native";

import {Icon} from "../Icon";
import {Text} from "../Text";
import type {PasswordRequirement} from "./signUpTypes";

interface PasswordRequirementsProps {
  /** The current password value to validate against. */
  password: string;
  /** List of password requirements to display. */
  requirements: PasswordRequirement[];
  /** Test ID prefix for the component. */
  testID?: string;
}

/**
 * Displays a list of password requirements with check/cross indicators.
 */
export const PasswordRequirements: FC<PasswordRequirementsProps> = ({
  password,
  requirements,
  testID = "password-requirements",
}) => {
  return (
    <View testID={testID}>
      {requirements.map((req) => {
        const isMet = password.length > 0 && req.validate(password);
        return (
          <View
            key={req.key}
            style={{alignItems: "center", flexDirection: "row", gap: 8, marginBottom: 4}}
            testID={`${testID}-${req.key}`}
          >
            <Icon
              color={isMet ? "success" : "secondaryLight"}
              iconName={isMet ? "circle-check" : "circle"}
              size="sm"
              testID={`${testID}-${req.key}-icon`}
            />
            <Text color={isMet ? "success" : "secondaryLight"} size="sm">
              {req.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};
