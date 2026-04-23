import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString } from "class-validator";

export class TerminateLeaseDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminatedAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
