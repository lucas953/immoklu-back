import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

@Injectable()
export class StorageService {
  readonly client: S3Client;
  readonly bucket: string;

  constructor(configService: ConfigService) {
    this.bucket = configService.getOrThrow<string>("STORAGE_BUCKET");
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
}
