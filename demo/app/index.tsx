import {Redirect} from "expo-router";

export default function Route() {
  if (process.env.NODE_ENV === "production") {
    return <Redirect href="/demo" />;
  }
  return <Redirect href="/dev" />;
}
