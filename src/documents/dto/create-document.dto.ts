import { Transform } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min
} from "class-validator";
import { DocumentCategory } from "@prisma/client";

function normalizeNullableString(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return String(value).trim();
}

export class CreateDocumentDto {
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsString()
  title?: string | null;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  originalFileName!: string;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  objectKey!: string;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsString()
  checksum?: string | null;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsUUID()
  propertyId?: string | null;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsUUID()
  tenantId?: string | null;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsUUID()
  leaseId?: string | null;

  @Transform(({ value }) => normalizeNullableString(value))
  @IsOptional()
  @IsUUID()
  expenseId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((tag) => String(tag).trim())
          .filter(Boolean)
      : []
  )
  @IsArray()
  @IsString({ each: true })
  tagNames!: string[];
}
