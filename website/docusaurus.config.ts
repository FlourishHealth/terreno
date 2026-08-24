import type * as Preset from "@docusaurus/preset-classic";
import type {Config} from "@docusaurus/types";
import {themes as prismThemes} from "prism-react-renderer";

const demoUrl = process.env.DEMO_URL ?? "https://terreno-demo.netlify.app";
const docsUrl = process.env.DOCS_URL ?? "https://terreno-docs.netlify.app";
// PR previews only need the current docs tree. Historical versions live in
// website/versioned_docs and dominate `docusaurus build` time (~4 extra trees).
const isPreview = process.env.DOCS_PREVIEW === "true";

const searchTheme: [string, Record<string, unknown>] = [
  require.resolve("@easyops-cn/docusaurus-search-local"),
  {
    docsRouteBasePath: "/",
    hashed: true,
    indexBlog: false,
    language: ["en"],
  },
];

const config: Config = {
  baseUrl: "/",
  favicon: "img/logo.svg",
  future: {
    faster: true,
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
    },
  },
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
  plugins: [
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          {
            from: "/next/reference/rtk",
            to: "/next/how-to/migrate-rtk-to-syncdb",
          },
        ],
      },
    ],
  ],
  presets: [
    [
      "classic",
      {
        blog: false,
        docs: {
          disableVersioning: isPreview,
          editUrl: "https://github.com/flourishhealth/terreno/tree/master/docs/",
          exclude: ["**/implementationPlans/**", "**/tasks/**"],
          path: "../docs",
          routeBasePath: "/",
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          sidebarPath: "./sidebars.ts",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
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
  // Local search indexes every MDX page. Skip it on PR previews — the lunr
  // pass is a large fraction of `docusaurus build` and reviewers use in-page
  // find. Production `master` still ships the search index.
  themes: isPreview ? [] : [searchTheme],
  title: "Terreno",
  url: docsUrl,
};

export default config;
