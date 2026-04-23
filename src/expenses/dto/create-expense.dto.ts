import { Transform, Type } from "class-transformer";
import { IsDate, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateExpenseDto {
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  amount!: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  currency!: string;

  @Type(() => Date)
  @IsDate()
  expenseDate!: Date;

  @IsOptional()
  @IsString()
  vendorPayee?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
