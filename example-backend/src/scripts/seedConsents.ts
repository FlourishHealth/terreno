import {ConsentForm, logger} from "@terreno/api";
import mongoose from "mongoose";

const TERMS_CONTENT_EN = `# Terms of Service

Welcome to our application. By using our service, you agree to the following terms...

## 1. Acceptance of Terms

By accessing or using our application, you agree to be bound by these Terms of Service.

## 2. Use of Service

You agree to use the service only for lawful purposes and in a way that does not infringe the rights of others.

## 3. Privacy

Your use of the service is also governed by our Privacy Policy.

## 4. Changes to Terms

We reserve the right to modify these terms at any time. We will notify you of any changes.`;

const PRIVACY_CONTENT_EN = `# Privacy Policy

We are committed to protecting your personal information.

## Information We Collect

We collect information you provide directly to us, such as when you create an account.

## How We Use Your Information

We use the information we collect to provide, maintain, and improve our services.

## Data Security

We implement appropriate technical and organizational measures to protect your personal information.

## Contact Us

If you have any questions about this Privacy Policy, please contact us.`;

const seed = async (): Promise<void> => {
  await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1/terreno-example");

  const existing = await ConsentForm.find({slug: {$in: ["terms-of-service", "privacy-policy"]}});

  if (existing.length === 0) {
    await ConsentForm.create([
      {
        active: true,
        agreeButtonText: "I Accept the Terms",
        captureSignature: true,
        content: new Map([["en", TERMS_CONTENT_EN]]),
        order: 1,
        required: true,
        requireScrollToBottom: true,
        slug: "terms-of-service",
        title: "Terms of Service",
        type: "terms",
        version: 1,
      },
      {
        active: true,
        content: new Map([["en", PRIVACY_CONTENT_EN]]),
        order: 2,
        required: true,
        requireScrollToBottom: true,
        slug: "privacy-policy",
        title: "Privacy Policy",
        type: "privacy",
        version: 1,
      },
    ]);
    logger.info("Seeded 2 consent forms");
  } else {
    logger.info(`Skipping seed — ${existing.length} consent form(s) already exist`);
  }

  await mongoose.disconnect();
};

seed().catch((err) => {
  logger.error("Seed failed:", err);
  process.exit(1);
});
