import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"

// Shows the LifeSpan Circle gift on the order page so staff know what to
// add to the box. Written by subscribers/circle-order-placed.ts.
const OrderCircleNote = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const c = (data?.metadata as Record<string, any> | null | undefined)?.circle as { note?: string; sample?: boolean } | undefined
  if (!c?.note) return null
  return (
    <Container className="p-0">
      <div style={{ padding: "14px 24px", borderLeft: "4px solid #c8a96e", background: "rgba(200,169,110,0.10)" }}>
        <Heading level="h2">LifeSpan Circle gift</Heading>
        <Text size="base" weight="plus" style={{ marginTop: 6 }}>
          {c.note}
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderCircleNote
