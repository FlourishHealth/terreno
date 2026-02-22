import {
  AIService,
  addAiRequestsExplorerRoutes,
  addFileRoutes,
  addGptHistoryRoutes,
  addGptRoutes,
  addMcpRoutes,
  FileStorageService,
  MCPService,
} from "@terreno/ai";
import type {ModelRouterOptions} from "@terreno/api";
import type {CoreTool} from "ai";
import {generateText, tool} from "ai";
import type express from "express";
import {PDFDocument, StandardFonts, rgb} from "pdf-lib";
import {z} from "zod";

let aiServiceInstance: AIService | undefined;
let mcpServiceInstance: MCPService | undefined;
let fileStorageServiceInstance: FileStorageService | undefined;

// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional dependency
const getGoogleModule = (): any => {
  try {
    return require("@ai-sdk/google");
  } catch {
    return undefined;
  }
};

const getAiService = (): AIService | undefined => {
  if (aiServiceInstance) {
    return aiServiceInstance;
  }

  const google = getGoogleModule();
  if (!google) {
    return undefined;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  aiServiceInstance = new AIService({
    model: google.google("gemini-2.5-flash"),
  });
  return aiServiceInstance;
};

const createModelFromKey = (apiKey: string) => {
  const google = getGoogleModule();
  if (!google) {
    throw new Error("Missing @ai-sdk/google dependency.");
  }
  const provider = google.createGoogleGenerativeAI({apiKey});
  return provider("gemini-2.5-flash");
};

const getMcpService = (): MCPService | undefined => {
  if (mcpServiceInstance) {
    return mcpServiceInstance;
  }

  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!mcpUrl) {
    return undefined;
  }

  mcpServiceInstance = new MCPService([
    {
      name: "default",
      transport: {type: "sse", url: mcpUrl},
    },
  ]);

  // Connect asynchronously - don't block startup
  void mcpServiceInstance.connect();
  return mcpServiceInstance;
};

const getFileStorageService = (): FileStorageService | undefined => {
  if (fileStorageServiceInstance) {
    return fileStorageServiceInstance;
  }

  const gcsBucket = process.env.GCS_BUCKET;
  if (!gcsBucket) {
    return undefined;
  }

  fileStorageServiceInstance = new FileStorageService({bucketName: gcsBucket});
  return fileStorageServiceInstance;
};

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 72;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - 2 * PDF_MARGIN;
const PDF_FONT_SIZE = 12;
const PDF_TITLE_SIZE = 24;
const PDF_HEADING_SIZE = 16;
const PDF_LINE_HEIGHT = PDF_FONT_SIZE * 1.5;

const generatePdfBytes = async ({
  title,
  content,
  author,
}: {
  title: string;
  content: string;
  author?: string;
}): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  if (author) {
    pdfDoc.setAuthor(author);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  const ensureSpace = (needed: number): void => {
    if (y - needed < PDF_MARGIN) {
      page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
      y = PDF_PAGE_HEIGHT - PDF_MARGIN;
    }
  };

  const drawWrappedText = (
    text: string,
    textFont: typeof font,
    fontSize: number,
    lineHeight: number,
  ): void => {
    const words = text.split(" ");
    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = textFont.widthOfTextAtSize(testLine, fontSize);

      if (width > PDF_CONTENT_WIDTH && line) {
        ensureSpace(lineHeight);
        page.drawText(line, {color: rgb(0, 0, 0), font: textFont, size: fontSize, x: PDF_MARGIN, y});
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ensureSpace(lineHeight);
      page.drawText(line, {color: rgb(0, 0, 0), font: textFont, size: fontSize, x: PDF_MARGIN, y});
      y -= lineHeight;
    }
  };

  // Title
  ensureSpace(PDF_TITLE_SIZE + PDF_LINE_HEIGHT);
  const titleWidth = boldFont.widthOfTextAtSize(title, PDF_TITLE_SIZE);
  page.drawText(title, {
    color: rgb(0, 0, 0),
    font: boldFont,
    size: PDF_TITLE_SIZE,
    x: Math.max(PDF_MARGIN, (PDF_PAGE_WIDTH - titleWidth) / 2),
    y,
  });
  y -= PDF_TITLE_SIZE + PDF_LINE_HEIGHT;

  // Content - split by double newlines for paragraphs
  const paragraphs = content.split("\n");
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      y -= PDF_LINE_HEIGHT * 0.5;
      continue;
    }

    // Detect markdown-style headings
    if (trimmed.startsWith("## ")) {
      y -= PDF_LINE_HEIGHT * 0.5;
      ensureSpace(PDF_HEADING_SIZE + PDF_LINE_HEIGHT);
      drawWrappedText(trimmed.slice(3), boldFont, PDF_HEADING_SIZE, PDF_HEADING_SIZE * 1.4);
      y -= PDF_LINE_HEIGHT * 0.3;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      y -= PDF_LINE_HEIGHT * 0.5;
      ensureSpace(PDF_TITLE_SIZE + PDF_LINE_HEIGHT);
      drawWrappedText(trimmed.slice(2), boldFont, PDF_TITLE_SIZE * 0.8, PDF_TITLE_SIZE);
      y -= PDF_LINE_HEIGHT * 0.3;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      ensureSpace(PDF_LINE_HEIGHT);
      page.drawText("•", {color: rgb(0, 0, 0), font, size: PDF_FONT_SIZE, x: PDF_MARGIN, y});
      const bulletText = trimmed.slice(2);
      const savedY = y;
      const bulletIndent = 15;
      const origWidth = PDF_CONTENT_WIDTH;
      // Draw indented text manually
      const bulletWords = bulletText.split(" ");
      let line = "";
      for (const word of bulletWords) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, PDF_FONT_SIZE);
        if (width > origWidth - bulletIndent && line) {
          ensureSpace(PDF_LINE_HEIGHT);
          page.drawText(line, {
            color: rgb(0, 0, 0),
            font,
            size: PDF_FONT_SIZE,
            x: PDF_MARGIN + bulletIndent,
            y,
          });
          y -= PDF_LINE_HEIGHT;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (y === savedY) {
          // First line of bullet, draw next to bullet character
          page.drawText(line, {
            color: rgb(0, 0, 0),
            font,
            size: PDF_FONT_SIZE,
            x: PDF_MARGIN + bulletIndent,
            y,
          });
          y -= PDF_LINE_HEIGHT;
        } else {
          ensureSpace(PDF_LINE_HEIGHT);
          page.drawText(line, {
            color: rgb(0, 0, 0),
            font,
            size: PDF_FONT_SIZE,
            x: PDF_MARGIN + bulletIndent,
            y,
          });
          y -= PDF_LINE_HEIGHT;
        }
      }
      continue;
    }

    drawWrappedText(trimmed, font, PDF_FONT_SIZE, PDF_LINE_HEIGHT);
    y -= PDF_LINE_HEIGHT * 0.3;
  }

  return pdfDoc.save();
};

