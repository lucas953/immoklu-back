import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class PaymentStatusDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidDate?: Date;

  @IsOptional()
  @IsString()
  amountPaid?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
