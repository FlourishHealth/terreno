import {Storage} from "@google-cloud/storage";
import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import type express from "express";
import multer from "multer";

export interface DocumentStorageOptions {
  bucketName: string;
  folderPrefix?: string;
  basePath?: string;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  signedUrlExpiration?: number;
}

export interface DocumentFile {
  name: string;
  fullPath: string;
  size: number;
  contentType: string | undefined;
  updated: string;
  isFolder: boolean;
}

export interface DocumentListResponse {
  files: DocumentFile[];
  folders: string[];
  prefix: string;
}

const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_SIGNED_URL_EXPIRATION = 60 * 60 * 1000; // 1 hour

const isAdmin = (req: express.Request): boolean => {
  const user = (req as any).user;
  return user?.admin === true;
};

export class DocumentStorageApp {
  private options: DocumentStorageOptions;
  private storage: Storage;

  constructor(options: DocumentStorageOptions) {
    this.options = options;
    this.storage = new Storage();
  }

  private get bucket() {
    return this.storage.bucket(this.options.bucketName);
  }

  private get prefix() {
    return this.options.folderPrefix ?? "";
  }

  private get allowedMimeTypes(): Set<string> {
    if (this.options.allowedMimeTypes) {
      return new Set(this.options.allowedMimeTypes);
    }
    return DEFAULT_ALLOWED_MIME_TYPES;
  }

  register(app: express.Application): void {
    const basePath = this.options.basePath ?? "/documents";
    const maxFileSize = this.options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const signedUrlExpiration = this.options.signedUrlExpiration ?? DEFAULT_SIGNED_URL_EXPIRATION;

    const allowedMimeTypes = this.allowedMimeTypes;

    const upload = multer({
      fileFilter: (_req, file, cb) => {
        if (allowedMimeTypes.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
      },
      limits: {fileSize: maxFileSize},
      storage: multer.memoryStorage(),
    });

    const adminGuard = [
      authenticateMiddleware(),
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        if (!isAdmin(req)) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        next();
      },
    ];

    // GET basePath/ — List files and folders
    app.get(
      `${basePath}/`,
      ...adminGuard,
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const queryPrefix = (req.query.prefix as string) ?? "";
        const fullPrefix = `${this.prefix}${queryPrefix}`;

        const [files, , apiResponse] = await this.bucket.getFiles({
          delimiter: "/",
          prefix: fullPrefix,
        });

        const documentFiles: DocumentFile[] = files
          .filter((file) => file.name !== fullPrefix)
          .map((file) => ({
            contentType: file.metadata.contentType as string | undefined,
            fullPath: file.name.slice(this.prefix.length),
            isFolder: false,
            name: file.name.split("/").filter(Boolean).pop() ?? file.name,
            size: Number(file.metadata.size ?? 0),
            updated: file.metadata.updated as string,
          }));

        const prefixes = ((apiResponse as any)?.prefixes as string[] | undefined) ?? [];
        const folders = prefixes.map((p) => {
          const relative = p.slice(this.prefix.length);
          return relative;
        });

        const response: DocumentListResponse = {
          files: documentFiles,
          folders,
          prefix: queryPrefix,
        };

        return res.json(response);
      })
    );

    // POST basePath/ — Upload a file
    app.post(
      `${basePath}/`,
      ...adminGuard,
      upload.single("file") as any,
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
          throw new APIError({status: 400, title: "No file provided"});
        }

        const targetPrefix = (req.body.prefix as string) ?? "";
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const gcsPath = `${this.prefix}${targetPrefix}${sanitizedFilename}`;

        const gcsFile = this.bucket.file(gcsPath);
        await gcsFile.save(file.buffer, {
          contentType: file.mimetype,
        });

        const documentFile: DocumentFile = {
          contentType: file.mimetype,
          fullPath: `${targetPrefix}${sanitizedFilename}`,
          isFolder: false,
          name: sanitizedFilename,
          size: file.buffer.length,
          updated: new Date().toISOString(),
        };

        return res.json(documentFile);
      })
    );

    // GET basePath/url/* — Get signed download URL
    app.get(
      `${basePath}/url/*`,
      ...adminGuard,
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const filePath = (req.params as any)[0] as string;
        if (!filePath) {
          throw new APIError({status: 400, title: "File path is required"});
        }

        const gcsPath = `${this.prefix}${filePath}`;
        const gcsFile = this.bucket.file(gcsPath);

        const [exists] = await gcsFile.exists();
        if (!exists) {
          throw new APIError({status: 404, title: "File not found"});
        }

        const [url] = await gcsFile.getSignedUrl({
          action: "read",
          expires: Date.now() + signedUrlExpiration,
          version: "v4",
        });

        return res.json({url});
      })
    );

    // DELETE basePath/* — Delete a file
    app.delete(
      `${basePath}/*`,
      ...adminGuard,
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const filePath = (req.params as any)[0] as string;
        if (!filePath) {
          throw new APIError({status: 400, title: "File path is required"});
        }

        const gcsPath = `${this.prefix}${filePath}`;
        const gcsFile = this.bucket.file(gcsPath);

        await gcsFile.delete({ignoreNotFound: true});

        return res.json({success: true});
      })
    );
  }
}
