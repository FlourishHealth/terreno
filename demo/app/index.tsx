import {Redirect} from "expo-router";

const Route = () => {
  if (process.env.NODE_ENV === "production") {
    return <Redirect href="/demo" />;
  }
  return <Redirect href="/dev" />;
};

export default Route;
