import type {PipelineStage, Types} from "mongoose";
import {Announcement} from "./models/announcement";
import {AnnouncementAcknowledgement} from "./models/announcementAcknowledgement";
import {AnnouncementClickEvent} from "./models/announcementClickEvent";
import {AnnouncementImpression} from "./models/announcementImpression";
import {resolveAcknowledgementPolicy, resolveAudienceType, resolveDisplayMode} from "./pending";
import type {
  AcknowledgementPolicy,
  AnnouncementDocument,
  AnnouncementOverviewMetrics,
  AnnouncementOverviewResponse,
  AnnouncementOverviewRow,
  AnnouncementOverviewTotals,
} from "./types";

const NOT_DELETED = {deleted: {$ne: true}} as const;

export interface OverviewPagination {
  limit: number;
  page: number;
}

export const parseOverviewPagination = (query: {
  limit?: unknown;
  page?: unknown;
}): OverviewPagination => {
  const parsedLimit = Number(query.limit ?? 20);
  const parsedPage = Number(query.page ?? 1);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
    : 20;
  const page = Number.isFinite(parsedPage) ? Math.max(Math.trunc(parsedPage), 1) : 1;
  return {limit, page};
};

interface MetricCountRow {
  _id: Types.ObjectId;
  count: number;
}

const countEventTotals = async (): Promise<{
  acknowledgements: number;
  clicks: number;
  impressions: number;
}> => {
  const [impressionRows, acknowledgementRows, clickRows] = await Promise.all([
    AnnouncementImpression.aggregate<{count: number}>([{$match: NOT_DELETED}, {$count: "count"}]),
    AnnouncementAcknowledgement.aggregate<{count: number}>([
      {$match: NOT_DELETED},
      {$count: "count"},
    ]),
    AnnouncementClickEvent.aggregate<{count: number}>([{$match: NOT_DELETED}, {$count: "count"}]),
  ]);

  return {
    acknowledgements: acknowledgementRows[0]?.count ?? 0,
    clicks: clickRows[0]?.count ?? 0,
    impressions: impressionRows[0]?.count ?? 0,
  };
};

const countMetricsByAnnouncement = async (
  announcementIds: Types.ObjectId[]
): Promise<Map<string, AnnouncementOverviewMetrics>> => {
  const metrics = new Map<string, AnnouncementOverviewMetrics>();
  for (const id of announcementIds) {
    metrics.set(id.toString(), {acknowledgements: 0, clicks: 0, impressions: 0});
  }

  if (announcementIds.length === 0) {
    return metrics;
  }

  const matchByAnnouncement: PipelineStage.Match = {
    $match: {
      ...NOT_DELETED,
      announcementId: {$in: announcementIds},
    },
  };

  const [impressionCounts, acknowledgementCounts, clickCounts] = await Promise.all([
    AnnouncementImpression.aggregate<MetricCountRow>([
      matchByAnnouncement,
      {$group: {_id: "$announcementId", count: {$sum: 1}}},
    ]),
    AnnouncementAcknowledgement.aggregate<MetricCountRow>([
      matchByAnnouncement,
      {$group: {_id: "$announcementId", count: {$sum: 1}}},
    ]),
    AnnouncementClickEvent.aggregate<MetricCountRow>([
      matchByAnnouncement,
      {$group: {_id: "$announcementId", count: {$sum: 1}}},
    ]),
  ]);

  for (const row of impressionCounts) {
    const existing = metrics.get(row._id.toString()) ?? {
      acknowledgements: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.impressions = row.count;
    metrics.set(row._id.toString(), existing);
  }

  for (const row of acknowledgementCounts) {
    const existing = metrics.get(row._id.toString()) ?? {
      acknowledgements: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.acknowledgements = row.count;
    metrics.set(row._id.toString(), existing);
  }

  for (const row of clickCounts) {
    const existing = metrics.get(row._id.toString()) ?? {
      acknowledgements: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.clicks = row.count;
    metrics.set(row._id.toString(), existing);
  }

  return metrics;
};

const toOverviewRow = ({
  announcement,
  defaultAcknowledgementPolicy,
  metrics,
}: {
  announcement: AnnouncementDocument;
  defaultAcknowledgementPolicy: AcknowledgementPolicy;
  metrics: AnnouncementOverviewMetrics;
}): AnnouncementOverviewRow => ({
  _id: announcement._id.toString(),
  acknowledgementPolicy: resolveAcknowledgementPolicy({
    announcement,
    defaultAcknowledgementPolicy,
  }),
  audienceType: resolveAudienceType(announcement),
  displayMode: resolveDisplayMode(announcement),
  expiresAt: announcement.expiresAt?.toISOString(),
  metrics,
  priority: announcement.priority,
  publishedAt: announcement.publishedAt?.toISOString(),
  status: announcement.status,
  title: announcement.title,
  version: announcement.version,
});

export const fetchAnnouncementOverview = async ({
  defaultAcknowledgementPolicy,
  limit,
  page,
}: {
  defaultAcknowledgementPolicy: AcknowledgementPolicy;
  limit: number;
  page: number;
}): Promise<AnnouncementOverviewResponse> => {
  const skip = (page - 1) * limit;

  const [facetResult, eventTotals] = await Promise.all([
    Announcement.aggregate<{
      paginated: AnnouncementDocument[];
      statusCounts: Array<{_id: AnnouncementDocument["status"]; count: number}>;
      totalCount: Array<{count: number}>;
    }>([
      {$match: NOT_DELETED},
      {
        $facet: {
          paginated: [
            // biome-ignore assist/source/useSortedKeys: MongoDB applies sort keys in insertion order
            {$sort: {priority: -1, publishedAt: -1, _id: -1}},
            {$skip: skip},
            {$limit: limit},
          ],
          statusCounts: [{$group: {_id: "$status", count: {$sum: 1}}}],
          totalCount: [{$count: "count"}],
        },
      },
    ]),
    countEventTotals(),
  ]);

  const facet = facetResult[0];
  const paginated = facet?.paginated ?? [];
  const total = facet?.totalCount[0]?.count ?? 0;
  const statusCounts = facet?.statusCounts ?? [];

  const statusCountMap = new Map(statusCounts.map((row) => [row._id, row.count]));
  const totals: AnnouncementOverviewTotals = {
    acknowledgements: eventTotals.acknowledgements,
    announcements: total,
    archived: statusCountMap.get("archived") ?? 0,
    clicks: eventTotals.clicks,
    draft: statusCountMap.get("draft") ?? 0,
    impressions: eventTotals.impressions,
    published: statusCountMap.get("published") ?? 0,
  };

  const metricsByAnnouncement = await countMetricsByAnnouncement(
    paginated.map((announcement) => announcement._id)
  );

  const data = paginated.map((announcement) =>
    toOverviewRow({
      announcement,
      defaultAcknowledgementPolicy,
      metrics: metricsByAnnouncement.get(announcement._id.toString()) ?? {
        acknowledgements: 0,
        clicks: 0,
        impressions: 0,
      },
    })
  );

  return {
    data,
    limit,
    more: skip + data.length < total,
    page,
    total,
    totals,
  };
};
