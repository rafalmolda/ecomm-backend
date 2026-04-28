import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const BRANDS = {
  supreme: { name: "Supreme Biologics", slug: "supreme-biologics", skuPrefix: "SB" },
  fournines: { name: "FourNines", slug: "fournines", skuPrefix: "4N" },
  calyssee: { name: "Calyssee", slug: "calyssee", skuPrefix: "C" },
  wolf: { name: "Wolf", producent: "Wolf", slug: "wolf", skuPrefix: "WOLF" },
} as const

export type BrandKey = keyof typeof BRANDS

// ---------------------------------------------------------------------------
// Peptide KB — research content reused across all brand products for the same
// peptide. Brand only changes title, sku, price, producent, image urls.
// Descriptions style-matched to storefront /src/lib/peptide-kb content.
// ---------------------------------------------------------------------------

export type PeptideKB = {
  displayName: string
  casNumber: string
  molecularFormula: string
  shortDescription: string
  productDescription: string
  researchApplications: string
  preparation: string
  storage: string
  benefits: {
    fat_loss?: number
    muscle?: number
    recovery?: number
    anti_aging?: number
    immunity?: number
    performance?: number
    sleep?: number
    skin_hair?: number
    cognitive?: number
    gut_health?: number
  }
}

const STORAGE_LYOPHILIZED =
  "-20°C long-term (lyophilized) / 2–8°C reconstituted, use within 30 days. Keep dry and protected from light."

const STORAGE_SPRAY =
  "2–8°C sealed. Use within 30 days of first opening. Keep upright and protected from light."

