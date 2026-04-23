import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Gift } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Text,
  Table,
  Badge,
  FocusModal,
  toast,
  Textarea,
} from "@medusajs/ui"
import { useEffect, useState, type FormEvent } from "react"

type Tier = "basic" | "bronze" | "silver" | "gold"

type LedgerRow = {
  id: string
  customer_id: string
  delta: number
  reason: string
  order_id: string | null
  currency: string | null
  note: string | null
  created_at: string
}

type CustomerTier = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  tier: Tier
  balance: number
  rolling: number
  tier_since: string | null
}

const TIER_COLOR: Record<Tier, "grey" | "orange" | "blue" | "green"> = {
  basic: "grey",
  bronze: "orange",
  silver: "blue",
  gold: "green",
}

const LoyaltyPage = () => {
  const [rows, setRows] = useState<CustomerTier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [selectedInfo, setSelectedInfo] = useState<{
    tier: Tier
    balance: number
    lifetimeRolling: number
    pointsToNext: number
    nextTier: Tier | null
  } | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("manual_adjust")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/admin/loyalty/customers", { credentials: "include" })
      const data = await res.json()
      setRows(data.customers || [])
    } catch (e) {
      toast.error("Failed to load loyalty customers")
    } finally {
      setLoading(false)
    }
  }

  async function openCustomer(id: string) {
    setSelectedId(id)
    try {
      const res = await fetch(`/admin/loyalty/customers/${id}`, {
        credentials: "include",
      })
      const data = await res.json()
      setLedger(data.ledger || [])
      setSelectedInfo(data.loyalty || null)
    } catch (e) {
      toast.error("Failed to load customer ledger")
    }
  }

  async function submitAdjust(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    const n = Number(delta)
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Delta must be a non-zero number")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/admin/loyalty/customers/${selectedId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: n, reason, note }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(`Applied ${n > 0 ? "+" : ""}${n} points`)
      setAdjustOpen(false)
      setDelta("")
      setNote("")
      await openCustomer(selectedId)
      await load()
    } catch (e) {
      toast.error("Failed to apply adjustment")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Heading level="h1">Loyalty</Heading>
        <Button variant="secondary" size="small" onClick={load}>
          Refresh
        </Button>
      </div>

      <div>
        <Heading level="h2">Members by tier</Heading>
        <Text className="text-ui-fg-subtle mb-4">
          Rolling 12-month points drive tier. Bronze 100 · Silver 500 · Gold 1000.
        </Text>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Tier</Table.HeaderCell>
              <Table.HeaderCell>Balance</Table.HeaderCell>
              <Table.HeaderCell>Rolling 12m</Table.HeaderCell>
              <Table.HeaderCell>Tier since</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading…</Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell>No loyalty data yet.</Table.Cell>
              </Table.Row>
            ) : (
              rows.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <Text weight="plus">
                        {[r.first_name, r.last_name].filter(Boolean).join(" ") ||
                          r.email ||
                          r.id}
                      </Text>
                      {r.email && (
                        <Text size="small" className="text-ui-fg-subtle">
                          {r.email}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={TIER_COLOR[r.tier] ?? "grey"}>{r.tier}</Badge>
                  </Table.Cell>
                  <Table.Cell>{r.balance}</Table.Cell>
                  <Table.Cell>{r.rolling}</Table.Cell>
                  <Table.Cell>
                    {r.tier_since ? new Date(r.tier_since).toLocaleDateString() : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => openCustomer(r.id)}
                    >
                      View ledger
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </div>

      {selectedId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Heading level="h2">Customer ledger</Heading>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setAdjustOpen(true)}
              >
                Adjust balance
              </Button>
              <Button
                variant="transparent"
                size="small"
                onClick={() => {
                  setSelectedId(null)
                  setLedger([])
                  setSelectedInfo(null)
                }}
              >
                Close
              </Button>
            </div>
          </div>
          {selectedInfo && (
            <div className="flex gap-6 mb-4">
              <Text>
                Tier: <Badge color={TIER_COLOR[selectedInfo.tier]}>{selectedInfo.tier}</Badge>
              </Text>
              <Text>Balance: <strong>{selectedInfo.balance}</strong></Text>
              <Text>Rolling 12m: <strong>{selectedInfo.lifetimeRolling}</strong></Text>
              {selectedInfo.nextTier && (
                <Text>
                  {selectedInfo.pointsToNext} points to <strong>{selectedInfo.nextTier}</strong>
                </Text>
              )}
            </div>
          )}
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Delta</Table.HeaderCell>
                <Table.HeaderCell>Reason</Table.HeaderCell>
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Note</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {ledger.length === 0 ? (
                <Table.Row>
                  <Table.Cell>No ledger rows.</Table.Cell>
                </Table.Row>
              ) : (
                ledger.map((l) => (
                  <Table.Row key={l.id}>
                    <Table.Cell>{new Date(l.created_at).toLocaleString()}</Table.Cell>
                    <Table.Cell>
                      <span style={{ color: l.delta < 0 ? "#c00" : undefined }}>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{l.reason}</Table.Cell>
                    <Table.Cell>
                      {l.order_id ? (
                        <a href={`/app/orders/${l.order_id}`} style={{ color: "#36f" }}>
                          {l.order_id.slice(0, 10)}…
                        </a>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>{l.note || "—"}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      )}

      <FocusModal open={adjustOpen} onOpenChange={setAdjustOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <Heading level="h2">Adjust balance</Heading>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 p-8 max-w-lg">
            <form onSubmit={submitAdjust} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="delta">Delta (positive or negative)</Label>
                <Input
                  id="delta"
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="50 or -25"
                  required
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="manual_adjust"
                />
              </div>
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setAdjustOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Apply"}
                </Button>
              </div>
            </form>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Loyalty",
  icon: Gift,
})

export default LoyaltyPage
