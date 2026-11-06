/**
 * Product copy v2 (2026-11-06) — compliant ENGLISH copy for every published product.
 *
 * Shape:
 *   COMPOUNDS        one block per molecule / item (written once, reused across brands)
 *   PRODUCT_COMPOUND handle -> compound key (+ optional display name for brand trade names)
 *   BRANDS / FORMAT_LABELS / DELIVERY_LINE / STORAGE   short per-brand and per-format text
 *
 * The script product-copy-v2-20261106.ts composes these blocks with product metadata
 * (purity_percentage, cas_number, molecular_formula, size, variant titles) into
 * `description` and `metadata.long_description`.
 *
 * Writing rules (hard): no human-use amounts, routes, schedules, combinations or outcome
 * verbs; neutral "studied as / investigated in / reported in preclinical models" wording;
 * no citations (the PDP renders src/lib/peptide-references.ts separately); no invented specs.
 * `{name}` in a compound text is replaced by the product display name.
 */

export type ResearchPoint = { label: string; text: string }

export type CompoundCopy = {
  /** Default display name. */
  name: string
  /** Short identity phrase for the short description. */
  identity: string
  /** "What it is" paragraph, 60–90 words, < 550 characters. */
  whatItIs: string
  /** "Research context" bullets (2–3). */
  research: ResearchPoint[]
  /** Heading override for the research section (diluents, device). */
  researchHeading?: string
  /** True when CAS / formula from sibling products of this compound may be shown. */
  shareIdentityData: boolean
}