export const PEPTIDES: Record<string, PeptideKB> = {
  "bpc-157": {
    displayName: "BPC-157",
    casNumber: "137525-51-0",
    molecularFormula: "C62H98N16O22",
    shortDescription:
      "Body Protection Compound — a 15-amino-acid gastric-derived peptide studied for tendon, ligament, and mucosal repair.",
    productDescription:
      "BPC-157 is a synthetic pentadecapeptide derived from a human gastric protective protein. Research models show it drives angiogenesis via VEGFR2 signaling and modulates nitric oxide synthesis, accelerating soft-tissue repair at the injury site. Unlike systemic healing peptides, BPC-157 shows strongest effects when delivered locally near the lesion — a property that has made it a widely cited research tool across tendon, ligament, and gastrointestinal models.",
    researchApplications:
      "• **Tendon & ligament repair** — promotes collagen deposition and capillary formation in preclinical tendon-injury models.\n• **Gut mucosal protection** — reverses NSAID-induced lesions and supports intestinal barrier integrity in animal studies.\n• **Vascular & endothelial studies** — used to probe VEGFR2 signaling and nitric oxide cross-talk.\n• **Post-surgical recovery models** — investigated alongside TB-500 and GHK-Cu for combined soft-tissue repair protocols.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water along the interior wall (never directly into the powder). Swirl gently, do not shake. Yields 2.5 mg/mL. On a U-100 insulin syringe, 10 IU = 0.1 mL = 250 mcg.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { recovery: 5, anti_aging: 3, performance: 3, muscle: 2 },
  },

  "thymosin-beta-4": {
    displayName: "Thymosin Beta-4",
    casNumber: "77591-33-4",
    molecularFormula: "C212H350N56O78S",
    shortDescription:
      "Thymosin Beta-4 (TB-500) — 43-amino-acid actin-sequestering peptide studied for systemic soft-tissue repair and angiogenesis.",
    productDescription:
      "Thymosin Beta-4 is a ubiquitous 43-amino-acid protein that binds monomeric G-actin and regulates cytoskeletal dynamics. Research models show it drives cell migration toward injury sites, upregulates VEGF-mediated angiogenesis, and modulates inflammatory cytokine profiles. Unlike BPC-157, which works best injected near the injury, TB4 operates systemically — remote injection delivers comparable effects across multiple tissue compartments.",
    researchApplications:
      "• **Muscle & tendon repair** — accelerates regeneration in preclinical soft-tissue injury models.\n• **Angiogenesis studies** — standard research tool for VEGF pathway investigation.\n• **Cardiac recovery models** — studied for myocardial repair following ischemic injury.\n• **Corneal & dermal wound healing** — promotes re-epithelialization in multiple tissue types.",
    preparation:
      "Reconstitute the 10mg vial with 2mL bacteriostatic water slowly along the interior wall. Yields 5 mg/mL. On a U-100 insulin syringe, 20 IU = 0.2 mL = 1 mg.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { recovery: 5, anti_aging: 4, performance: 3, muscle: 3 },
  },

  "pt-141": {
    displayName: "PT-141",
    casNumber: "189691-06-3",
    molecularFormula: "C50H68N14O10",
    shortDescription:
      "Bremelanotide — a cyclic melanocortin peptide studied for its effects on the central MC3R/MC4R pathway.",
    productDescription:
      "PT-141 (Bremelanotide) is a synthetic cyclic heptapeptide analog of alpha-MSH that acts primarily at melanocortin receptors MC3R and MC4R. Research models show it modulates central signaling pathways associated with pigmentation, appetite regulation, and autonomic response — distinct from peripherally-acting peptides. Initial development was for sunless tanning; later research focused on CNS-mediated endpoints.",
    researchApplications:
      "• **Melanocortin pathway research** — MC3R/MC4R agonism studies.\n• **Central nervous system signaling** — probe for hypothalamic pathways.\n• **Pigmentation biology** — MSH-pathway activation studies.\n• **Autonomic response modeling** — investigation of sympathetic tone and cardiovascular responses.",
    preparation:
      "For the 10mg vial: reconstitute with 2mL bacteriostatic water → 5 mg/mL. On a U-100 insulin syringe, 10 IU = 0.1 mL = 500 mcg. For nasal spray presentations the device is pre-calibrated — follow the included dosing card.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { skin_hair: 5, performance: 4, anti_aging: 3, cognitive: 3, recovery: 2 },
  },

  "cjc-1295-no-dac": {
    displayName: "CJC-1295 (no DAC)",
    casNumber: "863288-34-0",
    molecularFormula: "C152H252N44O42",
    shortDescription:
      "Modified GRF 1-29 — a short-acting synthetic GHRH analog without the albumin-binding DAC linker.",
    productDescription:
      "CJC-1295 (no DAC), also called Modified GRF 1-29, is a synthetic GHRH analog stabilized against dipeptidyl peptidase-IV cleavage. Without the DAC linker, its plasma half-life is approximately 30 minutes — meaning each injection produces a discrete GH pulse rather than a sustained elevation. Research models use it to study acute GH axis responses, and it is often paired with a GHRP such as Ipamorelin, which triggers pulses against the elevated GHRH tone.",
    researchApplications:
      "• **GH axis research** — pulsatile GH release studies paired with GHRP compounds.\n• **Anabolic signaling models** — IGF-1 response investigation.\n• **Recovery & sleep architecture** — evening-pulse protocols in preclinical models.\n• **Lean body composition studies** — paired with Ipamorelin for synergistic GH secretion.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water → 2.5 mg/mL. On a U-100 insulin syringe, 4 IU = 0.04 mL = 100 mcg per pulse.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { muscle: 4, recovery: 4, performance: 4, anti_aging: 3 },
  },

  ipamorelin: {
    displayName: "Ipamorelin",
    casNumber: "170851-70-4",
    molecularFormula: "C38H49N9O5",
    shortDescription:
      "Selective growth hormone secretagogue — a clean GHRP analog with minimal cortisol or prolactin elevation.",
    productDescription:
      "Ipamorelin is a pentapeptide ghrelin-receptor (GHS-R1a) agonist that triggers pulsatile GH release from pituitary somatotrophs. Its defining property is receptor selectivity — at therapeutic research doses it produces minimal cortisol, prolactin, or ACTH elevation, distinguishing it from earlier GHRPs like GHRP-6 or GHRP-2. This makes it the cleanest GHRP for extended-cycle research protocols.",
    researchApplications:
      "• **GH/IGF-1 axis studies** — pulsatile release without confounding hormone spikes.\n• **Recovery & muscle protein synthesis** — evening-dose protocols alongside GHRH analogs.\n• **Lean-mass preservation** — caloric-deficit research models.\n• **Paired-peptide protocols** — synergistic amplification when stacked with CJC-1295.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water → 2.5 mg/mL. On a U-100 insulin syringe, 10 IU = 0.1 mL = 250 mcg per pulse.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { muscle: 4, recovery: 4, performance: 3, anti_aging: 3 },
  },

  "mots-c": {
    displayName: "MOTS-c",
    casNumber: "1627580-64-6",
    molecularFormula: "C87H139N21O22",
    shortDescription:
      "Mitochondrial-derived 16-amino-acid peptide studied for metabolic regulation and AMPK activation.",
    productDescription:
      "MOTS-c is a 16-amino-acid peptide encoded in the mitochondrial 12S rRNA region. Research models show it translocates to the nucleus under metabolic stress and regulates nuclear gene expression — a rare example of mitochondrial-to-nuclear retrograde signaling. Downstream effects include AMPK pathway activation, improved insulin sensitivity, and enhanced cellular energy metabolism.",
    researchApplications:
      "• **Metabolic research** — insulin sensitivity and glucose uptake models.\n• **Exercise physiology** — AMPK/PGC-1alpha pathway investigation.\n• **Mitochondrial biogenesis studies** — preclinical models of age-related metabolic decline.\n• **Body composition research** — combined fat-loss and lean-mass protocols.",
    preparation:
      "Reconstitute the 10mg vial with 2mL bacteriostatic water → 5 mg/mL. On a U-100 insulin syringe, 20 IU = 0.2 mL = 1 mg.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { fat_loss: 4, performance: 4, anti_aging: 4, muscle: 3, recovery: 3 },
  },

  selank: {
    displayName: "Selank",
    casNumber: "129954-34-3",
    molecularFormula: "C33H57N11O9",
    shortDescription:
      "Synthetic heptapeptide anxiolytic analog of tuftsin — studied for GABAergic modulation without sedation.",
    productDescription:
      "Selank is a synthetic heptapeptide developed from the endogenous immunomodulator tuftsin. Research models show it modulates the GABAergic system and influences BDNF expression in specific hippocampal regions. Unlike benzodiazepines, animal studies indicate its anxiolytic profile does not produce sedation, cognitive impairment, or tolerance, making it a notable investigational tool for stress-response research.",
    researchApplications:
      "• **Anxiolytic pathway research** — GABA-A receptor modulation without sedation endpoints.\n• **Neurotrophic factor studies** — BDNF/nerve growth factor expression models.\n• **Stress-response investigations** — HPA axis regulation in chronic-stress models.\n• **Cognitive performance models** — attention and working memory under stress.",
    preparation:
      "Reconstitute the 5mg vial with 1mL bacteriostatic water → 5 mg/mL. On a U-100 insulin syringe, 5 IU = 0.05 mL = 250 mcg. Nasal spray presentation (if selected) is pre-calibrated per-actuation.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { cognitive: 5, sleep: 3, performance: 3, anti_aging: 2 },
  },

  semax: {
    displayName: "Semax",
    casNumber: "80714-61-0",
    molecularFormula: "C37H51N9O10S",
    shortDescription:
      "Synthetic heptapeptide analog of ACTH(4-10) — studied for BDNF induction and cognitive effects.",
    productDescription:
      "Semax is a synthetic heptapeptide derived from the N-terminal fragment of adrenocorticotropic hormone (ACTH 4-10). Research models show it rapidly upregulates BDNF and NGF in the hippocampus and cortex, and modulates enkephalin degradation. It is used experimentally in Russia for stroke recovery and cognitive research endpoints, and remains a standard investigational tool for neurotrophic pathway research.",
    researchApplications:
      "• **Neurotrophic factor induction** — BDNF/NGF upregulation studies.\n• **Cognitive performance models** — memory consolidation and learning paradigms.\n• **Neuroprotection research** — ischemia and hypoxia preclinical models.\n• **Mood/stress regulation** — melanocortin-adjacent signaling investigations.",
    preparation:
      "Reconstitute the 5mg vial with 1mL bacteriostatic water → 5 mg/mL. On a U-100 insulin syringe, 6 IU = 0.06 mL = 300 mcg. Nasal spray presentation (if selected) is pre-calibrated per-actuation.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { cognitive: 5, performance: 4, recovery: 2, anti_aging: 2, sleep: 2 },
  },

  retatrutide: {
    displayName: "Retatrutide",
    casNumber: "2381089-83-2",
    molecularFormula: "C221H343N53O65",
    shortDescription:
      "Triple GIP/GLP-1/glucagon receptor agonist — next-generation incretin under active clinical investigation.",
    productDescription:
      "Retatrutide is a synthetic peptide agonist at three receptors simultaneously: GIP (glucose-dependent insulinotropic polypeptide), GLP-1 (glucagon-like peptide-1), and glucagon receptors. Research models demonstrate substantial reductions in body weight and glycemic parameters in obesity and type-2 diabetes investigations, exceeding the effects of dual GIP/GLP-1 agonists. The glucagon component is thought to contribute additional hepatic and energy-expenditure effects.",
    researchApplications:
      "• **Weight management research** — preclinical and translational obesity models.\n• **Glycemic control** — GIP/GLP-1 co-agonist pathway studies.\n• **Hepatic lipid metabolism** — glucagon-receptor contribution investigations.\n• **Cardiometabolic risk models** — integrated metabolic endpoint research.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water → 2.5 mg/mL. On a U-100 insulin syringe, 8 IU = 0.08 mL = 200 mcg as a starter dose per research protocols.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { fat_loss: 5, performance: 3, anti_aging: 2, muscle: 2, recovery: 2 },
  },

  "nad-plus": {
    displayName: "NAD+",
    casNumber: "53-84-9",
    molecularFormula: "C21H27N7O14P2",
    shortDescription:
      "Nicotinamide adenine dinucleotide — essential coenzyme central to mitochondrial energy metabolism and sirtuin activity.",
    productDescription:
      "NAD+ (nicotinamide adenine dinucleotide) is a fundamental coenzyme present in every living cell, central to redox reactions and sirtuin enzyme activity. Research shows cellular NAD+ levels decline with age and correlate with mitochondrial dysfunction. Direct NAD+ administration in research models aims to restore intracellular stores and activate SIRT1/SIRT3-mediated longevity pathways, supporting DNA repair and metabolic regulation.",
    researchApplications:
      "• **Longevity research** — sirtuin activation and age-related decline models.\n• **Mitochondrial function** — oxidative phosphorylation and ATP production studies.\n• **DNA repair pathways** — PARP and sirtuin NAD-consuming enzyme research.\n• **Neurological models** — cognitive decline and neuroprotection studies.",
    preparation:
      "For the 100mg vial: reconstitute with 2mL bacteriostatic water → 50 mg/mL. On a U-100 insulin syringe, 20 IU = 0.2 mL = 10 mg. Slow injection (over 10+ minutes) is standard protocol to minimize flushing.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { anti_aging: 5, performance: 4, recovery: 3, cognitive: 3 },
  },

  dsip: {
    displayName: "DSIP",
    casNumber: "62568-57-4",
    molecularFormula: "C35H48N10O15",
    shortDescription:
      "Delta Sleep-Inducing Peptide — a 9-amino-acid nonapeptide studied for slow-wave sleep and circadian regulation.",
    productDescription:
      "DSIP is an endogenous nonapeptide first isolated from rabbit cerebral venous blood during electrically-induced sleep. Research models show it modulates slow-wave (delta) sleep architecture, influences HPA axis regulation, and demonstrates anti-nociceptive and stress-buffering properties. Unlike GABAergic sleep agents, its mechanism is not fully characterized but involves modulation of corticotropin release.",
    researchApplications:
      "• **Sleep architecture research** — slow-wave (delta) sleep induction studies.\n• **HPA axis regulation** — stress-response and cortisol modulation models.\n• **Chronobiology studies** — circadian entrainment investigations.\n• **Anti-nociception research** — pain-tolerance and opioid-sparing models.",
    preparation:
      "Reconstitute the 5mg vial with 1mL bacteriostatic water → 5 mg/mL. On a U-100 insulin syringe, 2 IU = 0.02 mL = 100 mcg. Pre-bed administration is standard protocol.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { sleep: 5, recovery: 3, cognitive: 3, anti_aging: 2 },
  },

  epithalon: {
    displayName: "Epithalon",
    casNumber: "307297-39-8",
    molecularFormula: "C14H22N4O9",
    shortDescription:
      "Ala-Glu-Asp-Gly tetrapeptide derived from pineal-gland polypeptide extracts — studied for telomerase upregulation and circadian normalization.",
    productDescription:
      "Epithalon is a synthetic tetrapeptide (Ala-Glu-Asp-Gly) modeled on epithalamin, a bovine pineal-gland polypeptide fraction. Research from Khavinson's group at the Saint Petersburg Institute of Bioregulation and Gerontology has examined its effects on telomerase expression, melatonin-axis function, and extended lifespan in animal models. Human studies most consistently report sleep architecture improvements, particularly enhanced delta-sleep phases, within the first several days of pulsed dosing.",
    researchApplications:
      "• **Telomerase & longevity research** — hTERT upregulation and cellular senescence models.\n• **Circadian & sleep research** — melatonin axis modulation and delta-sleep studies.\n• **Oxidative stress models** — antioxidant gene expression investigations.\n• **Immunosenescence research** — thymic involution and T-cell aging models.",
    preparation:
      "For the 50mg vial: reconstitute with 5mL bacteriostatic water → 10 mg/mL. On a U-100 insulin syringe, 5 IU = 0.05 mL = 5 mg. Classic Khavinson protocol is 10-day or 20-day pulses, 2–3× per year.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { anti_aging: 5, sleep: 4, cognitive: 3, recovery: 2 },
  },

  "ghk-cu": {
    displayName: "GHK-Cu",
    casNumber: "89030-95-5",
    molecularFormula: "C14H24CuN6O4",
    shortDescription:
      "Copper-binding tripeptide (Gly-His-Lys) — naturally occurring peptide studied for collagen synthesis, hair follicle biology, and dermal regeneration.",
    productDescription:
      "GHK-Cu is a naturally-occurring copper tripeptide first isolated from human plasma. Research models show it delivers Cu²⁺ ions to copper-dependent enzymes (lysyl oxidase chief among them) that crosslink collagen and elastin fibers, producing denser, more resilient extracellular matrix. It modulates gene expression broadly — downregulating NF-kB inflammatory programs while upregulating antioxidant and repair pathways. Reconstituted solution is characteristically blue (copper salt in solution, not contamination).",
    researchApplications:
      "• **Dermal remodeling research** — collagen/elastin synthesis and wound contraction studies.\n• **Hair follicle biology** — dermal papilla cell proliferation and anagen induction.\n• **Gene expression studies** — transcriptional modulation of repair and anti-inflammatory programs.\n• **Post-procedure dermal research** — recovery following laser, microneedling, and chemical peel models.",
    preparation:
      "For the 50mg vial: reconstitute with 5mL bacteriostatic water → 10 mg/mL. Solution will be blue — this is normal copper salt coloration. On a U-100 insulin syringe, 10 IU = 0.1 mL = 1 mg. Topical preparations dilute to 0.1–0.5% in sterile saline. Do NOT freeze reconstituted solutions — copper salts drop out of solution.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { skin_hair: 5, anti_aging: 5, recovery: 4, performance: 2 },
  },

  "kisspeptin-10": {
    displayName: "KissPeptin-10",
    casNumber: "374675-21-2",
    molecularFormula: "C63H83N17O14",
    shortDescription:
      "10-amino-acid C-terminal fragment of Kisspeptin-54 — a KISS1R (GPR54) agonist studied as the upstream regulator of the GnRH pulse generator.",
    productDescription:
      "Kisspeptin-10 is a decapeptide derived from the C-terminus of kisspeptin, the product of the KISS1 gene. Research models show it is the most potent known endogenous agonist of KISS1R (GPR54) and acts as the master upstream regulator of hypothalamic GnRH neurons — the gatekeeper of the entire HPG axis. Loss-of-function mutations in KISS1R cause hypogonadotropic hypogonadism in humans, and exogenous kisspeptin triggers robust LH/FSH surges in clinical investigational studies across both sexes.",
    researchApplications:
      "• **HPG axis research** — upstream GnRH pulse generator activation and LH/FSH response models.\n• **Reproductive endocrinology** — puberty initiation pathways and fertility investigations.\n• **Hypogonadism models** — restoration of gonadotropin secretion in functional hypogonadism studies.\n• **Neuroendocrine signaling** — KISS1/GPR54 pathway and sex-steroid feedback research.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water → 2.5 mg/mL. On a U-100 insulin syringe, 4 IU = 0.04 mL = 100 mcg. Half-life is short (minutes); pulsed or bolus protocols are standard.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { performance: 4, muscle: 3, anti_aging: 2, recovery: 2 },
  },

  kpv: {
    displayName: "KPV",
    casNumber: "67727-97-3",
    molecularFormula: "C16H30N4O4",
    shortDescription:
      "Lys-Pro-Val tripeptide — the C-terminal fragment of alpha-MSH (11-13), studied for anti-inflammatory and mucosal-healing effects without the pigmentary action of full-length alpha-MSH.",
    productDescription:
      "KPV is the three-amino-acid C-terminal tail of alpha-melanocyte-stimulating hormone (alpha-MSH 11-13). Unlike full-length alpha-MSH, KPV does not engage MC1R-driven pigmentation, but research models show it retains alpha-MSH's anti-inflammatory activity — suppressing NF-kB signaling, reducing pro-inflammatory cytokine production, and accelerating mucosal repair in models of colitis, dermatitis, and wound healing. Its small size allows oral, topical, and enteric-coated research formulations.",
    researchApplications:
      "• **Gut inflammation research** — IBD, ulcerative colitis, and intestinal barrier preclinical models.\n• **Dermal & wound-healing studies** — anti-inflammatory topical formulations.\n• **Cytokine modulation** — NF-kB and TNF-alpha suppression pathway research.\n• **Mast-cell biology** — histamine-release and allergic-response models.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water → 2.5 mg/mL. On a U-100 insulin syringe, 20 IU = 0.2 mL = 500 mcg. Oral/sublingual and topical research protocols use unreconstituted or water-dissolved powder at custom concentrations.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { gut_health: 5, skin_hair: 4, recovery: 3, anti_aging: 2, immunity: 3 },
  },

  "slupp-332": {
    displayName: "SLU-PP-332",
    casNumber: "2097938-73-1",
    molecularFormula: "C19H19ClN2O4S",
    shortDescription:
      "Small-molecule pan-ERRalpha/beta/gamma agonist — a non-peptide exercise-mimetic research compound developed at Saint Louis University.",
    productDescription:
      "SLU-PP-332 is a non-peptide small-molecule agonist of all three estrogen-related receptor isoforms (ERRalpha, ERRbeta, ERRgamma) — orphan nuclear receptors that act as master regulators of mitochondrial biogenesis, fatty-acid oxidation, and oxidative muscle-fiber phenotype. Research from the Burris group at Saint Louis University has shown that ERR activation recapitulates many of the transcriptional responses to endurance exercise — driving PGC-1alpha co-activation, increasing mitochondrial density, and enhancing fatigue resistance in rodent models. It is not a peptide; this is a synthetic research compound supplied as a lyophilized solid.",
    researchApplications:
      "• **Exercise-mimetic research** — PGC-1alpha / ERR transcriptional network activation models.\n• **Mitochondrial biogenesis** — oxidative muscle-fiber induction and respiratory capacity studies.\n• **Metabolic research** — fatty-acid oxidation, insulin sensitivity, and obesity models.\n• **Endurance phenotype investigations** — running capacity and fatigue-resistance endpoints in rodent studies.",
    preparation:
      "Reconstitute the 5mg vial with 2mL bacteriostatic water or sterile DMSO/saline per research protocol → 2.5 mg/mL. On a U-100 insulin syringe, 4 IU = 0.04 mL = 100 mcg. Solubility is limited in pure water — DMSO-assisted preparations are common in the published literature.",
    storage: STORAGE_LYOPHILIZED,
    benefits: { fat_loss: 4, performance: 5, muscle: 3, recovery: 3, anti_aging: 3 },
  },

  "bac-water": {
    displayName: "BAC Water",
    casNumber: "",
    molecularFormula: "",
    shortDescription:
      "Bacteriostatic water for reconstitution — sterile water preserved with 0.9% benzyl alcohol, the standard solvent for lyophilized research peptides.",
    productDescription:
      "Bacteriostatic water is sterile, non-pyrogenic water preserved with 0.9% benzyl alcohol as a bacteriostatic agent. It is the standard solvent for reconstituting lyophilized research peptides and other research compounds. The benzyl alcohol preservative inhibits microbial growth, allowing a single vial to be punctured multiple times over a 28-day window when stored at 2–8°C. Always add bacteriostatic water slowly along the vial wall — never inject directly into the powder — and swirl gently to dissolve without foaming.",
    researchApplications:
      "• **Peptide reconstitution** — the standard diluent across nearly all lyophilized research peptide protocols.\n• **Multi-dose preparations** — bacteriostatic preservation allows stable repeat access from a single reconstituted vial.\n• **Serial-dilution workflows** — stepwise dilution for dose-response research studies.",
    preparation:
      "Ready to use. Withdraw the required volume (typically 1–3 mL) through a sterile filter needle and add slowly along the interior wall of the target vial. Swirl — do not shake. After first puncture, store at 2–8°C and use within 28 days.",
    storage:
      "Room temperature sealed. After first use: 2–8°C, discard 28 days after first puncture. Keep upright and protected from light.",
    benefits: {},
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function composeLongDescription(kb: PeptideKB): string {
  const parts: string[] = []
  if (kb.productDescription.trim()) parts.push(kb.productDescription.trim())
  if (kb.researchApplications.trim())
    parts.push(`**Research Applications**\n${kb.researchApplications.trim()}`)
  if (kb.preparation.trim())
    parts.push(`**Preparation**\n${kb.preparation.trim()}`)
  return parts.join("\n\n")
}

export async function resolveCategoryIds(
  container: ExecArgs["container"],
  handles: readonly string[]
): Promise<string[]> {
  if (handles.length === 0) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: handles as string[] },
  })
  return (data as { id: string; handle: string }[]).map((c) => c.id)
}

