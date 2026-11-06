import type { Locale, ProductCopyLocale } from "./types"
import { en } from "./en"
import { th } from "./th"
import { de } from "./de"
import { es } from "./es"
import { fr } from "./fr"
import { it } from "./it"
import { sv } from "./sv"
import { no } from "./no"
import { da } from "./da"
import { nl } from "./nl"
import { ar } from "./ar"

export * from "./types"

export const COPY_BY_LOCALE: Record<Locale, ProductCopyLocale> = { en, th, de, es, fr, it, sv, no, da, nl, ar }
