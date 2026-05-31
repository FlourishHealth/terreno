import type {ReactElement} from "react";
import {createPortal} from "react-dom";

interface CreateWebPortalOptions {
  children: ReactElement;
  container: Element;
}

export const createWebPortal = ({children, container}: CreateWebPortalOptions): ReactElement =>
  createPortal(children, container);
