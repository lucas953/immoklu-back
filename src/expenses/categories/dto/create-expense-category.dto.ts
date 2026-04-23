import { Transform } from "class-transformer";
import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
