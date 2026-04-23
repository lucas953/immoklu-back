import { Transform, Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min
} from "class-validator";
import { LeaseStatus, PaymentFrequency } from "@prisma/client";

export class CreateLeaseDto {
  @IsUUID()
  propertyId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsUUID()
  tenantId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  monthlyRent!: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  depositAmount?: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  currency!: string;

  @IsEnum(PaymentFrequency)
  paymentFrequency!: PaymentFrequency;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDayOfMonth!: number;

  @IsEnum(LeaseStatus)
  status!: LeaseStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
