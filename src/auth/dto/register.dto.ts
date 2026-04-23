import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsString, Length, Matches, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  workspaceName!: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(2, 2)
  countryCode!: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Length(3, 3)
  defaultCurrency!: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsIn(["en", "es", "fr"])
  preferredLocale!: "en" | "es" | "fr";

  @IsString()
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/, {
    message: "timezone must be a valid IANA timezone, for example Europe/Madrid."
  })
  timezone!: string;
}
