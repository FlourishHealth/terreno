import type * as Preset from "@docusaurus/preset-classic";
import type {Config} from "@docusaurus/types";
import {themes as prismThemes} from "prism-react-renderer";

const demoUrl = process.env.DEMO_URL ?? "https://terreno-demo.netlify.app";
const docsUrl = process.env.DOCS_URL ?? "https://terreno-docs.netlify.app";

const config: Config = {
  baseUrl: "/",
  favicon: "img/logo.svg",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  markdown: {
    format: "detect",
  },
  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",
  organizationName: "flourishhealth",
  presets: [
    [
      "classic",
      {
        blog: false,
        docs: {
          editUrl: "https://github.com/flourishhealth/terreno/tree/master/docs/",
          exclude: ["**/implementationPlans/**", "**/tasks/**"],
          path: "../docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          {
            from: "/reference/rtk",
            to: "/next/how-to/migrate-rtk-to-syncdb",
          },
        ],
      },
    ],
  ],
  projectName: "terreno",
  tagline: "Full-stack React Native and Express/Mongoose framework",
  themeConfig: {
    customFields: {
      demoUrl,
    },
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} Flourish Health.`,
      links: [
        {
          items: [
            {label: "Getting started", to: "/tutorials/getting-started"},
            {label: "API reference", to: "/reference/api"},
            {label: "UI components", to: "/reference/components/button"},
          ],
          title: "Docs",
        },
        {
          items: [
            {href: "https://github.com/flourishhealth/terreno", label: "GitHub"},
            {
              href: "https://github.com/FlourishHealth/terreno/blob/master/ROADMAP.md",
              label: "Roadmap",
            },
            {
              href: "https://github.com/FlourishHealth/terreno/discussions",
              label: "Discussions",
            },
            {
              href: "https://github.com/FlourishHealth/terreno/discussions/categories/docs-feedback",
              label: "Docs feedback",
            },
            {href: demoUrl, label: "Component demo"},
          ],
          title: "Community",
        },
      ],
      style: "dark",
    },
    navbar: {
      items: [
        // Enable docsVersionDropdown after the first `bun run docs:version` cut on release.
        {
          href: "https://github.com/flourishhealth/terreno",
          label: "GitHub",
          position: "right",
        },
        {
          href: demoUrl,
          label: "Component Demo",
          position: "right",
        },
      ],
      logo: {
        alt: "Terreno",
        src: "img/logo.svg",
      },
      title: "Terreno",
    },
    prism: {
      additionalLanguages: ["bash", "diff", "json", "typescript", "tsx"],
      darkTheme: prismThemes.dracula,
      theme: prismThemes.github,
    },
  } satisfies Preset.ThemeConfig,
  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        docsRouteBasePath: "/",
        hashed: true,
        indexBlog: false,
        language: ["en"],
      },
    ],
  ],
  title: "Terreno",
  url: docsUrl,
};

export default config;
