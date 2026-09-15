import {Announcement} from "@terreno/announcements";
import {findOneOrNoneFor, logger, type SeedContext} from "@terreno/api";
import {DateTime} from "luxon";

/** Stable title for the legacy welcome announcement archived on seed when present. */
export const LEGACY_WELCOME_ANNOUNCEMENT_TITLE = "Welcome to Terreno announcements";

/** Stable title for the staff-only required modal seeded in the example app. */
export const STAFF_MODAL_ANNOUNCEMENT_TITLE = "Example staff operations bulletin";

/** Stable title for the patient-only dismiss-only banner seeded in the example app. */
export const PATIENT_BANNER_ANNOUNCEMENT_TITLE = "Example patient care tip";

const archiveLegacyWelcomeAnnouncement = async (): Promise<void> => {
  const existing = await findOneOrNoneFor(Announcement, {
    title: LEGACY_WELCOME_ANNOUNCEMENT_TITLE,
  });
  if (!existing) {
    return;
  }
  if (existing.status === "archived") {
    logger.info("Skipping announcement seed — legacy welcome already archived");
    return;
  }

  existing.status = "archived";
  existing.archivedAt = DateTime.utc().toJSDate();
  await existing.save();
  logger.info("Archived legacy welcome announcement");
};

const seedStaffModalAnnouncement = async (): Promise<void> => {
  const existing = await findOneOrNoneFor(Announcement, {
    title: STAFF_MODAL_ANNOUNCEMENT_TITLE,
  });
  if (existing) {
    logger.info("Skipping announcement seed — staff modal already exists");
    return;
  }

  await Announcement.create({
    acknowledgementPolicy: "required",
    audienceType: "staff",
    body: "## Staff-only modal\n\nThis interrupt requires acknowledgement and is visible only when `audienceType` is **staff** (example: `user.admin === true`).",
    displayMode: "modal",
    priority: 20,
    publishedAt: DateTime.utc().toJSDate(),
    status: "published",
    title: STAFF_MODAL_ANNOUNCEMENT_TITLE,
    version: 1,
  });

  logger.info("Seeded staff modal announcement");
};

const seedPatientBannerAnnouncement = async (): Promise<void> => {
  const existing = await findOneOrNoneFor(Announcement, {
    title: PATIENT_BANNER_ANNOUNCEMENT_TITLE,
  });
  if (existing) {
    logger.info("Skipping announcement seed — patient banner already exists");
    return;
  }

  await Announcement.create({
    acknowledgementPolicy: "dismiss-only",
    audienceType: "patient",
    body: "## Patient banner\n\nThis non-blocking banner is dismiss-only and targets `audienceType: patient`.",
    displayMode: "banner",
    priority: 5,
    publishedAt: DateTime.utc().toJSDate(),
    status: "published",
    title: PATIENT_BANNER_ANNOUNCEMENT_TITLE,
    version: 1,
  });

  logger.info("Seeded patient banner announcement");
};

export const seedAnnouncements = async (_context: SeedContext): Promise<void> => {
  await archiveLegacyWelcomeAnnouncement();
  await seedStaffModalAnnouncement();
  await seedPatientBannerAnnouncement();
};
