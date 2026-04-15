import { defineRouteConfig } from "@medusajs/admin-sdk"
import { UsersSolid } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Text,
  Table,
  Badge,
  Select,
  IconButton,
  toast,
  FocusModal,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useEffect, useState, type FormEvent } from "react"

type Affiliate = {
  id: string
  code: string
  name: string
  email: string
  commission_pct: number
  notes: string | null
  order_count: number
  revenue_total: number
  commission_earned: number
  currency_code: string | null
  created_at: string
}

const emptyForm = {
  name: "",
  email: "",
  code: "",
  commission_pct: "15",
  discount_type: "percentage",
  discount_value: "10",
  notes: "",
}

function formatMoney(amount: number, currency: string | null): string {
  const cc = (currency || "usd").toUpperCase()
  return `${cc} ${amount.toFixed(2)}`
}

const AffiliatesPage = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/admin/affiliates", { credentials: "include" })
      const data = await res.json()
      setAffiliates(data.affiliates ?? [])
    } catch (e) {
      toast.error("Failed to load affiliates")
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch("/admin/affiliates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          code: form.code,
          commission_pct: Number(form.commission_pct),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      toast.success("Affiliate created")
      setForm(emptyForm)
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create")
    }
    setCreating(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete affiliate "${name}" and their promotion code?`)) return
    try {
      const res = await fetch(`/admin/affiliates/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Affiliate deleted")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const totalRevenue = affiliates.reduce((s, a) => s + a.revenue_total, 0)
  const totalOrders = affiliates.reduce((s, a) => s + a.order_count, 0)
  const totalCommission = affiliates.reduce((s, a) => s + a.commission_earned, 0)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Affiliate Partners</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Each partner gets a unique promotion code. Orders are attributed by the
            code shoppers apply at checkout.
          </Text>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Add Partner
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Partners
          </Text>
          <Heading level="h2">{affiliates.length}</Heading>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Attributed orders
          </Text>
          <Heading level="h2">{totalOrders}</Heading>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Attributed revenue
          </Text>
          <Heading level="h2">${totalRevenue.toFixed(2)}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Commission owed: ${totalCommission.toFixed(2)}
          </Text>
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <Text>Loading…</Text>
        ) : affiliates.length === 0 ? (
          <div className="py-8 text-center">
            <Text className="text-ui-fg-subtle">No affiliates yet.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Code</Table.HeaderCell>
                <Table.HeaderCell>Commission</Table.HeaderCell>
                <Table.HeaderCell>Orders</Table.HeaderCell>
                <Table.HeaderCell>Revenue</Table.HeaderCell>
                <Table.HeaderCell>Commission owed</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {affiliates.map((a) => (
                <Table.Row key={a.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <Text size="small" weight="plus">
                        {a.name}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {a.email}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="small" color="grey">
                      {a.code}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{a.commission_pct}%</Table.Cell>
                  <Table.Cell>{a.order_count}</Table.Cell>
                  <Table.Cell>
                    {formatMoney(a.revenue_total, a.currency_code)}
                  </Table.Cell>
                  <Table.Cell>
                    {formatMoney(a.commission_earned, a.currency_code)}
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      variant="transparent"
                      onClick={() => handleDelete(a.id, a.name)}
                    >
                      <Trash />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <Heading>Add Affiliate Partner</Heading>
          </FocusModal.Header>
          <form onSubmit={handleCreate}>
            <FocusModal.Body className="flex flex-col gap-4 p-6">
              <div>
                <Label>Partner name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Doe / @janefit"
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <div>
                <Label>Promo code (what shoppers type at checkout)</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="JANE10"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount type</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) => setForm({ ...form, discount_type: v })}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="percentage">Percentage</Select.Item>
                      <Select.Item value="fixed">Fixed amount</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label>
                    Discount value ({form.discount_type === "percentage" ? "%" : "cents"})
                  </Label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm({ ...form, discount_value: e.target.value })
                    }
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Commission to partner (% of order total)</Label>
                <Input
                  type="number"
                  value={form.commission_pct}
                  onChange={(e) =>
                    setForm({ ...form, commission_pct: e.target.value })
                  }
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Instagram, 120k followers, fitness niche"
                />
              </div>
            </FocusModal.Body>
            <FocusModal.Footer>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={creating}>
                Create partner
              </Button>
            </FocusModal.Footer>
          </form>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Affiliates",
  icon: UsersSolid,
})

export default AffiliatesPage
