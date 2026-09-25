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
};

type PoRow = {
  id: string;
  po_number: string;
  status: string;
  total_amount: number;
  tax_percent: number;
  subtotal: number;
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

  const total = (items.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  return (
    <Sheet open={!!po} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ListPlus className="size-4 text-primary" />
            PO Line Items — {po?.po_number}
          </SheetTitle>
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
                    <TableCell className="text-right text-sm font-semibold font-mono">
                      {currency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 border-t bg-muted/40 text-xs space-y-1 text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">{currency(total)}</span>
              </div>
              {po && po.tax_percent > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST / Tax ({po.tax_percent}%):</span>
                  <span className="font-mono">{currency(Math.round((total * po.tax_percent) / 100))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t pt-1">
                <span>Total PO Value:</span>
                <span className="font-mono text-primary">{currency(po?.total_amount ?? total)}</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
