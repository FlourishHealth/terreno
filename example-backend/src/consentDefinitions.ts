import type {ConsentFormDefinition} from "@terreno/api";

export const consentDefinitions: Record<string, ConsentFormDefinition> = {
  "privacy-policy": {
    content: {
      en: `# Privacy Policy

We are committed to protecting your personal information.

## Information We Collect

We collect information you provide directly to us, such as when you create an account.

## How We Use Your Information

We use the information we collect to provide, maintain, and improve our services.

## Data Security

We implement appropriate technical and organizational measures to protect your personal information.

## Contact Us

If you have any questions about this Privacy Policy, please contact us.`,
    },
    order: 2,
    required: true,
    requireScrollToBottom: true,
    title: "Privacy Policy",
    type: "privacy",
  },
  "terms-of-service": {
    captureSignature: true,
    content: {
      en: `# Terms of Service

Welcome to our application. By using our service, you agree to the following terms...

## 1. Acceptance of Terms

By accessing or using our application, you agree to be bound by these Terms of Service.

## 2. Use of Service

You agree to use the service only for lawful purposes and in a way that does not infringe the rights of others.

## 3. Privacy

Your use of the service is also governed by our Privacy Policy.

## 4. Changes to Terms

We reserve the right to modify these terms at any time. We will notify you of any changes.`,
    },
    order: 1,
    required: true,
    requireScrollToBottom: true,
    title: "Terms of Service",
    type: "terms",
  },
};
