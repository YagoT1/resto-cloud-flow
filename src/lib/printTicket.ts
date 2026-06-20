import jsPDF from "jspdf";

export interface TicketItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface TicketData {
  restaurantName: string;
  branchName?: string | null;
  orderNumber: number | string;
  createdAt: string | Date;
  tableNumber?: string | null;
  customerName?: string | null;
  notes?: string | null;
  items: TicketItem[];
  subtotal: number;
  total: number;
  tip?: number;
  paymentMethod?: string | null;
  footer?: string;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

const methodLabel = (m?: string | null) => {
  if (!m) return null;
  const map: Record<string, string> = {
    cash: "Efectivo", debit: "Tarjeta débito", credit: "Tarjeta crédito",
    transfer: "Transferencia", mercadopago: "Mercado Pago", qr: "QR", other: "Otro",
  };
  return map[m] ?? m;
};

/** Generate an 80mm-wide ticket PDF and trigger download. */
export function generateTicketPdf(data: TicketData): jsPDF {
  const width = 80; // 80mm
  // Estimate height based on item count; jsPDF auto-truncates if too short.
  const baseHeight = 100;
  const itemsHeight = data.items.length * 8;
  const height = baseHeight + itemsHeight + (data.notes ? 12 : 0);

  const doc = new jsPDF({ unit: "mm", format: [width, height] });
  let y = 6;
  const lineH = 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.restaurantName, width / 2, y, { align: "center" });
  y += lineH + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.branchName) {
    doc.text(data.branchName, width / 2, y, { align: "center" });
    y += lineH;
  }

  doc.setFontSize(8);
  doc.text(new Date(data.createdAt).toLocaleString("es-AR"), width / 2, y, { align: "center" });
  y += lineH;

  doc.setLineWidth(0.2);
  doc.line(3, y, width - 3, y);
  y += lineH;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Pedido #${data.orderNumber}`, 3, y);
  if (data.tableNumber) doc.text(`Mesa ${data.tableNumber}`, width - 3, y, { align: "right" });
  y += lineH + 1;

  if (data.customerName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Cliente: ${data.customerName}`, 3, y);
    y += lineH;
  }

  doc.setLineWidth(0.2);
  doc.line(3, y, width - 3, y);
  y += lineH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  data.items.forEach((it) => {
    const left = `${it.quantity}x ${it.product_name}`;
    const right = money(Number(it.unit_price) * it.quantity);
    const wrapped = doc.splitTextToSize(left, width - 22);
    doc.text(wrapped, 3, y);
    doc.text(right, width - 3, y, { align: "right" });
    y += wrapped.length * lineH;
  });

  y += 1;
  doc.line(3, y, width - 3, y);
  y += lineH;

  doc.setFontSize(9);
  doc.text("Subtotal", 3, y);
  doc.text(money(data.subtotal), width - 3, y, { align: "right" });
  y += lineH;

  if (data.tip && data.tip > 0) {
    doc.text("Propina", 3, y);
    doc.text(money(data.tip), width - 3, y, { align: "right" });
    y += lineH;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", 3, y);
  doc.text(money(data.total + (data.tip ?? 0)), width - 3, y, { align: "right" });
  y += lineH + 1;

  if (data.paymentMethod) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Pago: ${methodLabel(data.paymentMethod)}`, 3, y);
    y += lineH;
  }

  if (data.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    const wrapped = doc.splitTextToSize(`Notas: ${data.notes}`, width - 6);
    doc.text(wrapped, 3, y);
    y += wrapped.length * lineH;
  }

  y += 2;
  doc.line(3, y, width - 3, y);
  y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(data.footer ?? "¡Gracias por tu visita!", width / 2, y, { align: "center" });

  return doc;
}

export function downloadTicketPdf(data: TicketData) {
  const doc = generateTicketPdf(data);
  doc.save(`ticket-${data.orderNumber}.pdf`);
}
