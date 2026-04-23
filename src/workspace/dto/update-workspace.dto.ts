import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Length, Matches, MinLength } from "class-validator";

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  defaultCurrency?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsIn(["en", "es", "fr"])
  preferredLocale?: "en" | "es" | "fr";

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/, {
    message: "timezone must be a valid IANA timezone, for example Europe/Madrid."
  })
  timezone?: string;
}
