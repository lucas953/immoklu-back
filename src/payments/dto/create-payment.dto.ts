import { Transform, Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length
} from "class-validator";
import { PaymentMethod, RentPaymentStatus } from "@prisma/client";

export class CreatePaymentDto {
  @IsUUID()
  leaseId!: string;

  @Type(() => Date)
  @IsDate()
  periodStart!: Date;

  @Type(() => Date)
  @IsDate()
  periodEnd!: Date;

  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidDate?: Date;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  amountDue!: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  amountPaid?: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsEnum(RentPaymentStatus)
  status!: RentPaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