export async function ensureInventoryLevelsForProduct({
  container,
  handle,
  stockedQuantity = 1_000_000,
}: {
  container: ExecArgs["container"]
  handle: string
  stockedQuantity?: number
}): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
    ],
    filters: { handle },
  })

  if (products.length === 0) return
  const product = products[0] as unknown as {
    variants: {
      id: string
      inventory_items: {
        inventory: { id: string; location_levels: { id: string }[] }
      }[]
    }[]
  }

  const [stockLocation] = await stockLocationService.listStockLocations({})
  if (!stockLocation) {
    logger.warn(`[seed-shared] no stock location found, skipping inventory for ${handle}`)
    return
  }

  const toCreate: CreateInventoryLevelInput[] = []
  for (const variant of product.variants) {
    for (const ii of variant.inventory_items ?? []) {
      if ((ii.inventory.location_levels ?? []).length > 0) continue
      toCreate.push({
        location_id: stockLocation.id,
        inventory_item_id: ii.inventory.id,
        stocked_quantity: stockedQuantity,
      })
    }
  }

  if (toCreate.length === 0) return
  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: toCreate },
  })
  logger.info(`[seed-shared] seeded ${toCreate.length} inventory level(s) for ${handle}`)
}

// ---------------------------------------------------------------------------
// upsertProduct — the core primitive for every product seed.
// Looks up by handle OR any legacyHandles. If found, updates title/handle/
// description/metadata. If not, creates via createProductsWorkflow.
// ---------------------------------------------------------------------------