export const COMPOUNDS: Record<string, CompoundCopy> = {
  "bpc-157": {
    name: "BPC-157",
    identity: "a synthetic 15-amino-acid gastric pentadecapeptide studied in angiogenesis and mucosal biology",
    whatItIs:
      "BPC-157 is a synthetic 15-amino-acid peptide, also published as stable gastric pentadecapeptide BPC 157 and PL 14736. Its sequence derives from a protein isolated from gastric juice. Published preclinical work describes interactions with VEGFR2 signalling, the nitric oxide system and fibroblast migration. Researchers use it as a reference compound in studies of angiogenesis, connective-tissue biology and gastrointestinal mucosal biology in animal and cell models.",
    research: [
      { label: "Tendon and ligament injury models", text: "rodent models with histology and biomechanical readouts." },
      { label: "Gastrointestinal mucosa models", text: "rodent lesion models with lesion area and mucosal histology as readouts." },
      { label: "Endothelial cell assays", text: "VEGFR2 phosphorylation, nitric oxide signalling and cell-migration readouts in vitro." },
    ],
    shareIdentityData: true,
  },
  "aod-9604": {
    name: "AOD-9604",
    identity: "a synthetic growth hormone fragment (176–191) studied in lipid-metabolism research",
    whatItIs:
      "AOD-9604 is a synthetic peptide based on the C-terminal region (amino acids 176–191) of human growth hormone, with an added N-terminal tyrosine. Researchers study this fragment apart from the full hormone to examine which structural regions relate to lipid metabolism. Published preclinical work focused on adipocyte lipolysis and lipogenesis assays and on rodent metabolic models. Growth hormone fragments, including AOD-9604, are listed under S2 on the WADA Prohibited List.",
    research: [
      { label: "Adipocyte assays", text: "lipolysis and lipogenesis readouts in isolated fat cells." },
      { label: "Rodent metabolic models", text: "body-composition and plasma lipid readouts compared with full-length growth hormone." },
      { label: "Structure–function studies", text: "comparison of growth hormone fragments with the parent hormone, including IGF-1 readouts." },
    ],
    shareIdentityData: true,
  },
  "cjc-1295-no-dac": {
    name: "CJC-1295 (no DAC)",
    identity: "Modified GRF (1-29), a GHRH analogue without the DAC linker",
    whatItIs:
      "CJC-1295 without DAC, also published as Modified GRF (1-29), is a synthetic analogue of the first 29 amino acids of growth hormone-releasing hormone (GHRH). Amino-acid substitutions give resistance to cleavage by dipeptidyl peptidase-4 (DPP-4). It has no drug affinity complex (DAC) linker, so it does not bind albumin, and its reported half-life is about 30 minutes. It is studied as a reference agonist at the pituitary GHRH receptor.",
    research: [
      { label: "Pituitary cell models", text: "GHRH-receptor activation with cAMP and growth hormone release as readouts." },
      { label: "Animal endocrine studies", text: "growth hormone pulse profiles and IGF-1 readouts." },
      { label: "Peptide stability studies", text: "DPP-4 resistance compared with native GHRH(1-29)." },
    ],
    shareIdentityData: true,
  },
  "cjc-1295": {
    name: "CJC-1295",
    identity: "a DPP-4-resistant synthetic GHRH(1-29) analogue studied at the GHRH receptor",
    whatItIs:
      "CJC-1295 is a synthetic analogue of the first 29 amino acids of growth hormone-releasing hormone (GHRH), with amino-acid substitutions that give resistance to dipeptidyl peptidase-4 (DPP-4). In the literature the name covers two forms: one with a drug affinity complex (DAC) linker that binds albumin, and one without it, also called Modified GRF (1-29). Check the product label and the batch COA for the exact form. Both forms are studied as agonists at the pituitary GHRH receptor.",
    research: [
      { label: "GHRH-receptor pharmacology", text: "receptor binding and cAMP signalling in pituitary cell models." },
      { label: "Endocrine axis studies", text: "growth hormone and IGF-1 readouts in animal models." },
    ],
    shareIdentityData: false,
  },
  dsip: {
    name: "DSIP",
    identity: "delta sleep-inducing peptide, a nonapeptide studied in sleep physiology and neuroendocrine research",
    whatItIs:
      "DSIP (delta sleep-inducing peptide) is a nonapeptide first isolated from the cerebral venous blood of rabbits during induced sleep. It is classed as a neuropeptide, but no specific receptor has been identified and its mechanism is not fully characterised. Published research links it to sleep architecture, stress-hormone regulation and corticotropin release. It is a reference compound for neuroendocrine and sleep-physiology studies in animal models.",
    research: [
      { label: "Sleep-physiology models", text: "EEG recordings of slow-wave (delta) sleep in rodents and rabbits." },
      { label: "Neuroendocrine studies", text: "corticotropin and stress-hormone readouts in animal models." },
    ],
    shareIdentityData: true,
  },
  epithalon: {
    name: "Epithalon",
    identity: "the synthetic tetrapeptide Ala-Glu-Asp-Gly, studied in telomerase and pineal-function research",
    whatItIs:
      "Epithalon (epitalon) is a synthetic tetrapeptide, Ala-Glu-Asp-Gly, modelled on epithalamin, a polypeptide extract of the bovine pineal gland. Vladimir Khavinson's group at the Saint Petersburg Institute of Bioregulation and Gerontology developed it. Reported mechanisms include induction of telomerase activity in cell culture and effects on pineal melatonin production. It is studied as a reference compound in research on cellular ageing and pineal gland function.",
    research: [
      { label: "Cell-culture models", text: "telomerase activity and telomere length readouts." },
      { label: "Pineal function studies", text: "melatonin production readouts in animal models." },
      { label: "Ageing models", text: "biomarker readouts in aged rodents." },
    ],
    shareIdentityData: true,
  },
  "ghk-cu": {
    name: "GHK-Cu",
    identity: "the copper(II) complex of glycyl-L-histidyl-L-lysine, studied as a copper-delivery molecule",
    whatItIs:
      "GHK-Cu is the copper(II) complex of the tripeptide glycyl-L-histidyl-L-lysine. GHK was first isolated from human plasma and has since been found in saliva and urine. The peptide binds Cu²⁺ with high affinity and is studied as a copper-delivery molecule. Copper is a cofactor for lysyl oxidase, the enzyme that crosslinks collagen and elastin. GHK-Cu is also a cosmetic ingredient under the INCI name copper tripeptide-1. Its solutions are typically blue.",
    research: [
      { label: "Fibroblast cultures", text: "collagen, elastin and glycosaminoglycan synthesis readouts." },
      { label: "Gene-expression studies", text: "transcriptional profiling of cells exposed to GHK." },
      { label: "Dermal models", text: "extracellular-matrix histology in skin models." },
    ],
    shareIdentityData: true,
  },
  ipamorelin: {
    name: "Ipamorelin",
    identity: "a synthetic pentapeptide ghrelin-receptor (GHS-R1a) agonist studied in receptor-selectivity research",
    whatItIs:
      "Ipamorelin is a synthetic pentapeptide growth hormone secretagogue and an agonist of the ghrelin receptor (GHS-R1a) on pituitary somatotroph cells. The GHS-R1a pathway is separate from the GHRH receptor pathway. Published animal studies describe ipamorelin as selective: growth hormone release occurred without the marked ACTH or cortisol increase reported for older GHRP compounds. It is a reference compound for GHS-R1a pharmacology and receptor-selectivity studies.",
    research: [
      { label: "Receptor pharmacology", text: "GHS-R1a binding and signalling assays." },
      { label: "Animal endocrine studies", text: "growth hormone, ACTH and cortisol readouts compared with other GHRP compounds." },
    ],
    shareIdentityData: true,
  },
  "kisspeptin-10": {
    name: "Kisspeptin-10",
    identity: "the C-terminal decapeptide of kisspeptin, a KISS1R (GPR54) agonist",
    whatItIs:
      "Kisspeptin-10 is a decapeptide that corresponds to the C-terminal region of kisspeptin, the product of the KISS1 gene. It is an agonist at the kisspeptin receptor KISS1R, also known as GPR54. KISS1R is expressed on hypothalamic GnRH neurons, and kisspeptin signalling is studied as an upstream regulator of the hypothalamic-pituitary-gonadal axis. Kisspeptin-10 is a reference agonist in reproductive neuroendocrinology research in cell and animal models.",
    research: [
      { label: "Receptor assays", text: "KISS1R (GPR54) activation and downstream signalling in cell models." },
      { label: "Neuroendocrine studies", text: "GnRH and luteinising hormone (LH) readouts in animal models." },
    ],
    shareIdentityData: true,
  },
  kpv: {
    name: "KPV",
    identity: "the tripeptide Lys-Pro-Val (α-MSH 11–13), studied in inflammation and epithelial biology",
    whatItIs:
      "KPV is the tripeptide Lys-Pro-Val, which corresponds to residues 11–13 at the C-terminus of α-melanocyte-stimulating hormone (α-MSH). Published work describes anti-inflammatory signalling activity for this fragment, including effects on NF-κB pathway readouts, without the MC1R-linked pigmentation activity of full-length α-MSH. Its small size has made it a subject of formulation research. It is studied as a reference fragment in inflammation and epithelial biology.",
    research: [
      { label: "Intestinal inflammation models", text: "rodent colitis models with cytokine and histology readouts." },
      { label: "Epithelial cell assays", text: "NF-κB activation and pro-inflammatory cytokine readouts." },
    ],
    shareIdentityData: true,
  },
  tirzepatide: {
    name: "Tirzepatide",
    identity: "a 39-amino-acid dual GIP and GLP-1 receptor agonist peptide",
    whatItIs:
      "{name} is a single 39-amino-acid peptide that acts as an agonist at both the glucose-dependent insulinotropic polypeptide (GIP) receptor and the GLP-1 receptor. A C20 fatty-diacid side chain binds albumin and extends the plasma half-life. The dual-receptor design makes it a reference compound for incretin pharmacology. Research compares its signalling at each receptor, and its metabolic readouts in animal models, with those of single-receptor GLP-1 agonists.",
    research: [
      { label: "Receptor pharmacology", text: "cAMP signalling and receptor-bias assays at the GIP and GLP-1 receptors." },
      { label: "Rodent metabolic models", text: "glucose tolerance, insulin secretion, food intake and body-weight readouts in diet-induced obese animals." },
    ],
    shareIdentityData: true,
  },
  retatrutide: {
    name: "Retatrutide",
    identity: "a single peptide agonist at the GIP, GLP-1 and glucagon receptors",
    whatItIs:
      "{name} is a single synthetic peptide that acts as an agonist at three receptors: the glucose-dependent insulinotropic polypeptide (GIP) receptor, the GLP-1 receptor and the glucagon receptor. The glucagon-receptor activity is the main difference from dual GIP/GLP-1 agonists. It is a reference compound for multi-receptor incretin and glucagon pharmacology, and research compares it with single- and dual-receptor agonists in cell assays and animal models.",
    research: [
      { label: "Receptor pharmacology", text: "cAMP signalling at the GIP, GLP-1 and glucagon receptors in cell assays." },
      { label: "Rodent metabolic models", text: "energy expenditure, glucose and body-weight readouts." },
      { label: "Hepatic lipid studies", text: "liver fat and lipid-metabolism readouts linked to glucagon-receptor activity." },
    ],
    shareIdentityData: true,
  },
  "mots-c": {
    name: "MOTS-c",
    identity: "a 16-amino-acid mitochondrial-derived peptide studied in AMPK signalling and energy-metabolism research",
    whatItIs:
      "MOTS-c is a 16-amino-acid peptide encoded by a short open reading frame in the mitochondrial 12S rRNA gene, and it belongs to the mitochondrial-derived peptide class. Published work reports that it can move to the nucleus under metabolic stress and influence nuclear gene expression. It is also linked to AMPK pathway activation and to cellular energy metabolism in skeletal muscle models. It is a reference compound for mitochondrial-to-nuclear signalling and cellular energy-metabolism research.",
    research: [
      { label: "Skeletal muscle cell models", text: "AMPK activation and glucose-uptake readouts." },
      { label: "Rodent metabolic models", text: "insulin sensitivity and energy-metabolism readouts." },
    ],
    shareIdentityData: true,
  },
  "nad-plus": {
    name: "NAD+",
    identity: "nicotinamide adenine dinucleotide, a redox coenzyme studied in energy metabolism",
    whatItIs:
      "NAD+ (nicotinamide adenine dinucleotide) is a dinucleotide coenzyme, not a peptide, present in all living cells. It carries electrons in the redox reactions of glycolysis and mitochondrial respiration. It is also a substrate for NAD+-consuming enzymes, including sirtuins, poly(ADP-ribose) polymerases (PARPs) and CD38. Published research reports that tissue NAD+ levels decline with age in animal models. It is a reference compound in cellular energy-metabolism and sirtuin research.",
    research: [
      { label: "Cell assays", text: "NAD+/NADH ratio, sirtuin activity and PARP activity readouts." },
      { label: "Mitochondrial studies", text: "respiration and redox-state measurements in isolated mitochondria and cells." },
      { label: "Ageing models", text: "tissue NAD+ measurement in aged rodents." },
    ],
    shareIdentityData: true,
  },
  "pt-141": {
    name: "PT-141",
    identity: "bremelanotide, a cyclic heptapeptide MC3R/MC4R agonist studied in central signalling",
    whatItIs:
      "PT-141 (bremelanotide) is a synthetic cyclic heptapeptide analogue of α-melanocyte-stimulating hormone (α-MSH). It acts mainly as an agonist at the melanocortin receptors MC3R and MC4R, which are expressed in the central nervous system. Its development began in melanocortin research on pigmentation, and later work focused on central melanocortin signalling. It is a reference compound for MC4R pharmacology and hypothalamic pathway research.",
    research: [
      { label: "Receptor pharmacology", text: "MC3R and MC4R binding and cAMP signalling assays." },
      { label: "Central signalling studies", text: "hypothalamic melanocortin pathway readouts in rodent behavioural models." },
    ],
    shareIdentityData: true,
  },
  selank: {
    name: "Selank",
    identity: "a synthetic heptapeptide analogue of tuftsin studied in GABAergic and neuropeptide research",
    whatItIs:
      "Selank (TP-7) is a synthetic heptapeptide developed from tuftsin, an endogenous immunomodulatory tetrapeptide, and it is classed as a tuftsin analogue. Russian research groups developed it as a research tool. Published animal work links it to GABAergic modulation, BDNF expression in the hippocampus and inhibition of enkephalin-degrading enzymes. It is a reference compound in stress-response, anxiety-model and neuropeptide research in rodents.",
    research: [
      { label: "Rodent behavioural models", text: "anxiety-related behaviour tests with neurochemical readouts." },
      { label: "Gene-expression studies", text: "GABA-system and BDNF expression readouts in brain tissue." },
    ],
    shareIdentityData: true,
  },
  semax: {
    name: "Semax",
    identity: "the synthetic heptapeptide MEHFPGP, an ACTH(4–10) analogue studied in neurotrophin research",
    whatItIs:
      "Semax is a synthetic heptapeptide, Met-Glu-His-Phe-Pro-Gly-Pro (MEHFPGP). Its sequence is derived from the N-terminal region of adrenocorticotropic hormone (ACTH), and it is classed as an ACTH(4–10) analogue. Published animal work links it to BDNF and NGF expression in the hippocampus and cortex and to changes in enkephalin degradation. It is a reference compound for neurotrophic pathway and cerebral ischaemia research in rodent models.",
    research: [
      { label: "Neurotrophin studies", text: "BDNF and NGF expression readouts in rodent brain tissue." },
      { label: "Cerebral ischaemia models", text: "gene-expression and histology readouts in rodents." },
      { label: "Behavioural models", text: "learning and memory tests in rodents." },
    ],
    shareIdentityData: true,
  },
  "ss-31": {
    name: "SS-31",
    identity: "elamipretide, a mitochondria-targeted tetrapeptide that binds cardiolipin, studied in bioenergetics research",
    whatItIs:
      "SS-31 (elamipretide; also published as Bendavia and MTP-131) is a cell-permeable aromatic-cationic tetrapeptide. It accumulates in the inner mitochondrial membrane, where it binds cardiolipin, the phospholipid that supports the electron-transport-chain complexes and cristae structure. Preclinical studies report effects on cristae architecture, cardiolipin peroxidation and reactive-oxygen-species production. It is a reference compound for mitochondrial bioenergetics and cardiolipin biology in cell, isolated-mitochondria and animal models.",
    research: [
      { label: "Isolated mitochondria", text: "respiration, ATP synthesis and reactive-oxygen-species readouts." },
      { label: "Ischaemia–reperfusion models", text: "cardiac and renal tissue readouts in animals." },
      { label: "Membrane biology", text: "cardiolipin binding and peroxidation assays." },
    ],
    shareIdentityData: true,
  },
  tesamorelin: {
    name: "Tesamorelin",
    identity: "a synthetic GHRH(1-44) analogue studied in growth hormone axis research",
    whatItIs:
      "Tesamorelin is a synthetic analogue of the full 44-amino-acid human growth hormone-releasing hormone (GHRH), with a trans-3-hexenoyl group at the N-terminus. The modification increases resistance to DPP-4 degradation. It acts at pituitary GHRH receptors, and published studies report pulsatile release of endogenous growth hormone with higher IGF-1 concentrations. It is a reference compound for GHRH-receptor pharmacology and growth hormone axis research.",
    research: [
      { label: "Receptor pharmacology", text: "GHRH-receptor activation and cAMP readouts in pituitary cells." },
      { label: "Endocrine studies", text: "growth hormone pulse and IGF-1 readouts." },
      { label: "Body-composition studies", text: "adipose-tissue imaging endpoints in published research." },
    ],
    shareIdentityData: true,
  },
  "thymosin-beta-4": {
    name: "Thymosin Beta-4",
    identity: "a 43-amino-acid G-actin-sequestering peptide studied in cytoskeleton and cell-migration research",
    whatItIs:
      "Thymosin beta-4 (Tβ4) is a naturally occurring 43-amino-acid peptide and one of the main G-actin-sequestering molecules in mammalian cells. By binding monomeric actin, it regulates the pool of actin available for filament assembly, which affects cell motility. The synthetic fragment TB-500 is modelled on its actin-binding region. Thymosin beta-4 is a reference compound for actin-cytoskeleton and cell-migration research in cell and animal models.",
    research: [
      { label: "Cell-migration assays", text: "actin dynamics and endothelial or keratinocyte migration readouts." },
      { label: "Rodent tissue-injury models", text: "dermal and cardiac histology readouts, including angiogenesis markers." },
    ],
    shareIdentityData: true,
  },
  "bacteriostatic-water": {
    name: "Bacteriostatic Water",
    identity: "sterile water with 0.9% benzyl alcohol, a laboratory diluent for lyophilized peptides",
    whatItIs:
      "Bacteriostatic water is sterile water that contains 0.9% benzyl alcohol as a preservative, which is the standard composition for this diluent. The benzyl alcohol limits microbial growth in the vial after the stopper is punctured. Laboratories use it to reconstitute lyophilized peptides and to prepare working solutions. It is not suitable for every compound, and some peptides need a different solvent, such as acetic acid water. Check compatibility on the compound data sheet.",
    researchHeading: "Laboratory use",
    research: [
      { label: "Reconstitution", text: "dissolution of lyophilized research peptides for bench work." },
      { label: "Working solutions", text: "dilution steps in methods that specify a preserved aqueous diluent." },
    ],
    shareIdentityData: false,
  },
  "acetic-acid-water": {
    name: "Acetic Acid Water",
    identity: "dilute acetic acid in sterile water, a laboratory diluent for poorly soluble peptides",
    whatItIs:
      "Acetic acid water is a dilute solution of acetic acid in sterile water. Laboratories use it as a diluent for peptides that dissolve poorly in neutral water, because a mildly acidic solvent can increase the solubility of some peptide sequences. The acetic acid concentration is as printed on the vial label. Before use, confirm on the compound data sheet that an acidic diluent is compatible with the peptide and with the planned assay.",
    researchHeading: "Laboratory use",
    research: [
      { label: "Poorly soluble peptides", text: "reconstitution where neutral water or bacteriostatic water gives incomplete dissolution." },
      { label: "Solvent selection", text: "comparison of diluents during laboratory method development." },
    ],
    shareIdentityData: false,
  },
  "dual-chamber-device": {
    name: "Dual Chamber Cartridge Device",
    identity: "a reusable aluminium device for Supreme Biologics dual-chamber cartridges, with no needle included",
    whatItIs:
      "This is a reusable aluminium device from Supreme Biologics for its dual-chamber cartridges. It holds one Supreme Biologics dual-chamber cartridge at a time and contains no compound of its own. No needle is included, and the cartridges are sold separately on their own product pages. The device fits only the Supreme Biologics dual-chamber system. The Supreme Biologics reusable pen for single-chamber refill cartridges is a separate system.",
    researchHeading: "Compatibility",
    research: [
      { label: "Compatible with", text: "Supreme Biologics dual-chamber cartridges listed on this site." },
      { label: "Not compatible with", text: "single-chamber refill cartridges for the Supreme Biologics reusable pen, or cartridges from other manufacturers." },
    ],
    shareIdentityData: false,
  },
}

