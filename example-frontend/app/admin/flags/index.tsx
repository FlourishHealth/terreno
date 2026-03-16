import {FlagList} from "@terreno/admin-frontend";
import {useRouter} from "expo-router";
import React, {useCallback} from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const FlagListScreen: React.FC = () => {
  const router = useRouter();

  const handleFlagPress = useCallback(
    (key: string) => {
      router.push(`/admin/flags/${key}`);
    },
    [router]
  );

  return <FlagList api={terrenoApi} baseUrl={ADMIN_BASE_URL} onFlagPress={handleFlagPress} />;
};

export default FlagListScreen;
