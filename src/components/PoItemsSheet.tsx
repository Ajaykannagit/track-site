import { Button } from "@/components/ui/button";
import { PrintablePoDialog, type PrintablePoData } from "@/components/PrintablePoDialog";
import { Printer } from "lucide-react";
import { useState } from "react";
import { ListPlus } from "lucide-react";
import { useRows } from "@/lib/db";
import { currency } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PoItem = {
  id: string;
  po_id: string;
  material: string;
  specification: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
  gst_percent?: number | null;
};

type PoRow = {
  id: string;
  po_number: string;
  po_date?: string;
  status: string;
  total_amount: number;
  tax_percent: number;
  subtotal: number;
  travel_charges?: number;
  terms?: string | null;
  supplier_id?: string | null;
  project_id?: string | null;
};

interface Props {
  po: PoRow | null;
  onClose: () => void;
}

export function PoItemsSheet({ po, onClose }: Props) {
  const items = useRows<PoItem>("purchase_order_items", {
    filters: po ? [{ col: "po_id", op: "eq", value: po.id }] : [],
    order: { col: "created_at" },
    enabled: !!po,
  });

  const [printOpen, setPrintOpen] = useState(false);
  const total = (items.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const travelAmt = Number(po?.travel_charges ?? 0);
  const gstAmt = (items.data ?? []).reduce((s, i) => {
    const rate = i.gst_percent !== undefined && i.gst_percent !== null ? Number(i.gst_percent) : Number(po?.tax_percent ?? 0);
    return s + (Number(i.amount ?? 0) * rate) / 100;
  }, 0);
  const subtotalWithGst = Math.round((total + gstAmt) * 100) / 100;
  const finalTotal = Math.round((subtotalWithGst + travelAmt) * 100) / 100;

  return (
    <>
    <Sheet open={!!po} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ListPlus className="size-4 text-primary" />
              PO Line Items — {po?.po_number}
            </SheetTitle>
            {po && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintOpen(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <Printer className="size-3.5" /> Print PO / PDF
              </Button>
            )}
          </div>
          <SheetDescription>
            Materials and agreed pricing for Purchase Order {po?.po_number}. Status: {po?.status?.toUpperCase()}
          </SheetDescription>
        </SheetHeader>

        {items.isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading PO materials…</p>
        ) : (items.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No line items found for this PO.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/60">
                  <TableHead>Material</TableHead>
                  <TableHead>Specification / Unit</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.material}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.specification || "—"}
                      {item.unit ? ` (${item.unit})` : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">{currency(item.rate)}</TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {item.gst_percent !== undefined && item.gst_percent !== null ? `${item.gst_percent}%` : `${po?.tax_percent ?? 0}%`}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold font-mono">
                      {currency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 border-t bg-muted/40 text-xs space-y-1.5 text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materials Subtotal:</span>
                <span className="font-mono">{currency(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST Tax (Item-wise):</span>
                <span className="font-mono">{currency(gstAmt)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Materials Total (with GST):</span>
                <span className="font-mono">{currency(subtotalWithGst)}</span>
              </div>
              <div className="flex justify-between text-amber-800 dark:text-amber-300">
                <span>+ Travel / Transport Charge (Untaxed):</span>
                <span className="font-mono font-bold">{currency(travelAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t-2 pt-1">
                <span>Final PO Total:</span>
                <span className="font-mono text-primary text-base">{currency(finalTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {po && (
      <PrintablePoDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        po={{
          po_number: po.po_number,
          po_date: po.po_date || new Date().toISOString(),
          status: po.status,
          project_name: po.project_id || undefined,
          supplier_name: po.supplier_id || undefined,
          terms: po.terms,
          items: (items.data ?? []).map((i) => ({
            material: i.material,
            specification: i.specification,
            unit: i.unit,
            quantity: i.quantity,
            rate: i.rate,
            amount: i.amount,
          })),
          subtotal: total,
          total_gst: gstAmt,
          subtotal_with_gst: subtotalWithGst,
          travel_charges: travelAmt,
          final_total: finalTotal,
        }}
      />
    )}
    </>
  );
}
