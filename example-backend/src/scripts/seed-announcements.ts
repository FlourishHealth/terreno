import {Announcement} from "@terreno/announcements";
import {findOneOrNoneFor, logger, type SeedContext} from "@terreno/api";
import {DateTime} from "luxon";

export const seedAnnouncements = async (_context: SeedContext): Promise<void> => {
  const existing = await findOneOrNoneFor(Announcement, {
    title: "Welcome to Terreno announcements",
  });
  if (existing) {
    logger.info("Skipping announcement seed — welcome announcement already exists");
    return;
  }

  await Announcement.create({
    body: "## What is new\n\nProduct update announcements are now built into Terreno.\n\n[Watch a quick overview](https://www.youtube.com/watch?v=dQw4w9WgXcQ)",
    priority: 10,
    publishedAt: DateTime.utc().toJSDate(),
    requiresAcknowledgement: true,
    status: "published",
    title: "Welcome to Terreno announcements",
    version: 1,
  });

  logger.info("Seeded welcome announcement");
};
