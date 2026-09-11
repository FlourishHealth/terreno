import type {DefaultDoc, DefaultModel, DefaultStatics} from "../modelPlugins";

export type ConfigValueType = string | number | boolean | null;

type ConfigurationMethods = {
  getValue: (this: ConfigurationDocument) => ConfigValueType;
};

type ConfigurationStatics = DefaultStatics<ConfigurationDocument> & {
  getByKey: (this: ConfigurationModel, key: string) => Promise<ConfigurationDocument | null>;
  setValue: (
    this: ConfigurationModel,
    key: string,
    value: ConfigValueType
  ) => Promise<ConfigurationDocument>;
};

export type ConfigurationModel = DefaultModel<ConfigurationDocument> & ConfigurationStatics;

export type ConfigurationDocument = DefaultDoc &
  ConfigurationMethods & {
    key: string;
    value: ConfigValueType;
    type: "string" | "number" | "boolean" | "secret";
    description?: string;
  };
