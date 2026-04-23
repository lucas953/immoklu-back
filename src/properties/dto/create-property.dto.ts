import { Transform, Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength
} from "class-validator";
import { PropertyStatus, PropertyType } from "@prisma/client";

export class CreatePropertyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(3)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsOptional()
  @IsString()
  stateRegion?: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(2, 2)
  countryCode!: string;

  @IsEnum(PropertyType)
  type!: PropertyType;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  purchasePrice!: string;

  @Type(() => Date)
  @IsDate()
  acquisitionDate!: Date;

  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  currentValue?: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  currency!: string;

  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
