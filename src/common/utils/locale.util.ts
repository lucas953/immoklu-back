import { AppLocale } from "@prisma/client";

export function toAppLocale(locale: "en" | "es" | "fr") {
  const mapping: Record<"en" | "es" | "fr", AppLocale> = {
    en: AppLocale.EN,
    es: AppLocale.ES,
    fr: AppLocale.FR
  };

  return mapping[locale];
}

export function fromAppLocale(locale: AppLocale) {
  const mapping: Record<AppLocale, "en" | "es" | "fr"> = {
    EN: "en",
    ES: "es",
    FR: "fr"
  };

  return mapping[locale];
}