export type UpsertVariantInput = {
  title: string
  sku: string
  optionValue: string
  usd: number
  thb: number
  eur: number
}

export type UpsertProductInput = {
  container: ExecArgs["container"]
  handle: string
  legacyHandles?: string[]
  title: string
  description: string
  longDescription: string
  categoryHandles: string[]
  optionTitle?: string
  variants: UpsertVariantInput[]
  metadata: Record<string, unknown>
  weight?: number
}

export async function upsertProduct({
  container,
  handle,
  legacyHandles = [],
  title,
  description,
  longDescription,
  categoryHandles,
  optionTitle = "Size",
  variants,
  metadata,
  weight = 120,
}: UpsertProductInput): Promise<string> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const categoryIds = await resolveCategoryIds(container, categoryHandles)
  if (categoryIds.length === 0 && categoryHandles.length > 0) {
    logger.warn(
      `[upsert] no categories matched handles [${categoryHandles.join(", ")}] for product ${handle}`
    )
  }

  const existingHandles = [handle, ...legacyHandles]
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: existingHandles },
  })

  const fullMetadata = {
    ...metadata,
    long_description: longDescription,
    legacy_handles: legacyHandles,
  }

  if (existing.length > 0) {
    const productId = (existing[0] as { id: string }).id
    logger.info(`[upsert] updating ${handle} (id=${productId})`)
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: productId,
            handle,
            title,
            description,
            category_ids: categoryIds,
            metadata: fullMetadata,
          },
        ],
      },
    })
    await ensureInventoryLevelsForProduct({ container, handle })
    return productId
  }

  // Create path
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    throw new Error(`[upsert] no default sales channel — run the main seed first`)
  }
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error(`[upsert] no default shipping profile`)
  }

  logger.info(`[upsert] creating ${handle}`)
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title,
          handle,
          description,
          weight,
          status: ProductStatus.PUBLISHED,
          category_ids: categoryIds,
          shipping_profile_id: shippingProfile.id,
          metadata: fullMetadata,
          options: [
            {
              title: optionTitle,
              values: variants.map((v) => v.optionValue),
            },
          ],
          variants: variants.map((v) => ({
            title: v.title,
            sku: v.sku,
            options: { [optionTitle]: v.optionValue },
            manage_inventory: true,
            prices: [
              { amount: v.usd * 100, currency_code: "usd" },
              { amount: v.thb * 100, currency_code: "thb" },
              { amount: v.eur * 100, currency_code: "eur" },
            ],
          })),
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  const productId = (result as { id: string }[])[0].id
  await ensureInventoryLevelsForProduct({ container, handle })
  return productId
}
