import { Transform, Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

export class InitiateDocumentUploadDto {
  @Transform(({ value }) => String(value).trim())
  @IsString()
  originalFileName!: string;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
