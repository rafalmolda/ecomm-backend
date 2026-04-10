import { ExecArgs } from "@medusajs/framework/types"

/**
 * One-time migration: move Thai product translations from the storefront's
 * hardcoded TypeScript file (src/lib/data/product-translations-th.ts) into
 * Medusa product.metadata as `description_th` and `long_description_th`.
 *
 * After running this successfully, delete the static TS file in the storefront
 * and update src/lib/data/products.ts to read metadata.*_th when the locale
 * is 'th'. Idempotent — running twice just overwrites with the same values.
 *
 *   npx medusa exec ./src/scripts/migrate-th-translations.ts
 */

type Translation = { description_th: string; long_description_th: string }

const TRANSLATIONS: Record<string, Translation> = {
  "semaglutide-5mg": {
    description_th:
      "GLP-1 receptor agonist ระดับพรีเมียมสำหรับการวิจัยเมตาบอลิซึมขั้นสูง ผงแห้งระดับเภสัชกรรมที่ผ่านการตรวจสอบความบริสุทธิ์ 99.2%",
    long_description_th: `Semaglutide เป็น GLP-1 receptor agonist ออกฤทธิ์ยาวนานที่ได้รับการศึกษาอย่างกว้างขวางสำหรับบทบาทในการวิจัย metabolic pathway สาร analog ที่ดัดแปลงนี้มี C-18 fatty di-acid chain ที่ช่วยในการจับกับ albumin ขยายประโยชน์ในการวิจัยในการทดสอบ in-vitro ระยะยาว

Semaglutide ของเราจัดหาจากโรงงานที่ได้รับการรับรอง GMP และทดสอบอิสระผ่าน HPLC เพื่อรับประกันความบริสุทธิ์ ≥99% ทุกขวดบรรจุผงแห้งที่วัดอย่างแม่นยำ จัดส่งภายใต้สภาวะควบคุมอุณหภูมิ

## การประยุกต์ใช้ในการวิจัย

- การศึกษา glucose metabolism และ insulin secretion pathway
- การทดสอบ appetite signaling และ hypothalamic receptor binding
- การวิจัย gastric motility และ GI tract receptor
- การศึกษาเปรียบเทียบกับ native GLP-1 และ analogs อื่นๆ

## การเตรียม

ละลายด้วย bacteriostatic water เก็บสารละลายที่ 2-8°C ใช้ภายใน 30 วันหลังละลาย`,
  },
  "tirzepatide-5mg": {
    description_th:
      "Dual GIP/GLP-1 receptor agonist — สารที่ล้ำหน้าที่สุดในการวิจัย metabolic peptide ตรวจสอบอิสระที่ความบริสุทธิ์ 99.1%",
    long_description_th: `Tirzepatide เป็นตัวแทนของสารวิจัยที่ใช้ incretin รุ่นล่าสุด ทำหน้าที่เป็น dual agonist ที่มุ่งเป้าไปที่ทั้ง GIP และ GLP-1 receptors กลไก dual-action ที่เป็นเอกลักษณ์นี้ทำให้เป็นหนึ่งใน peptides ที่ได้รับการศึกษามากที่สุดในการวิจัยเมตาบอลิกปัจจุบัน

ทุกล็อตผลิตภายใต้เงื่อนไข GMP อย่างเข้มงวดและตรวจสอบผ่านการวิเคราะห์ HPLC อิสระ มีใบรับรองการวิเคราะห์สำหรับดาวน์โหลด

## การประยุกต์ใช้ในการวิจัย

- การศึกษา dual incretin receptor binding และ activation
- การวิเคราะห์ metabolic pathway เปรียบเทียบ (GIP vs GLP-1 vs dual)
- การวิจัย adipose tissue biology และ lipid metabolism
- การทดสอบ beta-cell function และ glucose-dependent insulin secretion

## การเตรียม

ละลายด้วยน้ำปลอดเชื้อหรือ bacteriostatic water แบ่งเป็นส่วนเพื่อหลีกเลี่ยงวงจร freeze-thaw ซ้ำ`,
  },
  "aod-9604-5mg": {
    description_th:
      "HGH Fragment 176-191 — peptide วิจัยสำคัญสำหรับการศึกษา lipolytic pathways โดยไม่มีผล growth-promoting",
    long_description_th: `AOD-9604 เป็น fragment ที่ดัดแปลง (กรดอะมิโน 176-191) ของ human growth hormone ที่ศึกษาเฉพาะสำหรับบทบาทใน lipid metabolism โดยไม่มีคุณสมบัติ mitogenic ของ hGH เต็มรูปแบบ ทำให้เป็นเครื่องมือที่มีค่าเฉพาะสำหรับนักวิจัยที่แยก fat metabolism pathways

ผลิตตามมาตรฐานเภสัชกรรมด้วยความบริสุทธิ์ที่ตรวจสอบด้วย HPLC ≥98.9%

## การประยุกต์ใช้ในการวิจัย

- การศึกษา lipolysis และ fat oxidation pathway
- การวิจัยกลไก metabolic ที่ไม่ขึ้นกับ IGF-1
- ชีววิทยา cartilage และเนื้อเยื่อระบบกล้ามเนื้อและกระดูก
- การศึกษาเปรียบเทียบกับ fragments ของ hGH เต็มรูปแบบ

## การเตรียม

ละลายด้วย bacteriostatic water เก็บที่ 2-8°C`,
  },
  "ipamorelin-5mg": {
    description_th:
      "GH secretagogue ที่เลือกสรรสูงโดยมีผลกระทบต่อ cortisol และ prolactin น้อยที่สุด เหมาะสำหรับการวิจัย GH-axis ที่สะอาด",
    long_description_th: `Ipamorelin เป็น pentapeptide growth hormone secretagogue ที่จับกับ ghrelin/GHS receptor ด้วยการเลือกสรรที่น่าทึ่ง ต่างจาก GHS compounds อื่นๆ งานวิจัยแสดงว่า Ipamorelin ไม่ส่งผลกระทบต่อระดับ cortisol, ACTH หรือ prolactin อย่างมีนัยสำคัญ ทำให้เป็นมาตรฐานทองสำหรับการศึกษา GH-axis แบบแยก

ระดับเภสัชกรรม ตรวจสอบ HPLC ที่ ≥99.0%

## การประยุกต์ใช้ในการวิจัย

- การศึกษา GH secretion แบบเลือกสรรโดยไม่มีตัวแปรฮอร์โมนรบกวน
- การทดสอบ ghrelin receptor (GHS-R1a) binding affinity และ selectivity
- การวิจัยรูปแบบ GH pulsatility
- การศึกษา synergistic กับ GHRH analogs (เช่น CJC-1295)

## การเตรียม

ละลายด้วย bacteriostatic water เก็บที่ 2-8°C หลังละลาย`,
  },
  "cjc-1295-dac-2mg": {
    description_th:
      "Modified GRF(1-29) พร้อม Drug Affinity Complex สำหรับการวิจัย growth hormone แบบออกฤทธิ์ยาวนาน ตรวจสอบ HPLC 99.3%",
    long_description_th: `CJC-1295 กับ DAC (Drug Affinity Complex) เป็น synthetic analog ของ growth hormone releasing hormone (GHRH) ที่มีการแทนที่กรดอะมิโน 4 ตำแหน่งเพื่อป้องกันการตัดโดย DPP-IV บวกกับ lysine-linked MPA moiety ที่จับกับ serum albumin การดัดแปลงคู่นี้ให้นักวิจัยมี GHRH analog ออกฤทธิ์ยาวนานที่เป็นเอกลักษณ์

ทุกล็อตผ่านการทดสอบ HPLC อิสระ มีใบรับรองการวิเคราะห์ครบถ้วน

## การประยุกต์ใช้ในการวิจัย

- การศึกษารูปแบบ GH release ที่ยั่งยืนและ pulsatility research
- การทดสอบ somatotroph cell stimulation
- การศึกษา IGF-1 axis และ downstream signaling pathway
- การเปรียบเทียบกับ non-DAC modified GRF analogs

## การเตรียม

ละลายด้วย bacteriostatic water 2mg ละลายใน 2ml ให้ 100mcg ต่อ 0.1ml`,
  },
  "ghrp-6-5mg": {
    description_th:
      "Hexapeptide growth hormone secretagogue ที่มีประสิทธิภาพ สารพื้นฐานในการวิจัย GH-axis และ appetite signaling",
    long_description_th: `GHRP-6 (Growth Hormone Releasing Hexapeptide) เป็นหนึ่งใน synthetic GH secretagogues ที่ได้รับการศึกษามากที่สุด ทำงานบน ghrelin receptor เพื่อกระตุ้นการปล่อย GH และมีการประยุกต์ใช้วิจัยเพิ่มเติมในการศึกษา appetite signaling และ gastric motility

ทุกขวดบรรจุ 5mg ของ GHRP-6 แบบผงแห้งที่ตรวจสอบที่ ≥98.7% ผ่านการวิเคราะห์ HPLC อิสระ

## การประยุกต์ใช้ในการวิจัย

- การศึกษา growth hormone secretion และ dose-response
- การวิจัย ghrelin receptor agonism และ appetite pathway
- การทดสอบ gastric motility และ GI function
- การศึกษาแบบผสมกับ GHRH analogs

## การเตรียม

ละลายด้วย bacteriostatic water ความเข้มข้นวิจัยมาตรฐาน: 5mg ใน 2.5ml`,
  },
  "sermorelin-2mg": {
    description_th:
      "GHRH(1-29) analog — มาตรฐานอ้างอิงสำหรับการวิจัย growth hormone releasing hormone",
    long_description_th: `Sermorelin เป็น synthetic 29-amino acid analog ของ GHRH ภายในร่างกาย เป็น fragment ที่สั้นที่สุดที่ทำงานเต็มรูปแบบของฮอร์โมน native 44-amino acid ในฐานะ GHRH analog ที่ได้รับการอธิบายลักษณะดีที่สุด จึงเป็นสารอ้างอิงในการวิจัย growth hormone axis

จัดหาจาก GMP ตรวจสอบ HPLC ≥99.1% มีใบรับรองการวิเคราะห์

## การประยุกต์ใช้ในการวิจัย

- การศึกษา GHRH receptor binding และ signal transduction
- การทดสอบ pituitary somatotroph stimulation
- การวิจัย GH decline ตามอายุและ neuroendocrine
- การเปรียบเทียบพื้นฐานสำหรับ GHRH analogs ใหม่

## การเตรียม

ละลายด้วย bacteriostatic water หรือ sterile saline เก็บสารละลายที่ 2-8°C`,
  },
  "bpc-157-5mg": {
    description_th:
      "Body Protection Compound-157 — peptide ฟื้นฟูที่ได้รับการวิจัยมากที่สุด ลำดับ 15 กรดอะมิโนที่มีความเสถียรเป็นเลิศ",
    long_description_th: `BPC-157 (Body Protection Compound-157) เป็น pentadecapeptide ที่ได้จากลำดับบางส่วนของโปรตีนในน้ำย่อยกระเพาะอาหารมนุษย์ เป็นหนึ่งใน peptides ฟื้นฟูที่ได้รับการศึกษามากที่สุด โดยมีงานวิจัยตีพิมพ์กว่า 100 ฉบับที่ตรวจสอบคุณสมบัติ cytoprotective

ต่างจาก peptides หลายชนิด BPC-157 แสดงความเสถียรที่โดดเด่นในสภาวะกระเพาะ ทำให้มีค่าเฉพาะสำหรับการวิจัย GI tract ตรวจสอบ HPLC ≥99.5% — สารที่มีความบริสุทธิ์สูงสุดของเรา

## การประยุกต์ใช้ในการวิจัย

- การศึกษา wound healing และ tissue regeneration pathway
- การวิจัย gastrointestinal mucosal protection
- ชีววิทยาเนื้อเยื่อ tendon, ligament และระบบกล้ามเนื้อและกระดูก
- การทดสอบ nitric oxide system และ vascular biology
- การศึกษา neuroprotective pathway

## การเตรียม

ละลายด้วย bacteriostatic water มีความเสถียรเป็นเลิศ — สามารถเก็บสารละลายที่ 2-8°C ได้ถึง 30 วัน`,
  },
  "tb-500-5mg": {
    description_th:
      "Thymosin Beta-4 active fragment — สารวิจัยชั้นนำสำหรับการศึกษาการซ่อมแซมเนื้อเยื่อ การเคลื่อนย้ายเซลล์ และ angiogenesis",
    long_description_th: `TB-500 เป็นบริเวณที่ออกฤทธิ์ของ Thymosin Beta-4 (Tβ4) ซึ่งเป็น peptide 43-amino acid ที่พบตามธรรมชาติในเซลล์มนุษย์และสัตว์เกือบทุกเซลล์ TB-500 ได้รับการศึกษาเฉพาะสำหรับบทบาทใน actin regulation, cell migration และกระบวนการซ่อมแซมเนื้อเยื่อ

ผลิตภายใต้เงื่อนไข GMP ตรวจสอบ HPLC ≥99.2%

## การประยุกต์ใช้ในการวิจัย

- การศึกษา actin polymerization และ cytoskeletal dynamics
- การทดสอบ cell migration และ wound closure
- การวิจัย angiogenesis และการสร้างหลอดเลือด
- การศึกษา anti-inflammatory pathway
- การวิจัยซ่อมแซมเนื้อเยื่อหัวใจและประสาท

## การเตรียม

ละลายด้วย bacteriostatic water TB-500 ละลายได้ดีและมีความเสถียรที่ความเข้มข้นวิจัยมาตรฐาน`,
  },
  "ghk-cu-50mg": {
    description_th:
      "Copper tripeptide complex — มาตรฐานทองในการวิจัยชีววิทยาผิวหนังและการรักษาแผล ขวดวิจัยขนาดใหญ่ 50mg",
    long_description_th: `GHK-Cu (Glycyl-L-Histidyl-L-Lysine Copper Complex) เป็น copper peptide ที่พบตามธรรมชาติในพลาสมา น้ำลาย และปัสสาวะของมนุษย์ เป็นหนึ่งใน peptides ที่ได้รับการอธิบายลักษณะดีที่สุดในการวิจัยผิวหนังวิทยาและการรักษาแผล โดยมีการศึกษาตีพิมพ์กว่า 60 ฉบับเกี่ยวกับฤทธิ์ทางชีวภาพ

ขวด 50mg ของเราให้ความคุ้มค่าเป็นเลิศสำหรับโปรแกรมวิจัยระยะยาว ตรวจสอบ HPLC ≥99.1%

## การประยุกต์ใช้ในการวิจัย

- การศึกษา collagen และ elastin synthesis pathway
- การทดสอบ wound healing และ tissue remodeling
- การวิจัยกลไก anti-inflammatory และ antioxidant
- การศึกษาชีววิทยา hair follicle และวงจรการเจริญเติบโต
- การวิจัยการแสดงออกของ extracellular matrix protein
- การศึกษาเปรียบเทียบกับ copper-binding peptides อื่นๆ

## การเตรียม

GHK-Cu ละลายน้ำได้ ละลายด้วยน้ำปลอดเชื้อตามความเข้มข้นที่ต้องการ เก็บที่ 2-8°C`,
  },
  "epithalon-10mg": {
    description_th:
      "Synthetic tetrapeptide (Ala-Glu-Asp-Gly) สำหรับการวิจัย telomerase และอายุยืน หนึ่งใน peptides ชะลอวัยที่ศึกษามากที่สุด",
    long_description_th: `Epithalon (หรือที่รู้จักในชื่อ Epitalon หรือ Epithalone) เป็น synthetic tetrapeptide ที่อิงจาก peptide ธรรมชาติ Epithalamin ที่ผลิตโดยต่อมไพเนียล เป็นหนึ่งในสารที่ได้รับการศึกษามากที่สุดในชีววิทยา telomere และการวิจัยชะลอวัย โดยมีการศึกษาตีพิมพ์ครอบคลุมกว่าสองทศวรรษ

การเตรียมที่มีความบริสุทธิ์สูงที่ 10mg ต่อขวด ตรวจสอบ HPLC ≥99.4%

## การประยุกต์ใช้ในการวิจัย

- การศึกษา telomerase activation และ telomere length
- การวิจัย pineal gland function และ melatonin production
- การศึกษา circadian rhythm และ neuroendocrine aging
- การทดสอบ cellular senescence และ replicative lifespan
- การวิจัยการแสดงออกของ antioxidant enzyme

## การเตรียม

ละลายด้วย bacteriostatic water โครงสร้าง tetrapeptide ให้ความเสถียรเป็นเลิศ`,
  },
  "thymosin-alpha-1-5mg": {
    description_th:
      "Peptide วิจัยด้านภูมิคุ้มกัน — acetylated N-terminal fragment ของ prothymosin alpha ที่มีการประยุกต์ใช้ทางภูมิคุ้มกันวิทยาอย่างกว้างขวาง",
    long_description_th: `Thymosin Alpha-1 (Tα1) เป็น peptide 28-amino acid ที่แยกได้จากต่อมไทมัส มีบทบาทสำคัญในการควบคุมระบบภูมิคุ้มกันและได้รับการศึกษาอย่างกว้างขวางสำหรับคุณสมบัติ immunomodulatory ในหลายสาขาวิจัย

ตรวจสอบ HPLC ≥98.8% ทุกขวดได้รับการทดสอบเป็นรายตัว

## การประยุกต์ใช้ในการวิจัย

- การศึกษา T-cell maturation และ differentiation
- การวิจัย dendritic cell activation และ antigen presentation
- การศึกษา Toll-like receptor signaling pathway
- การทดสอบ immune response modulation
- การวิจัย oxidative stress และ cellular resilience

## การเตรียม

ละลายด้วยน้ำปลอดเชื้อ เก็บที่ -20°C สำหรับระยะยาว 2-8°C สำหรับการใช้ระยะสั้น`,
  },
}

