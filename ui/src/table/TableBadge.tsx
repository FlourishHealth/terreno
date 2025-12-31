import {type FC, useState} from "react";
import {View} from "react-native";

import {Badge} from "../Badge";
import type {TableBadgeProps} from "../Common";
import {SelectField} from "../SelectField";

export interface TableBadgeHandles {
  handleSave: () => void | Promise<void>;
}

// TODO: Support error state in TableBadge
export const TableBadge: FC<TableBadgeProps> = ({
  value,
  badgeStatus = "info",
  badgeIconName,
  isEditing = false,
  editingOptions,
}) => {
  const [selected, setSelected] = useState<string | undefined>(value);

  const handleChange = (newVal: string | undefined) => {
    if (newVal === "") {
      setSelected(undefined);
    } else {
      setSelected(newVal);
    }
  };

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isEditing && editingOptions ? (
        <SelectField onChange={handleChange} options={editingOptions} value={selected} />
      ) : (
        <Badge iconName={badgeIconName} secondary status={badgeStatus} value={value} />
      )}
    </View>
  );
};

TableBadge.displayName = "TableBadge";
