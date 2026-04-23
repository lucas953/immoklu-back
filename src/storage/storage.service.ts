import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageProvider } from "@prisma/client";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

@Injectable()
export class StorageService {
  readonly client: S3Client;
  readonly bucket: string;
  readonly provider: StorageProvider;

  constructor(private readonly configService: ConfigService) {
    this.bucket = configService.getOrThrow<string>("STORAGE_BUCKET");
    this.provider = configService.getOrThrow<StorageProvider>("STORAGE_PROVIDER");

    const storageConfig: S3ClientConfig = {
      region: configService.get<string>("STORAGE_REGION") ?? "auto"
    };

    const endpoint = configService.get<string>("STORAGE_ENDPOINT");
    if (endpoint) {
      storageConfig.endpoint = endpoint;
    }

    const accessKeyId = configService.get<string>("STORAGE_ACCESS_KEY_ID");
    const secretAccessKey = configService.get<string>("STORAGE_SECRET_ACCESS_KEY");
    if (accessKeyId && secretAccessKey) {
      storageConfig.credentials = {
        accessKeyId,
        secretAccessKey
      };
    }

    this.client = new S3Client(storageConfig);
  }

  createDocumentObjectKey(workspaceId: string, originalFileName: string) {
    return `workspaces/${workspaceId}/documents/${randomUUID()}-${sanitizeFileName(originalFileName)}`;
  }

  async createUploadUrl({
    objectKey,
    mimeType,
    sizeBytes
  }: {
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    const expiresInSeconds = 15 * 60;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: sizeBytes
    });

    try {
      const uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds
      });

      return {
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        headers: {
          "Content-Type": mimeType
        }
      };
    } catch {
      throw new ServiceUnavailableException(
        "Document storage is not configured yet. Add your storage endpoint and credentials to continue."
      );
    }
  }

  async createDownloadUrl({
    objectKey,
    fileName
  }: {
    objectKey: string;
    fileName?: string;
  }) {
    const expiresInSeconds = 15 * 60;
    const dispositionFileName = sanitizeFileName(fileName ?? "document");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ResponseContentDisposition: `inline; filename="${dispositionFileName}"`
    });

    try {
      const url = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds
      });

      return {
        url,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      };
    } catch {
      throw new ServiceUnavailableException(
        "Document storage is not configured yet. Add your storage endpoint and credentials to continue."
      );
    }
  }

  async deleteObject(objectKey: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey
        })
      );
    } catch {
      throw new ServiceUnavailableException(
        "Immoklu could not delete the file from storage. Please try again once storage is reachable."
      );
    }
  }
}