export default async function migrateThTranslations({ container }: ExecArgs) {
  const productModuleService = container.resolve("product")

  const handles = Object.keys(TRANSLATIONS)
  const products = await productModuleService.listProducts({ handle: handles })

  if (products.length === 0) {
    console.log("[migrate-th] no matching products found — aborting")
    return
  }

  let updated = 0
  let skipped = 0

  for (const product of products) {
    const handle = product.handle as string
    const t = TRANSLATIONS[handle]
    if (!t) {
      skipped++
      continue
    }

    const currentMetadata = (product.metadata ?? {}) as Record<string, unknown>
    const newMetadata = {
      ...currentMetadata,
      description_th: t.description_th,
      long_description_th: t.long_description_th,
    }

    await productModuleService.updateProducts(product.id, {
      metadata: newMetadata,
    })

    console.log(`[migrate-th] ✓ ${handle}`)
    updated++
  }

  const missing = handles.filter(
    (h) => !products.find((p) => p.handle === h)
  )

  console.log("")
  console.log(`[migrate-th] updated: ${updated}`)
  console.log(`[migrate-th] skipped: ${skipped}`)
  if (missing.length > 0) {
    console.log(
      `[migrate-th] WARNING: ${missing.length} handles in translations file had no matching product: ${missing.join(", ")}`
    )
  }
}
