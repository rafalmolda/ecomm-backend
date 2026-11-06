import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { chmodSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"

/**
 * 2026-11-06 compliance rewrite of product descriptions (research-use-only).
 *
 * Fields: product.description + metadata.description_<l>, metadata.long_description,
 * metadata.long_description_<l> for en, th, de, es, fr, it, sv, no, da, nl, ar.
 *
 *  1. A "Preparation" section that contains human-dosing math (U-100 / IU / mcg,
 *     injection sites, timing, starter dose, titration, dosing card ...) is replaced
 *     by a single concentration-only "Reconstitution reference" line computed from
 *     the numbers already in that section (vial mg / diluent mL). Sections without
 *     dosing math (diluents, dual-chamber format notes, storage-only notes) are kept.
 *     Nasal-spray products: the section describes a different vial, so it is removed.
 *  2. Specific human-administration / human-outcome sentences are removed with
 *     per-locale regexes (RULES). One bullet tail is replaced with neutral wording.
 *  3. The Thai "HPLC ≥99.5% — our highest purity" claim is removed when
 *     metadata.purity_percentage < 99.5. Purity metadata is never changed.
 *
 *   PREVIEW (default, read-only):
 *     npx medusa exec ./src/scripts/compliance-descriptions-20261106.ts
 *   APPLY (writes a mode-600 backup to /root/ops first):
 *     APPLY=1 npx medusa exec ./src/scripts/compliance-descriptions-20261106.ts
 *   Optional: HANDLE=<handle> limits the run to one product; VERBOSE=1 prints full after-text.
 */

const LOCALES = ["en", "th", "de", "es", "fr", "it", "sv", "no", "da", "nl", "ar"] as const
type Locale = (typeof LOCALES)[number]
type PerLocale<T> = Record<Locale, T>

const BACKUP_DIR = "/root/ops"
const EXCERPT_LEN = 170
const PURITY_CLAIM_THRESHOLD = 99.5

// ─── Reconstitution reference templates ─────────────────────────────────────
const REF_HEADING: PerLocale<string> = {
  en: "Reconstitution reference",
  th: "ข้อมูลอ้างอิงการละลาย",
  de: "Rekonstitutionsreferenz",
  es: "Referencia de reconstitución",
  fr: "Référence de reconstitution",
  it: "Riferimento di ricostituzione",
  sv: "Referens för rekonstitution",
  no: "Referanse for rekonstituering",
  da: "Reference for rekonstitution",
  nl: "Referentie voor reconstitutie",
  ar: "مرجع إعادة التكوين",
}

const REF_LINE: PerLocale<(mg: string, ml: string, conc: string) => string> = {
  en: (mg, ml, c) => `${mg} mg + ${ml} mL bacteriostatic water = ${c} mg/mL.`,
  th: (mg, ml, c) => `${mg} mg + น้ำ bacteriostatic ${ml} mL = ความเข้มข้น ${c} mg/mL`,
  de: (mg, ml, c) => `${mg} mg + ${ml} mL bakteriostatisches Wasser = ${c} mg/mL.`,
  es: (mg, ml, c) => `${mg} mg + ${ml} mL de agua bacteriostática = ${c} mg/mL.`,
  fr: (mg, ml, c) => `${mg} mg + ${ml} mL d'eau bactériostatique = ${c} mg/mL.`,
  it: (mg, ml, c) => `${mg} mg + ${ml} mL di acqua batteriostatica = ${c} mg/mL.`,
  sv: (mg, ml, c) => `${mg} mg + ${ml} mL bakteriostatiskt vatten = ${c} mg/mL.`,
  no: (mg, ml, c) => `${mg} mg + ${ml} mL bakteriostatisk vann = ${c} mg/mL.`,
  da: (mg, ml, c) => `${mg} mg + ${ml} mL bakteriostatisk vand = ${c} mg/mL.`,
  nl: (mg, ml, c) => `${mg} mg + ${ml} mL bacteriostatisch water = ${c} mg/mL.`,
  ar: (mg, ml, c) => `${mg} mg + ${ml} mL من الماء المُثبِّط للبكتيريا = ${c} mg/mL.`,
}

type Component = { name: string; mg: number; ml: number }

// Stacks: per-vial values taken from the existing English preparation text.
const STACK_COMPONENTS: Record<string, Component[]> = {
  "wolverine-stack-bpc-tb4-calyssee": [
    { name: "BPC-157", mg: 5, ml: 2 },
    { name: "Thymosin Beta-4", mg: 5, ml: 2 },
  ],
  "glow-stack-ghk-bpc-nad-calyssee": [
    { name: "GHK-Cu", mg: 50, ml: 5 },
    { name: "BPC-157", mg: 10, ml: 2 },
    { name: "NAD+", mg: 500, ml: 10 },
  ],
}

// A section is "dosing" when it contains insulin-syringe / IU math.
const DOSING_SECTION_RE = /U-100|\d\s*(?:IU|UI|IE)\b/

// ─── Sentence / clause / bullet rules ───────────────────────────────────────
type Rule = {
  id: string
  note: string
  patterns: Partial<PerLocale<RegExp>>
  replacement?: Partial<PerLocale<string>> // default: removal
}

const bullet = (anchor: string) => new RegExp(`^•[^\\n]*${anchor}[^\\n]*(?:\\n|$)`, "m")
const sentence = (start: string) => new RegExp(`\\s*${start}[^.\\n]*\\.`)
const thaiTail = (start: string) => new RegExp(` ?${start}[^\\n]*`)

const RULES: Rule[] = [
  {
    id: "bpc-injury-site-clause",
    note: "BPC-157: 'accelerating soft-tissue repair at the injury site'",
    patterns: {
      en: /, accelerating soft-tissue repair at the injury site(?=\.)/,
      th: / เร่งการซ่อมแซมเนื้อเยื่ออ่อนที่บริเวณบาดเจ็บ/,
      de: /, wodurch die Weichteilreparatur an der Verletzungsstelle beschleunigt wird(?=\.)/,
      es: /, acelerando la reparación de tejidos blandos en el sitio de la lesión(?=\.)/,
      fr: /, accélérant la réparation des tissus mous au site de la lésion(?=\.)/,
      it: /, accelerando la riparazione dei tessuti molli nel sito di lesione(?=\.)/,
      sv: /, vilket accelererar mjukvävnadsreparation vid skadestället(?=\.)/,
      no: /, og akselererer bløtvevsreparasjon ved skadestedet(?=\.)/,
      da: /, hvilket accelererer reparation af blødt væv ved skadesstedet(?=\.)/,
      nl: /, waardoor zachteweefselherstel op de letselplaats wordt versneld(?=\.)/,
      ar: /، مُسرّعاً إصلاح الأنسجة الرخوة عند موقع الإصابة(?=\.)/,
    },
  },
  {
    id: "bpc-local-delivery-sentence",
    note: "BPC-157: 'strongest effects when delivered locally near the lesion'",
    patterns: {
      en: sentence("Unlike systemic healing peptides, BPC-157 shows strongest effects"),
      th: thaiTail("ต่างจากเพปไทด์ที่รักษาทั้งระบบ BPC-157 แสดงผลแรงที่สุด"),
      de: sentence("Im Gegensatz zu systemischen Heilungspeptiden zeigt BPC-157"),
      es: sentence("A diferencia de los péptidos cicatrizantes sistémicos, BPC-157"),
      fr: sentence("Contrairement aux peptides cicatrisants systémiques, le BPC-157"),
      it: sentence("A differenza dei peptidi di guarigione sistemici, BPC-157"),
      sv: sentence("Till skillnad från systemiska läkande peptider uppvisar BPC-157"),
      no: sentence("I motsetning til systemiske helingspeptider viser BPC-157"),
      da: sentence("I modsætning til systemiske helingspeptider viser BPC-157"),
      nl: sentence("In tegenstelling tot systemische genezingspeptiden vertoont BPC-157"),
      ar: sentence("بخلاف الببتيدات الشافية النظامية، يُظهر BPC-157"),
    },
  },
  {
    id: "tb4-injection-sentence",
    note: "TB4: 'works best injected near the injury ... remote injection delivers comparable effects'",
    patterns: {
      en: sentence("Unlike BPC-157, which works best injected near the injury"),
      th: thaiTail("ต่างจาก BPC-157 ที่ทำงานได้ดีที่สุดเมื่อฉีดใกล้บาดเจ็บ"),
      de: sentence("Im Gegensatz zu BPC-157, das am besten in Verletzungsnähe injiziert wirkt"),
      es: sentence("A diferencia de BPC-157, que funciona mejor inyectado"),
      fr: sentence("Contrairement au BPC-157, qui agit mieux lorsqu'il est injecté"),
      it: sentence("A differenza di BPC-157, che funziona meglio iniettato"),
      sv: sentence("Till skillnad från BPC-157, som fungerar bäst injicerad"),
      no: sentence("I motsetning til BPC-157, som fungerer best ved injeksjon"),
      da: sentence("I modsætning til BPC-157, der virker bedst injiceret"),
      nl: sentence("In tegenstelling tot BPC-157, dat het best werkt wanneer geïnjecteerd"),
      ar: sentence("بخلاف BPC-157 الذي يعمل بأفضل شكل عند الحقن"),
    },
  },
  {
    id: "stack-injected-near-lesion-clause",
    note: "Wolverine stack: 'acts locally when injected near the lesion'",
    patterns: {
      en: / and acts locally when injected near the lesion(?=;)/,
      th: / และทำงานเฉพาะที่เมื่อฉีดใกล้บริเวณบาดเจ็บ(?=;)/,
      de: / und wirkt lokal, wenn es in Läsionsnähe injiziert wird(?=;)/,
      es: / y actúa localmente cuando se inyecta cerca de la lesión(?=;)/,
      fr: / et agit localement lorsqu'il est injecté près de la lésion(?= ;)/,
      it: / e agisce localmente quando iniettato vicino alla lesione(?=;)/,
      sv: / och verkar lokalt när den injiceras nära lesionen(?=;)/,
      no: / og virker lokalt når det injiseres nær lesjonen(?=;)/,
      da: / og virker lokalt, når det injiceres nær læsionen(?=;)/,
      nl: / en werkt lokaal wanneer geïnjecteerd nabij de laesie(?=;)/,
      ar: / ويعمل محلياً عند الحقن قرب الآفة(?=؛)/,
    },
  },
  {
    id: "epithalon-human-studies-sentence",
    note: "Epithalon: 'Human studies most consistently report sleep ... improvements'",
    patterns: {
      en: sentence("Human studies most consistently report"),
      th: thaiTail("การศึกษาในมนุษย์รายงานถึง"),
      de: sentence("Humanstudien berichten"),
      es: sentence("Los estudios humanos informan"),
      fr: sentence("Les études humaines rapportent"),
      it: sentence("Gli studi sull'uomo riportano"),
      sv: sentence("Humanstudier rapporterar"),
      no: sentence("Humanstudier rapporterer"),
      da: sentence("Humane studier rapporterer"),
      nl: sentence("Humane studies rapporteren"),
      ar: sentence("وتُفيد الدراسات البشرية"),
    },
  },
  {
    id: "kisspeptin-clinical-sentence",
    note: "Kisspeptin-10: human LH/FSH surges in clinical studies",
    patterns: {
      en: sentence("Loss-of-function mutations in KISS1R"),
      th: thaiTail("การกลายพันธุ์แบบ loss-of-function ใน KISS1R"),
      de: sentence("Loss-of-function-Mutationen in KISS1R"),
      es: sentence("Las mutaciones con pérdida de función en KISS1R"),
      fr: sentence("Les mutations avec perte de fonction dans KISS1R"),
      it: sentence("Le mutazioni loss-of-function in KISS1R"),
      sv: sentence("Funktionsförlu\\S*mutationer i KISS1R"),
      no: sentence("Funksjonshemmende mutasjoner i KISS1R"),
      da: sentence("Tab-af-funktion mutationer i KISS1R"),
      nl: sentence("Loss-of-function mutaties in KISS1R"),
      ar: sentence("تسبب الطفرات المُعطِّلة للوظيفة في KISS1R"),
    },
  },
  {
    id: "surmount-weight-claim",
    note: "Tirzepatide/Monera: '20–22% mean body-weight reduction at 15 mg/week' → neutral",
    patterns: Object.fromEntries(LOCALES.map((l) => [l, /— [^\n]*SURMOUNT-1[^\n]*/])) as PerLocale<RegExp>,
    replacement: {
      en: "— studied in preclinical models of obesity.",
      th: "— ศึกษาในแบบจำลองพรีคลินิกของโรคอ้วน",
      de: "— untersucht in präklinischen Adipositasmodellen.",
      es: "— estudiado en modelos preclínicos de obesidad.",
      fr: "— étudié dans des modèles précliniques d'obésité.",
      it: "— studiato in modelli preclinici di obesità.",
      sv: "— studerad i prekliniska fetmamodeller.",
      no: "— studert i prekliniske fedmemodeller.",
      da: "— undersøgt i prækliniske fedmemodeller.",
      nl: "— onderzocht in preklinische obesitasmodellen.",
      ar: "— دُرس في نماذج ما قبل سريرية للسمنة.",
    },
  },
  {
    id: "tirzepatide-retained-muscle-bullet",
    note: "Tirzepatide/Monera: 'retained muscle during rapid weight loss' bullet",
    patterns: Object.fromEntries(
      LOCALES.map((l) => [l, bullet("(?:tirzepatide|Tirzepatid|tirzépatide)[^\\n]*GLP-1")])
    ) as PerLocale<RegExp>,
  },
  {
    id: "tesamorelin-trial-dose",
    note: "Tesamorelin: '(15–18% reduction in 26-week trials at 2 mg/day)'",
    patterns: Object.fromEntries(LOCALES.map((l) => [l, /\s*\([^()\n]*15–18%[^()\n]*\)/])) as PerLocale<RegExp>,
  },
  {
    id: "tesamorelin-human-population-bullet",
    note: "Tesamorelin: 'restoration of overnight GH pulses in middle-aged research populations'",
    patterns: {
      en: bullet("middle-aged research populations"),
      th: bullet("ประชากรวิจัยวัยกลางคน"),
      de: bullet("mittelalten Forschungspopulationen"),
      es: bullet("poblaciones de investigación de mediana edad"),
      fr: bullet("populations de recherche d'âge moyen"),
      it: bullet("popolazioni di ricerca di mezza età"),
      sv: bullet("medelålders forskningspopulationer"),
      no: bullet("middelaldrende forskningspopulasjoner"),
      da: bullet("midaldrende forskningspopulationer"),
      nl: bullet("onderzoekspopulaties van middelbare leeftijd"),
      ar: bullet("مجموعات البحث في منتصف العمر"),
    },
  },
  {
    id: "aod-fasted-activity-bullet",
    note: "AOD-9604: 'caloric deficit and fasted activity' bullet",
    patterns: {
      en: bullet("fasted activity"),
      th: bullet("การออกกำลังกายขณะอดอาหาร"),
      de: bullet("nüchterner Aktivität"),
      es: bullet("actividad en ayunas"),
      fr: bullet("activité à jeun"),
      it: bullet("attività a digiuno"),
      sv: bullet("fasteaktivitet"),
      no: bullet("fastende aktivitet"),
      da: bullet("fastende aktivitet"),
      nl: bullet("nuchtere activiteit"),
      ar: bullet("النشاط على الريق"),
    },
  },
  {
    id: "ipamorelin-evening-dose-bullet",
    note: "Ipamorelin: 'evening-dose protocols' bullet",
    patterns: {
      en: bullet("evening-dose protocols"),
      th: bullet("โปรโตคอลให้ยาตอนเย็น"),
      de: bullet("Abendprotokolle"),
      es: bullet("dosificación nocturna"),
      fr: bullet("dose du soir"),
      it: bullet("dose serale"),
      sv: bullet("kvällsdosprotokoll"),
      no: bullet("kveldsdoseprotokoller"),
      da: bullet("aftendosisprotokoller"),
      nl: bullet("avonddosisprotocollen"),
      ar: bullet("الجرعة المسائية"),
    },
  },
]

const PURITY_CLAIM_RULE: Rule = {
  id: "false-highest-purity-claim",
  note: "'HPLC ≥99.5% — our highest purity' while purity metadata < 99.5",
  patterns: {
    en: /\s*[^.\n]*≥\s*99\.5\s*%[^.\n]*highest purity[^.\n]*\.?/i,
    th: / ?ตรวจสอบ HPLC ≥\s*99\.5\s*% — สารที่มีความบริสุทธิ์สูงสุดของเรา/,
  },
}

// Residual scan: anything still matching after the rewrite is printed for review.
const RESIDUAL_RE =
  /U-100|\d\s*(?:IU|UI|IE)\b|\bmcg\b|insulin syringe|subcutaneous|subkutan|subcutánea|sous-cutan|sottocutan|subcutaan|ใต้ผิวหนัง|تحت الجلد|before bed|fasted|starter dose|titrat|once-weekly|dosing card|near the (?:injury|lesion)|injury site|human stud|SURMOUNT|body-weight reduction|≥\s*99\.5/i

// ─── Text helpers ───────────────────────────────────────────────────────────
type Change = { kind: string; removed: string; added: string; sentences: number }

const HEADING_LINE_RE = /^\s*(?:\*\*[^*\n]+\*\*:?|#{1,3}\s+\S.*)\s*$/

function countSentences(text: string, locale: Locale): number {
  const body = text.replace(/\*\*[^*\n]+\*\*:?/g, " ").trim()
  if (!body) return 0
  const parts =
    locale === "th"
      ? body.split(/\s+|\n+/).filter((s) => /[฀-๿]/.test(s))
      : body.split(/(?<=[.;؛])\s+|\n+/).filter((s) => /[\p{L}\d]/u.test(s))
  return Math.max(1, parts.length)
}

function fmt(n: number, decimalComma = false): string {
  const out = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
  return decimalComma ? out.replace(".", ",") : out
}

// decimalComma mirrors the number style already used in that locale's text.
function referenceLines(locale: Locale, comps: Component[], decimalComma: boolean): string[] {
  const line = REF_LINE[locale]
  const f = (n: number) => fmt(n, decimalComma)
  if (comps.length === 1) {
    const { mg, ml } = comps[0]
    return [line(f(mg), f(ml), f(mg / ml))]
  }
  return comps.map((c) => `• ${c.name}: ${line(f(c.mg), f(c.ml), f(c.mg / c.ml))}`)
}

type Parsed = { mg: number; ml: number; stated: number | null; decimalComma: boolean }

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
const toNum = (raw: string) => Number(raw.replace(",", "."))

function parseReconstitution(body: string): Parsed | null {
  const mg = body.match(new RegExp(`${NUM}[\\s-]*mg(?![\\/\\w])`))
  const ml = body.match(new RegExp(`${NUM}\\s*ml\\b`, "i"))
  const stated = body.match(new RegExp(`${NUM}\\s*mg\\/ml\\b`, "i"))
  if (!mg || !ml) return null
  return {
    mg: toNum(mg[1]),
    ml: toNum(ml[1]),
    stated: stated ? toNum(stated[1]) : null,
    decimalComma: /\d,\d/.test(body),
  }
}

type Section = { start: number; end: number } // line indexes [start, end)

function splitSections(lines: string[]): Section[] {
  const heads = lines.map((l, i) => (HEADING_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0)
  return heads.map((h, k) => ({ start: h, end: k + 1 < heads.length ? heads[k + 1] : lines.length }))
}

type Ctx = {
  handle: string
  isSpray: boolean
  sizeMg: number | null
  purity: number | null
  flags: string[]
}

function rewritePreparation(text: string, locale: Locale, field: string, ctx: Ctx): { text: string; changes: Change[] } {
  const lines = text.split("\n")
  const sections = splitSections(lines)
  const changes: Change[] = []
  let out = lines
  // Walk sections from the end so earlier indexes stay valid.
  for (const sec of [...sections].reverse()) {
    const block = out.slice(sec.start, sec.end).join("\n")
    if (!DOSING_SECTION_RE.test(block)) continue
    const trailingBlank = out.slice(sec.start, sec.end).reverse().findIndex((l) => l.trim() !== "")
    const keepTail = out.slice(sec.end - Math.max(0, trailingBlank), sec.end)
    const body = out.slice(sec.start + 1, sec.end).join("\n")
    const replacement = buildReference(body, locale, field, ctx)
    const added = replacement ? [`**${REF_HEADING[locale]}**`, ...replacement] : []
    changes.push({
      kind: replacement ? "preparation→reference" : "preparation removed",
      removed: block.trim(),
      added: added.join("\n"),
      sentences: countSentences(body, locale),
    })
    out = [...out.slice(0, sec.start), ...added, ...keepTail, ...out.slice(sec.end)]
  }
  let result = out.join("\n")
  if (changes.length && !result.trim()) result = text // never blank a field
  return { text: tidy(result), changes }
}

function buildReference(body: string, locale: Locale, field: string, ctx: Ctx): string[] | null {
  if (ctx.isSpray) {
    ctx.flags.push(`${field}: spray product — dosing section described a vial format; removed without reference line`)
    return null
  }
  const stack = STACK_COMPONENTS[ctx.handle]
  if (stack) return referenceLines(locale, stack, /\d,\d/.test(body))
  const p = parseReconstitution(body)
  if (!p) {
    ctx.flags.push(`${field}: could not parse mg/mL from dosing section; removed without reference line`)
    return null
  }
  const conc = p.mg / p.ml
  if (p.stated !== null && Math.abs(conc - p.stated) > 1e-6) {
    ctx.flags.push(`${field}: computed ${fmt(conc)} mg/mL ≠ stated ${p.stated} mg/mL; removed without reference line`)
    return null
  }
  if (ctx.sizeMg !== null && ctx.sizeMg !== p.mg) {
    ctx.flags.push(`${field}: section vial ${p.mg} mg ≠ product size ${ctx.sizeMg} mg (reference uses ${p.mg} mg)`)
  }
  return referenceLines(locale, [{ name: "", mg: p.mg, ml: p.ml }], p.decimalComma)
}

function applyRule(text: string, locale: Locale, rule: Rule): { text: string; change: Change | null } {
  const re = rule.patterns[locale]
  if (!re) return { text, change: null }
  const m = text.match(re)
  if (!m) return { text, change: null }
  const repl = rule.replacement?.[locale] ?? ""
  return {
    text: text.replace(re, repl),
    change: {
      kind: rule.id,
      removed: m[0].trim(),
      added: repl,
      sentences: repl ? 1 : countSentences(m[0], locale),
    },
  }
}

function tidy(text: string): string {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")
}

function rewriteField(
  value: string,
  locale: Locale,
  field: string,
  isLong: boolean,
  ctx: Ctx
): { text: string; changes: Change[] } {
  let text = value
  const changes: Change[] = []
  if (isLong) {
    const prep = rewritePreparation(text, locale, field, ctx)
    if (prep.changes.length) {
      text = prep.text
      changes.push(...prep.changes)
    }
  }
  const rules = [...RULES]
  if (ctx.purity !== null && ctx.purity < PURITY_CLAIM_THRESHOLD) rules.push(PURITY_CLAIM_RULE)
  for (const rule of rules) {
    const r = applyRule(text, locale, rule)
    if (r.change) {
      text = r.text
      changes.push(r.change)
    }
  }
  if (changes.length) text = tidy(text)
  return { text, changes }
}

// ─── Product-level planning ─────────────────────────────────────────────────
type ProductRow = {
  id: string
  handle: string
  status: string
  description: string | null
  metadata: Record<string, unknown> | null
}

type FieldPlan = { field: string; locale: Locale; before: string; after: string; changes: Change[] }
type ProductPlan = { product: ProductRow; fields: FieldPlan[]; flags: string[]; residual: string[] }

function fieldTargets(p: ProductRow): { field: string; locale: Locale; isLong: boolean; value: string | null }[] {
  const meta = p.metadata ?? {}
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null)
  return LOCALES.flatMap((l) => [
    {
      field: l === "en" ? "description" : `metadata.description_${l}`,
      locale: l,
      isLong: false,
      value: l === "en" ? p.description : str(`description_${l}`),
    },
    {
      field: l === "en" ? "metadata.long_description" : `metadata.long_description_${l}`,
      locale: l,
      isLong: true,
      value: str(l === "en" ? "long_description" : `long_description_${l}`),
    },
  ])
}

function planProduct(p: ProductRow): ProductPlan {
  const meta = p.metadata ?? {}
  const sizeMatch = p.handle.match(/-(\d+)mg-/)
  const purityRaw = meta.purity_percentage
  const ctx: Ctx = {
    handle: p.handle,
    isSpray: String(meta.form ?? "").toLowerCase() === "spray",
    sizeMg: sizeMatch && !STACK_COMPONENTS[p.handle] ? Number(sizeMatch[1]) : null,
    purity: purityRaw === undefined || purityRaw === null || purityRaw === "" ? null : Number(purityRaw),
    flags: [],
  }
  const fields: FieldPlan[] = []
  const residual: string[] = []
  for (const t of fieldTargets(p)) {
    if (!t.value) continue
    const r = rewriteField(t.value, t.locale, t.field, t.isLong, ctx)
    if (r.changes.length) {
      fields.push({ field: t.field, locale: t.locale, before: t.value, after: r.text, changes: r.changes })
    }
    const hit = r.text.match(RESIDUAL_RE)
    if (hit) residual.push(`${t.field}: "…${excerptAround(r.text, hit.index ?? 0)}…"`)
  }
  return { product: p, fields, flags: ctx.flags, residual }
}

function excerptAround(text: string, idx: number): string {
  return text.slice(Math.max(0, idx - 60), idx + 80).replace(/\n/g, " ⏎ ")
}

function short(s: string): string {
  const one = s.replace(/\n/g, " ⏎ ")
  return one.length > EXCERPT_LEN ? `${one.slice(0, EXCERPT_LEN)}…` : one
}

type ProductUpdate = { id: string; description?: string; metadata?: Record<string, unknown> }

function buildUpdate(plan: ProductPlan): ProductUpdate {
  const metaChanges: Record<string, unknown> = {}
  let description: string | undefined
  for (const f of plan.fields) {
    if (f.field === "description") description = f.after
    else metaChanges[f.field.replace(/^metadata\./, "")] = f.after
  }
  return {
    id: plan.product.id,
    ...(description !== undefined ? { description } : {}),
    // Full metadata object: correct whether the module merges or replaces metadata.
    ...(Object.keys(metaChanges).length ? { metadata: { ...(plan.product.metadata ?? {}), ...metaChanges } } : {}),
  }
}

// ─── Reporting ──────────────────────────────────────────────────────────────
type Log = { info: (m: string) => void }

function printPlan(logger: Log, plan: ProductPlan, verbose: boolean) {
  logger.info(`\n■ ${plan.product.handle} [${plan.product.status}]`)
  for (const f of plan.fields) {
    const removed = f.changes.reduce((n, c) => n + c.sentences, 0)
    logger.info(`  • ${f.field} — ${f.changes.length} edit(s), ~${removed} sentence(s) removed/replaced`)
    for (const c of f.changes) {
      logger.info(`      [${c.kind}]`)
      logger.info(`        - ${short(c.removed)}`)
      if (c.added) logger.info(`        + ${short(c.added)}`)
    }
    if (verbose) logger.info(`      AFTER:\n${f.after}`)
  }
  plan.flags.forEach((fl) => logger.info(`  ! FLAG ${fl}`))
  plan.residual.forEach((r) => logger.info(`  ? RESIDUAL ${r}`))
}

function printSummary(logger: Log, plans: ProductPlan[]) {
  const perLocale: Record<string, { fields: number; edits: number; sentences: number }> = {}
  const perRule: Record<string, number> = {}
  for (const p of plans) {
    for (const f of p.fields) {
      const s = (perLocale[f.locale] ??= { fields: 0, edits: 0, sentences: 0 })
      s.fields += 1
      s.edits += f.changes.length
      s.sentences += f.changes.reduce((n, c) => n + c.sentences, 0)
      f.changes.forEach((c) => (perRule[c.kind] = (perRule[c.kind] ?? 0) + 1))
    }
  }
  const touched = plans.filter((p) => p.fields.length)
  const fieldCount = touched.reduce((n, p) => n + p.fields.length, 0)
  logger.info(`\n══ SUMMARY ══`)
  logger.info(`products scanned: ${plans.length}, products touched: ${touched.length}, fields changed: ${fieldCount}`)
  for (const l of LOCALES) {
    const s = perLocale[l] ?? { fields: 0, edits: 0, sentences: 0 }
    logger.info(`  ${l}: ${s.fields} field(s), ${s.edits} edit(s), ~${s.sentences} sentence(s)`)
  }
  logger.info(`edits by rule:`)
  Object.entries(perRule)
    .sort()
    .forEach(([k, v]) => logger.info(`  ${k}: ${v}`))
  const flags = plans.flatMap((p) => p.flags.map((f) => `${p.product.handle} ${f}`))
  const residual = plans.flatMap((p) => p.residual.map((r) => `${p.product.handle} ${r}`))
  logger.info(`flags (${flags.length}):`)
  flags.forEach((f) => logger.info(`  ! ${f}`))
  logger.info(`residual matches after rewrite (${residual.length}) — review manually:`)
  residual.forEach((r) => logger.info(`  ? ${r}`))
  logger.info(`touched handles: ${touched.map((p) => p.product.handle).join(", ")}`)
}

function writeBackup(products: ProductRow[]): string {
  mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = join(BACKUP_DIR, `product-descriptions-backup-${stamp}.json`)
  const payload = products.map((p) => ({
    id: p.id,
    handle: p.handle,
    status: p.status,
    description: p.description,
    metadata: p.metadata,
  }))
  const body = JSON.stringify({ created_at: new Date().toISOString(), count: payload.length, products: payload }, null, 2)
  writeFileSync(path, body, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

// ─── Entry point ────────────────────────────────────────────────────────────
export default async function complianceDescriptions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const isApply = process.env.APPLY === "1"
  const onlyHandle = process.env.HANDLE?.trim() || null
  const verbose = process.env.VERBOSE === "1"

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "description", "metadata"],
    filters: onlyHandle ? { handle: onlyHandle } : {},
  })
  const products = [...(data as ProductRow[])].sort((a, b) => a.handle.localeCompare(b.handle))
  if (!products.length) {
    logger.warn(`[compliance] no products found${onlyHandle ? ` for handle ${onlyHandle}` : ""}`)
    return
  }

  const plans = products.map(planProduct)
  plans
    .filter((p) => p.fields.length || p.flags.length || p.residual.length)
    .forEach((p) => printPlan(logger, p, verbose))
  printSummary(logger, plans)

  if (!isApply) {
    logger.info(`\n[compliance] PREVIEW only — nothing written. Re-run with APPLY=1 to write.`)
    return
  }

  // Backup failure throws and stops the run before any write.
  const backupPath = writeBackup(products)
  logger.info(`[compliance] backup written: ${backupPath} (mode 600, ${products.length} products)`)

  let ok = 0
  let failed = 0
  for (const plan of plans.filter((p) => p.fields.length)) {
    try {
      await updateProductsWorkflow(container).run({ input: { products: [buildUpdate(plan)] } })
      ok += 1
      logger.info(`[compliance] updated ${plan.product.handle} (${plan.fields.length} field(s))`)
    } catch (e) {
      failed += 1
      logger.error(`[compliance] FAILED ${plan.product.handle}: ${(e as Error).message}`)
    }
  }
  logger.info(`[compliance] APPLY done: ${ok} updated, ${failed} failed. Backup: ${backupPath}`)
}
