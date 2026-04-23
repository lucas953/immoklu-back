import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength
} from "class-validator";
import { TenantType } from "@prisma/client";

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim().toLowerCase()))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(TenantType)
  tenantType!: TenantType;

  @IsOptional()
  @IsString()
  notes?: string;
}
