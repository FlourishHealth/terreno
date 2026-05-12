import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";

mock.module("../AdminObjectPicker", () => ({
  AdminObjectPicker: ({title, refModelName}: {title: string; refModelName: string}) =>
    React.createElement("AdminObjectPicker", {refModelName, testID: "picker", title}),
}));

import {AdminRefField} from "../AdminRefField";

describe("AdminRefField", () => {
  it("renders an AdminObjectPicker passing through key props", () => {
    const {getByTestId} = renderWithTheme(
      <AdminRefField
        api={{} as any}
        baseUrl="/admin"
        errorText="e"
        helperText="h"
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="Owner"
        value="u1"
      />
    );
    expect(getByTestId("picker").props.refModelName).toBe("User");
  });
});