const createImageModel = (apiKey: string) => {
  const google = getGoogleModule();
  if (!google) {
    throw new Error("Missing @ai-sdk/google dependency.");
  }
  const provider = google.createGoogleGenerativeAI({apiKey});
  return provider("gemini-2.5-flash-image");
};

const GENERATE_IMAGE_DESCRIPTION =
  "Generate an image from a text description. Use this when the user asks you to create, draw, or generate an image or picture.";

const GENERATE_PDF_DESCRIPTION =
  "Generate a PDF document. Use markdown-style formatting in content: # for main headings, ## for subheadings, - for bullet points, and blank lines between paragraphs.";

const createPerRequestTools = (req: express.Request): Record<string, CoreTool> => {
  const apiKey = req.headers["x-ai-api-key"] as string | undefined;
  if (!apiKey) {
    return {};
  }

  return {
    generate_image: tool({
      description: GENERATE_IMAGE_DESCRIPTION,
      execute: async ({prompt}) => {
        const imageModel = createImageModel(apiKey);
        const result = await generateText({
          model: imageModel,
          prompt,
          providerOptions: {google: {responseModalities: ["TEXT", "IMAGE"]}},
        });

        const imageFile = result.files?.find((f) => f.mimeType.startsWith("image/"));
        if (!imageFile) {
          return {description: "No image was generated. Try a different prompt.", success: false};
        }

        const dataUrl = `data:${imageFile.mimeType};base64,${imageFile.base64}`;
        return {
          description: `Generated image for: "${prompt}"`,
          fileData: dataUrl,
          filename: `image-${Date.now()}.png`,
          mimeType: imageFile.mimeType,
        };
      },
      experimental_toToolResultContent: (result) => {
        return [{text: result.description ?? "Image generated.", type: "text" as const}];
      },
      parameters: z.object({
        prompt: z.string().describe("Detailed description of the image to generate"),
      }),
    }),
  };
};

// Sample tools for demo purposes
const demoTools = {
  generate_pdf: tool({
    description: GENERATE_PDF_DESCRIPTION,
    execute: async ({title, content, author}) => {
      const pdfBytes = await generatePdfBytes({author, content, title});
      const base64 = Buffer.from(pdfBytes).toString("base64");
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_");
      const sizeKb = Math.round(pdfBytes.length / 1024);
      return {
        description: `Generated PDF document: "${title}" (${sizeKb}KB)`,
        fileData: `data:application/pdf;base64,${base64}`,
        filename: `${sanitizedTitle}.pdf`,
        mimeType: "application/pdf",
      };
    },
    experimental_toToolResultContent: (result) => {
      return [{text: result.description ?? "PDF generated.", type: "text" as const}];
    },
    parameters: z.object({
      author: z.string().optional().describe("Author name for PDF metadata"),
      content: z.string().describe(
        "The document content. Use # for headings, ## for subheadings, - for bullet points, and blank lines between paragraphs."
      ),
      title: z.string().describe("Title displayed at the top of the PDF"),
    }),
  }),
  get_current_time: tool({
    description: "Get the current date and time",
    execute: async ({timezone}) => {
      const now = new Date();
      return {
        time: now.toLocaleString("en-US", {timeZone: timezone ?? "UTC"}),
        timezone: timezone ?? "UTC",
      };
    },
    parameters: z.object({
      timezone: z.string().optional().describe("IANA timezone name (e.g., America/New_York)"),
    }),
  }),
};

export const addAiRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: ModelRouterOptions generic requires document type
  options?: Partial<ModelRouterOptions<any>>
): void => {
  const aiService = getAiService();
  const mcpService = getMcpService();
  const fileStorageService = getFileStorageService();

  addGptHistoryRoutes(router, options);
  addGptRoutes(router, {
    aiService,
    createModelFn: createModelFromKey,
    createRequestTools: createPerRequestTools,
    demoMode: !aiService,
    maxSteps: 5,
    mcpService,
    openApiOptions: options,
    toolChoice: "auto",
    tools: demoTools,
  });
  addAiRequestsExplorerRoutes(router, {openApiOptions: options});

  if (fileStorageService) {
    addFileRoutes(router, {
      fileStorageService,
      gcsBucket: process.env.GCS_BUCKET ?? "",
      openApiOptions: options,
    });
  }

  if (mcpService) {
    addMcpRoutes(router, {mcpService, openApiOptions: options});
  }
};
