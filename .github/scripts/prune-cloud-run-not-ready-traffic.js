/**
 * Rebuild Cloud Run traffic so failed tagged revisions are omitted.
 *
 * `gcloud run services update-traffic --remove-tags` copies the failed
 * revision into the next spec (untagged, 0%) and Cloud Run rejects that.
 * `--set-tags` / `--clear-tags` replace the tag set so a not-Ready
 * revision is not in the spec at all.
 *
 * Usage:
 *   node prune-cloud-run-not-ready-traffic.js SERVICE.json REVISIONS.json
 */
const fs = require("fs");

const isRevisionReady = (revision) => {
  const conditions = revision?.status?.conditions || [];
  return conditions.some((condition) => condition.type === "Ready" && condition.status === "True");
};

const readyRevisionNames = (revisions) => {
  return revisions
    .filter((revision) => isRevisionReady(revision))
    .map((revision) => revision.metadata.name)
    .filter(Boolean);
};

const trafficTargets = (service) => {
  const spec = Array.isArray(service?.spec?.traffic) ? service.spec.traffic : [];
  const status = Array.isArray(service?.status?.traffic) ? service.status.traffic : [];
  if (spec.length === 0) {
    return status;
  }
  const statusLive = status.find((target) => (target.percent ?? 0) === 100 && target.revisionName);
  return spec.map((target) => {
    if (target.revisionName) {
      return target;
    }
    if ((target.percent ?? 0) === 100 && statusLive?.revisionName) {
      return {...target, revisionName: statusLive.revisionName};
    }
    const tagged = status.find(
      (candidate) => candidate.tag && candidate.tag === target.tag && candidate.revisionName
    );
    if (tagged?.revisionName) {
      return {...target, revisionName: tagged.revisionName};
    }
    return target;
  });
};

const pruneNotReadyTaggedTraffic = ({readyNames, traffic}) => {
  const ready = new Set(readyNames);
  return traffic.filter((target) => {
    const percent = target.percent ?? 0;
    if (percent > 0) {
      return true;
    }
    if (target.latestRevision === true) {
      return true;
    }
    if (target.tag && target.revisionName && ready.has(target.revisionName)) {
      return true;
    }
    return false;
  });
};

const liveRevisionName = (traffic) => {
  const live = traffic.find((target) => (target.percent ?? 0) === 100 && target.revisionName);
  return live?.revisionName;
};

const updateTrafficFlags = (prunedTraffic) => {
  const live = liveRevisionName(prunedTraffic);
  if (!live) {
    throw new Error("No 100% Cloud Run traffic revision to keep");
  }
  const tagPairs = prunedTraffic
    .filter((target) => target.tag && target.revisionName)
    .map((target) => `${target.tag}=${target.revisionName}`);
  if (tagPairs.length === 0) {
    return [`--to-revisions=${live}=100`, "--clear-tags"];
  }
  return [`--to-revisions=${live}=100`, `--set-tags=${tagPairs.join(",")}`];
};

const flagsFromDescribe = ({revisions, service}) => {
  const readyNames = readyRevisionNames(revisions);
  const traffic = trafficTargets(service);
  const pruned = pruneNotReadyTaggedTraffic({readyNames, traffic});
  return updateTrafficFlags(pruned);
};

const notReadyTaggedRevisionNames = ({readyNames, traffic}) => {
  const ready = new Set(readyNames);
  const names = traffic
    .filter((target) => target.tag && target.revisionName && !ready.has(target.revisionName))
    .map((target) => target.revisionName);
  return [...new Set(names)];
};

const planFromDescribe = ({revisions, service}) => {
  const readyNames = readyRevisionNames(revisions);
  const traffic = trafficTargets(service);
  return {
    dropped: notReadyTaggedRevisionNames({readyNames, traffic}),
    flags: flagsFromDescribe({revisions, service}),
  };
};

const run = () => {
  const jsonMode = process.argv[2] === "--json";
  const servicePath = jsonMode ? process.argv[3] : process.argv[2];
  const revisionsPath = jsonMode ? process.argv[4] : process.argv[3];
  if (!servicePath || !revisionsPath) {
    throw new Error(
      "Usage: node prune-cloud-run-not-ready-traffic.js [--json] SERVICE.json REVISIONS.json"
    );
  }
  const service = JSON.parse(fs.readFileSync(servicePath, "utf8"));
  const revisions = JSON.parse(fs.readFileSync(revisionsPath, "utf8"));
  const plan = planFromDescribe({revisions, service});
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(plan)}\n`);
    return;
  }
  process.stdout.write(`${plan.flags.join(" ")}\n`);
};

if (require.main === module) {
  run();
}

module.exports = {
  flagsFromDescribe,
  notReadyTaggedRevisionNames,
  planFromDescribe,
  pruneNotReadyTaggedTraffic,
  readyRevisionNames,
  trafficTargets,
  updateTrafficFlags,
};