/** handle -> compound key, plus a display name where the brand uses a trade name. */
export type ProductCopyRef = { compound: string; displayName?: string }

export const PRODUCT_COMPOUND: Record<string, ProductCopyRef> = {
  "acetic-acid-water-3ml-wolf": { compound: "acetic-acid-water" },
  "aod-9604-5mg-multi-dose-pen-supreme-biologics": { compound: "aod-9604" },
  "aod-9604-5mg-supreme-biologics": { compound: "aod-9604" },
  "aod-9604-5mg-wolf": { compound: "aod-9604" },
  "aod-9604-dual-chamber-supreme-biologics": { compound: "aod-9604" },
  "bacteriostatic-water-10ml-supreme-biologics": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-10ml-wolf": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-3ml-supreme-biologics": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-3ml-wolf": { compound: "bacteriostatic-water" },
  "bpc-157-5mg-fournines": { compound: "bpc-157" },
  "bpc-157-5mg-multi-dose-pen-supreme-biologics": { compound: "bpc-157" },
  "bpc-157-5mg-supreme-biologics": { compound: "bpc-157" },
  "bpc-157-5mg-wolf": { compound: "bpc-157" },
  "bpc-157-dual-chamber-supreme-biologics": { compound: "bpc-157" },
  "cjc-1295-5mg-multi-dose-pen-supreme-biologics": { compound: "cjc-1295" },
  "cjc-1295-no-dac-5mg-fournines": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-5mg-supreme-biologics": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-5mg-wolf": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-dual-chamber-supreme-biologics": { compound: "cjc-1295-no-dac" },
  "dsip-5mg-fournines": { compound: "dsip" },
  "dsip-5mg-supreme-biologics": { compound: "dsip" },
  "dsip-5mg-wolf": { compound: "dsip" },
  "dsip-dual-chamber-supreme-biologics": { compound: "dsip" },
  "dual-chamber-injector-supreme-biologics": { compound: "dual-chamber-device" },
  "epithalon-50mg-fournines": { compound: "epithalon" },
  "epithalon-50mg-multi-dose-pen-supreme-biologics": { compound: "epithalon" },
  "epithalon-50mg-supreme-biologics": { compound: "epithalon" },
  "epithalon-50mg-wolf": { compound: "epithalon" },
  "epithalon-dual-chamber-supreme-biologics": { compound: "epithalon" },
  "ghk-cu-50mg-calyssee": { compound: "ghk-cu" },
  "ghk-cu-50mg-fournines": { compound: "ghk-cu" },
  "ghk-cu-50mg-multi-dose-pen-supreme-biologics": { compound: "ghk-cu" },
  "ghk-cu-50mg-supreme-biologics": { compound: "ghk-cu" },
  "ghk-cu-50mg-wolf": { compound: "ghk-cu" },
  "ipamorelin-5mg-fournines": { compound: "ipamorelin" },
  "ipamorelin-5mg-multi-dose-pen-supreme-biologics": { compound: "ipamorelin" },
  "ipamorelin-5mg-supreme-biologics": { compound: "ipamorelin" },
  "ipamorelin-5mg-wolf": { compound: "ipamorelin" },
  "ipamorelin-dual-chamber-supreme-biologics": { compound: "ipamorelin" },
  "kisspeptin-10-5mg-supreme-biologics": { compound: "kisspeptin-10" },
  "kisspeptin-10-5mg-wolf": { compound: "kisspeptin-10" },
  "kisspeptin-10-dual-chamber-supreme-biologics": { compound: "kisspeptin-10" },
  "kpv-5mg-multi-dose-pen-supreme-biologics": { compound: "kpv" },
  "kpv-5mg-supreme-biologics": { compound: "kpv" },
  "kpv-5mg-wolf": { compound: "kpv" },
  "kpv-dual-chamber-supreme-biologics": { compound: "kpv" },
  "monera-20mg-multi-dose-pen-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "monera-5mg-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "monera-dual-chamber-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "mots-c-10mg-fournines": { compound: "mots-c" },
  "mots-c-10mg-supreme-biologics": { compound: "mots-c" },
  "mots-c-10mg-wolf": { compound: "mots-c" },
  "mots-c-dual-chamber-supreme-biologics": { compound: "mots-c" },
  "nad-plus-100mg-fournines": { compound: "nad-plus" },
  "nad-plus-100mg-supreme-biologics": { compound: "nad-plus" },
  "nad-plus-100mg-wolf": { compound: "nad-plus" },
  "nad-plus-dual-chamber-supreme-biologics": { compound: "nad-plus" },
  "pt-141-10mg-calyssee": { compound: "pt-141" },
  "pt-141-10mg-multi-dose-pen-supreme-biologics": { compound: "pt-141" },
  "pt-141-10mg-supreme-biologics": { compound: "pt-141" },
  "pt-141-10mg-wolf": { compound: "pt-141" },
  "pt-141-150mg-nasal-spray-calyssee": { compound: "pt-141" },
  "pt-141-150mg-nasal-spray-supreme-biologics": { compound: "pt-141" },
  "pt-141-dual-chamber-supreme-biologics": { compound: "pt-141" },
  "retatrutide-5mg-calyssee": { compound: "retatrutide" },
  "retatrutide-5mg-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "retatrutide-5mg-wolf": { compound: "retatrutide" },
  "retatrutide-dual-chamber-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "rittera-5mg-multi-dose-pen-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "selank-45mg-nasal-spray-fournines": { compound: "selank" },
  "selank-5mg-multi-dose-pen-supreme-biologics": { compound: "selank" },
  "selank-5mg-supreme-biologics": { compound: "selank" },
  "selank-5mg-wolf": { compound: "selank" },
  "semax-45mg-nasal-spray-supreme-biologics": { compound: "semax" },
  "semax-5mg-multi-dose-pen-supreme-biologics": { compound: "semax" },
  "semax-5mg-supreme-biologics": { compound: "semax" },
  "semax-5mg-wolf": { compound: "semax" },
  "semax-dual-chamber-supreme-biologics": { compound: "semax" },
  "ss-31-10mg-fournines": { compound: "ss-31" },
  "ss-31-10mg-multi-dose-pen-supreme-biologics": { compound: "ss-31" },
  "ss-31-10mg-supreme-biologics": { compound: "ss-31" },
  "ss-31-10mg-wolf": { compound: "ss-31" },
  "ss-31-dual-chamber-supreme-biologics": { compound: "ss-31" },
  "tesamorelin-5mg-fournines": { compound: "tesamorelin" },
  "tesamorelin-5mg-supreme-biologics": { compound: "tesamorelin" },
  "tesamorelin-5mg-wolf": { compound: "tesamorelin" },
  "tesamorelin-dual-chamber-supreme-biologics": { compound: "tesamorelin" },
  "thymosin-beta-4-10mg-fournines": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-10mg-supreme-biologics": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-10mg-wolf": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-dual-chamber-supreme-biologics": { compound: "thymosin-beta-4" },
  "tirzepatide-5mg-fournines": { compound: "tirzepatide" },
  "tirzepatide-5mg-wolf": { compound: "tirzepatide" },
}

