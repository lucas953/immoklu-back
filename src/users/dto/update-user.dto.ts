import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsIn(["en", "es", "fr"])
  preferredLocale?: "en" | "es" | "fr";
}
