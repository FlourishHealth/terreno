import {AdminShellLayout, JobsJobDetail} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const JobsJobDetailRoute: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const jobId = Array.isArray(id) ? id[0] : (id ?? "");

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {href: "/jobs", label: "Jobs"}, {label: "Detail"}]}
      configurationPath="/configuration"
      rolesPath="/roles"
      routeBase=""
    >
      <JobsJobDetail api={terrenoApi} jobId={jobId} routeBase="" />
    </AdminShellLayout>
  );
};

export default JobsJobDetailRoute;