/** metadata.producent -> full brand name shown in copy. */
export const BRANDS: Record<string, string> = {
  Wolf: "Wolf Biotech",
  FourNines: "FourNines Research",
  "Supreme Biologics": "Supreme Biologics",
  Calyssee: "Calyssee",
}

export type Kind = "vial" | "pen" | "multidose" | "dual" | "spray" | "diluent" | "device"

/** Short format names, used in "other formats" lines. */
export const FORMAT_LABELS: Record<Kind, string> = {
  vial: "lyophilized vial",
  pen: "ready-mixed pen",
  multidose: "reusable pen with single-chamber refill",
  dual: "dual-chamber cartridges",
  spray: "spray-format vial",
  diluent: "diluent vial",
  device: "dual-chamber cartridge device",
}

export const DELIVERY_LINE =
  "Orders are dispatched within 24 hours. Delivery takes 3–5 business days in Asia and about 9 days to Europe and other regions."

export const RESEARCH_USE_LINE = "For laboratory research use only. Not for human or veterinary use."
export const SHORT_SUFFIX = "for laboratory research use only."

export const STORAGE = {
  powder: [
    "Lyophilized powder: store at -20°C for long-term storage, or at 2–8°C for short-term storage.",
    "Keep dry and protected from light.",
    "After reconstitution, store at 2–8°C and use within 30 days.",
  ],
  dualDry: [
    "Unmixed cartridges (lyophilized powder): store at -20°C for long-term storage, or at 2–8°C for short-term storage.",
    "Keep dry and protected from light.",
    "After the diluent is added and mixed, store at 2–8°C and use within 30 days.",
  ],
  dualWithDiluent: [
    "Unmixed cartridges contain liquid diluent in one chamber: store at 2–8°C unless the label states otherwise.",
    "Keep protected from light.",
    "After mixing, store at 2–8°C and use within 30 days.",
  ],
  liquid: [
    "Supplied as ready-mixed liquid: store at 2–8°C and keep protected from light.",
    "After first use, keep at 2–8°C and use within 30 days.",
    "Follow the expiry date on the product label.",
  ],
  device: [
    "Keep the device clean and dry between uses.",
    "Store cartridges as described on their own product pages.",
  ],
}
