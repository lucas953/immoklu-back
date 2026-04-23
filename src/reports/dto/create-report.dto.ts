import { Transform, Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsUUID } from "class-validator";
import { ReportFormat, ReportType } from "@prisma/client";

export class CreateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @Type(() => Date)
  @IsDate()
  fromDate!: Date;

  @Type(() => Date)
  @IsDate()
  toDate!: Date;

  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim()))
  @IsOptional()
  @IsUUID()
  propertyId?: string;
}
