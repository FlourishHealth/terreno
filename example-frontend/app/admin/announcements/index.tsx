import {AnnouncementList} from "@terreno/admin-frontend";
import {useRouter} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AnnouncementsScreen: React.FC = () => {
  const router = useRouter();
  return (
    <AnnouncementList
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      onCreateNew={() => router.push("/admin/announcements/create")}
      onRowClick={(id) => router.push(`/admin/announcements/${id}`)}
    />
  );
};

export default AnnouncementsScreen;
