import React, {type FC, lazy, Suspense} from "react";

const LazyMarkdown = lazy(() =>
  import("react-native-markdown-display").then((moduleNamespace) => ({
    default: moduleNamespace.default,
  }))
);

interface DataTableHeaderInfoMarkdownProps {
  children: string;
}

export const DataTableHeaderInfoMarkdown: FC<DataTableHeaderInfoMarkdownProps> = ({children}) => (
  <Suspense fallback={null}>
    <LazyMarkdown>{children}</LazyMarkdown>
  </Suspense>
);
