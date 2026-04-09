import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["us", "gb", "de", "th", "sg"];

  logger.info("Seeding LifeSpanSupply store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "usd",
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "North America",
          currency_code: "usd",
          countries: ["us"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "LifeSpanSupply Warehouse",
          address: {
            city: "Bangkok",
            country_code: "TH",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Worldwide Shipping",
    type: "shipping",
    service_zones: [
      {
        name: "Worldwide",
        geo_zones: countries.map((cc) => ({
          country_code: cc,
          type: "country" as const,
        })),
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 5-7 business days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 1-2 business days.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 25,
          },
          {
            region_id: region.id,
            amount: 25,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "LifeSpanSupply Storefront",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "GLP-1 Agonists",
          is_active: true,
        },
        {
          name: "Growth Hormone",
          is_active: true,
        },
        {
          name: "Cellular Repair",
          is_active: true,
        },
        {
          name: "Skin & Tissue",
          is_active: true,
        },
      ],
    },
  });

  const glp1 = categoryResult.find((cat) => cat.name === "GLP-1 Agonists")!;
  const gh = categoryResult.find((cat) => cat.name === "Growth Hormone")!;
  const repair = categoryResult.find((cat) => cat.name === "Cellular Repair")!;
  const skin = categoryResult.find((cat) => cat.name === "Skin & Tissue")!;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        // GLP-1 Agonists
        {
          title: "Semaglutide 5mg",
          category_ids: [glp1.id],
          description: "High-purity Semaglutide peptide for research purposes. GLP-1 receptor agonist used in metabolic research studies.",
          handle: "semaglutide-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C187H291N45O59",
            cas_number: "910463-68-2",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "SEMA-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 89, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Tirzepatide 5mg",
          category_ids: [glp1.id],
          description: "Research-grade Tirzepatide dual GIP/GLP-1 receptor agonist peptide for laboratory investigation.",
          handle: "tirzepatide-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C225H348N48O68",
            cas_number: "2023788-19-2",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "TIRZ-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 95, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "AOD-9604 5mg",
          category_ids: [glp1.id],
          description: "AOD-9604 peptide fragment for metabolic research. Modified fragment of human growth hormone.",
          handle: "aod-9604-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C78H123N21O23S1",
            cas_number: "221231-10-3",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "AOD-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 48, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // Growth Hormone
        {
          title: "CJC-1295 DAC 2mg",
          category_ids: [gh.id],
          description: "CJC-1295 with DAC (Drug Affinity Complex) for extended-release growth hormone research applications.",
          handle: "cjc-1295-dac-2mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C152H252N44O42",
            cas_number: "863288-34-0",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["2mg"] }],
          variants: [
            {
              title: "2mg",
              sku: "CJC-2MG",
              options: { Size: "2mg" },
              prices: [{ amount: 49, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Ipamorelin 5mg",
          category_ids: [gh.id],
          description: "Ipamorelin selective growth hormone secretagogue peptide for GH release pathway research.",
          handle: "ipamorelin-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C38H49N9O5",
            cas_number: "170851-70-4",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "IPA-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 42, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "GHRP-6 5mg",
          category_ids: [gh.id],
          description: "Growth Hormone Releasing Peptide-6 for research into GH secretion and appetite signaling pathways.",
          handle: "ghrp-6-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C46H56N12O6",
            cas_number: "87616-84-0",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "GHRP6-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 38, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Sermorelin 2mg",
          category_ids: [gh.id],
          description: "Sermorelin acetate (GRF 1-29) for growth hormone releasing hormone receptor research.",
          handle: "sermorelin-2mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C149H246N44O42S",
            cas_number: "86168-78-7",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["2mg"] }],
          variants: [
            {
              title: "2mg",
              sku: "SERM-2MG",
              options: { Size: "2mg" },
              prices: [{ amount: 44, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // Cellular Repair
        {
          title: "BPC-157 5mg",
          category_ids: [repair.id],
          description: "Body Protection Compound-157 pentadecapeptide for tissue repair and regeneration research.",
          handle: "bpc-157-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C62H98N16O22",
            cas_number: "137525-51-0",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "BPC-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 54, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "TB-500 5mg",
          category_ids: [repair.id],
          description: "Thymosin Beta-4 fragment for wound healing and tissue regeneration research applications.",
          handle: "tb-500-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C212H350N56O78S",
            cas_number: "77591-33-4",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "TB500-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 58, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Thymosin Alpha-1 5mg",
          category_ids: [repair.id],
          description: "Thymosin Alpha-1 peptide for immune modulation and cellular repair pathway research.",
          handle: "thymosin-alpha-1-5mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C129H215N33O55",
            cas_number: "62304-98-7",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["5mg"] }],
          variants: [
            {
              title: "5mg",
              sku: "TA1-5MG",
              options: { Size: "5mg" },
              prices: [{ amount: 65, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Epithalon 10mg",
          category_ids: [repair.id],
          description: "Epithalon (Epitalon) tetrapeptide for telomerase activation and anti-aging research.",
          handle: "epithalon-10mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C14H22N4O9",
            cas_number: "307297-39-8",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["10mg"] }],
          variants: [
            {
              title: "10mg",
              sku: "EPITH-10MG",
              options: { Size: "10mg" },
              prices: [{ amount: 72, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        // Skin & Tissue
        {
          title: "GHK-Cu 50mg",
          category_ids: [skin.id],
          description: "Copper peptide GHK-Cu for skin regeneration, collagen synthesis, and wound healing research.",
          handle: "ghk-cu-50mg",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            molecular_formula: "C14H24CuN6O4",
            cas_number: "49557-75-7",
            purity_percentage: "98",
          },
          options: [{ title: "Size", values: ["50mg"] }],
          variants: [
            {
              title: "50mg",
              sku: "GHKCU-50MG",
              options: { Size: "50mg" },
              prices: [{ amount: 62, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
  logger.info(`\nPublishable API Key: ${publishableApiKey!.id}`);
  logger.info(`Region ID: ${region.id}`);
  logger.info("\nSave these for your storefront .env!`");
}
