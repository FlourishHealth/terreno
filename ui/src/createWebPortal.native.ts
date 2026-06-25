import type {ReactElement} from "react";

interface CreateWebPortalOptions {
  children: ReactElement;
  container: Element;
}

export const createWebPortal = ({children}: CreateWebPortalOptions): ReactElement => children;
