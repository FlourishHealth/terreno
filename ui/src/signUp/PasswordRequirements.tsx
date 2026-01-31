import type {FC} from "react";
import {View} from "react-native";

import {Box} from "../Box";
import {Icon} from "../Icon";
import {Text} from "../Text";

import type {PasswordRequirementsDisplayProps} from "./signUpTypes";

export const PasswordRequirements: FC<PasswordRequirementsDisplayProps> = ({
  requirements,
  password,
  showCheckmarks = true,
  visible,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <Box marginTop={2}>
      {requirements.map((requirement) => {
        const isMet = requirement.validate(password);

        return (
          <View
            key={requirement.id}
            style={{
              alignItems: "center",
              flexDirection: "row",
              marginBottom: 4,
            }}
          >
            {showCheckmarks && (
              <Box marginRight={2}>
                <Icon
                  color={isMet ? "success" : "secondaryLight"}
                  iconName={isMet ? "check" : "xmark"}
                  size="sm"
                />
              </Box>
            )}
            <Text color={isMet ? "success" : "secondaryLight"} size="sm">
              {requirement.label}
            </Text>
          </View>
        );
      })}
    </Box>
  );
};
