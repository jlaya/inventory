import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Calendar, Download, RefreshCw, ShoppingCart,
  Truck, ArrowRight, DollarSign, Package, AlertCircle, Info, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AuditDashboardProps {
  apiUrl: string;
}

// Helper function to dynamically load jsPDF and jsPDF-AutoTable plugin from CDN
const loadJsPDF = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf) {
      resolve((window as any).jspdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const autoTableScript = document.createElement('script');
      autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      autoTableScript.onload = () => resolve((window as any).jspdf);
      autoTableScript.onerror = () => reject(new Error('No se pudo cargar el plugin jsPDF-AutoTable'));
      document.body.appendChild(autoTableScript);
    };
    script.onerror = () => reject(new Error('No se pudo cargar la librería jsPDF'));
    document.body.appendChild(script);
  });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2].split('T')[0].split(' ')[0];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

const getMetric = (items: any, keys: string[]): number => {
  if (!items) return 0;
  for (const k of keys) {
    if (items[k] !== undefined) {
      const val = items[k];
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$\s%,]/g, ''));
      return isNaN(num) ? 0 : num;
    }
  }
  return 0;
};

export default function AuditDashboard({ apiUrl }: AuditDashboardProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'sales' | 'inputs' | 'balance'>('sales');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [inputsData, setInputsData] = useState<any[]>([]);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // Track which rows have expanded details
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [expandedSales, setExpandedSales] = useState<{ [key: string]: boolean }>({});

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  const toggleSale = (saleCode: string) => {
    setExpandedSales(prev => ({
      ...prev,
      [saleCode]: !prev[saleCode]
    }));
  };

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      let query = `${apiUrl}/history/audit-data`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      if (params.toString()) {
        query += `?${params.toString()}`;
      }

      const res = await fetch(query);
      if (!res.ok) throw new Error('Error al obtener datos de auditoría');
      const data = await res.json();

      setSalesData(data.sales || []);
      setInputsData(data.inputs || []);
    } catch (err) {
      console.error('Error fetching audit data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [startDate, endDate]);

  // KPIs Calculations
  const totalSalesCost = salesData.reduce((acc, item) => acc + Number(item.total_cost || 0), 0);
  const totalInputsCost = inputsData.reduce((acc, item) => acc + Number(item.total_cost || 0), 0);
  const uniqueItemsAudited = new Set([
    ...salesData.map(s => s.inventory_id),
    ...inputsData.map(i => i.inventory_id)
  ]).size;

  // Consolidated Balance per Insumo (Mutable in real-time by dates)
  const consolidatedBalance = useMemo(() => {
    const balances: {
      [id: number]: {
        inventory_id: number;
        name: string;
        sku: string;
        uom: string;
        consumed: number;
        replenished: number;
        consumedCost: number;
        replenishedCost: number;
      };
    } = {};

    salesData.forEach((s) => {
      const id = s.inventory_id;
      if (!balances[id]) {
        balances[id] = {
          inventory_id: id,
          name: s.inventory_name,
          sku: s.inventory_sku,
          uom: s.uom || 'Kg',
          consumed: 0,
          replenished: 0,
          consumedCost: 0,
          replenishedCost: 0,
        };
      }
      balances[id].consumed += Number(s.quantity || 0);
      balances[id].consumedCost += Number(s.total_cost || 0);
    });

    inputsData.forEach((i) => {
      const id = i.inventory_id;
      if (!balances[id]) {
        balances[id] = {
          inventory_id: id,
          name: i.inventory_name,
          sku: i.inventory_sku,
          uom: i.uom || 'Kg',
          consumed: 0,
          replenished: 0,
          consumedCost: 0,
          replenishedCost: 0,
        };
      }
      balances[id].replenished += Number(i.quantity || 0);
      balances[id].replenishedCost += Number(i.total_cost || 0);
    });

    return Object.values(balances);
  }, [salesData, inputsData]);

  const uniqueSales = useMemo(() => {
    const salesMap = new Map<string, any>();
    salesData.forEach((s) => {
      if (s.sale_code && !salesMap.has(s.sale_code)) {
        salesMap.set(s.sale_code, {
          sale_code: s.sale_code,
          movement_date: s.movement_date,
          recipe_name: s.recipe_name || 'Descuento Directo',
          quantity: Number(s.sale_recipe_quantity || s.quantity),
          sale_items: s.sale_items,
        });
      }
    });
    return Array.from(salesMap.values());
  }, [salesData]);

  // Client-Side Dynamic PDF Generation in Landscape Format using jsPDF
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await loadJsPDF();
      const { jsPDF } = (window as any).jspdf;

      // Initialize doc in landscape format to maximize columns space
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const primaryColor = [15, 23, 42]; // Navy/Slate
      const secondaryColor = [15, 118, 110]; // Teal
      const accentColor = [59, 130, 246]; // Azul
      const darkGray = [51, 65, 85];
      const lightGray = [248, 250, 252];

      // --- PAGE HEADER DRAWING ---
      const drawHeader = (page: number) => {
        if (page === 1) {
          // Main Corporate Banner
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(15, 12, 267, 22, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text('ERP RESTAURANT - AUDITORÍA GENERAL DE INVENTARIO', 22, 20);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(200, 200, 200);
          doc.text('REPORTE DE MOVIMIENTOS DE INVENTARIO', 22, 26);

          doc.setTextColor(148, 163, 184);
          doc.setFontSize(7.5);
          doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleString()}`, 22, 31);

          // Parameters block
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.rect(15, 38, 267, 18, 'F');
          doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text('PARÁMETROS DEL REPORTE:', 22, 44);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Fecha: ${startDate ? formatDate(startDate) : 'Historial Completo'} - ${endDate ? formatDate(endDate) : 'Historial Completo'}`, 22, 50);
          doc.text('Almacén Central', 150, 44);
          doc.text('Estado: Listo para Auditoría', 150, 50);

          return 62; // Y position after header
        } else {
          // Smaller header for next pages
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(15, 12, 267, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('ERP RESTAURANT • REPORTE CONTINUO', 22, 18.5);
          doc.setTextColor(200, 200, 200);
          doc.setFontSize(7.5);
          doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 220, 18.5);
          return 26;
        }
      };

      let currentY = drawHeader(1);

      // --- KPI CARDS SUMMARY ---
      const cardW = 62;
      const cardH = 15;
      const gap = 6.3;

      // Card 1: Sales
      doc.setFillColor(239, 246, 255); // light blue
      doc.rect(15, currentY, cardW, cardH, 'F');
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('SALIDAS (VENTAS)', 20, currentY + 5);
      doc.setFontSize(10);
      doc.text(`${salesData.length} registros`, 20, currentY + 11);

      // Card 2: Inputs
      doc.setFillColor(236, 253, 245); // light green
      doc.rect(15 + cardW + gap, currentY, cardW, cardH, 'F');
      doc.setTextColor(6, 95, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('ENTRADAS (COMPRAS)', 15 + cardW + gap + 5, currentY + 5);
      doc.setFontSize(10);
      doc.text(`${inputsData.length} registros`, 15 + cardW + gap + 5, currentY + 11);

      // Card 3: Unique items
      doc.setFillColor(250, 245, 255); // light purple
      doc.rect(15 + 2 * (cardW + gap), currentY, cardW, cardH, 'F');
      doc.setTextColor(107, 33, 168);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('INSUMOS AUDITADOS', 15 + 2 * (cardW + gap) + 5, currentY + 5);
      doc.setFontSize(10);
      doc.text(`${uniqueItemsAudited} ingredientes`, 15 + 2 * (cardW + gap) + 5, currentY + 11);

      // Card 4: Cost
      doc.setFillColor(255, 247, 237); // light orange
      doc.rect(15 + 3 * (cardW + gap), currentY, cardW, cardH, 'F');
      doc.setTextColor(154, 52, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('COSTO CONSUMOS', 15 + 3 * (cardW + gap) + 5, currentY + 5);
      doc.setFontSize(10);
      doc.text(`$${totalSalesCost.toFixed(2)}`, 15 + 3 * (cardW + gap) + 5, currentY + 11);

      currentY += cardH + 10;

      // --- SECTION 1.1: SALES COMMERCIAL DETAILS ---
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1.1. Ventas Registradas (Resumen Comercial)', 15, currentY);
      currentY += 4;

      const salesCommercialHeaders = [
        'Fecha',
        'Código Venta',
        'Producto / Receta',
        'Cant. Vendida',
        'Venta Neta',
        'Impuestos',
        'Venta Neta + Imp.',
        'Costo Último',
        '% Utilidad'
      ];

      const salesCommercialRows: any[] = [];
      uniqueSales.forEach((sale) => {
        const vn = getMetric(sale.sale_items, ['Venta Neta', 'venta_neta']);
        const imp = getMetric(sale.sale_items, ['Impuestos', 'impuestos']);
        const tot = getMetric(sale.sale_items, ['Venta Neta + Impuesto', 'venta_neta_mas_impuesto', 'Venta Neta + Impuestos']);
        const uc = getMetric(sale.sale_items, ['Ultimo Costo', 'ultimo_costo', 'Último Costo']);
        const uup = getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']);

        salesCommercialRows.push([
          formatDate(sale.movement_date),
          sale.sale_code,
          sale.recipe_name.toUpperCase(),
          `${sale.quantity} u`,
          `$${vn.toFixed(2)}`,
          `$${imp.toFixed(2)}`,
          `$${tot.toFixed(2)}`,
          `$${uc.toFixed(2)}`,
          `${uup.toFixed(1)}%`
        ]);

        if (sale.sale_items) {
          const desc = getMetric(sale.sale_items, ['Descuento']);
          const descP = getMetric(sale.sale_items, ['% Descuento']);
          const cantP = getMetric(sale.sale_items, ['% Cantidad']);
          const ventP = getMetric(sale.sale_items, ['% Ventas']);
          const ucp = getMetric(sale.sale_items, ['% Ultimo Costo', '% último costo']);
          const uu = getMetric(sale.sale_items, ['Utilidad Ultimo Costo', 'Utilidad Ultimo']);
          const cp = getMetric(sale.sale_items, ['Costo Promedio', 'costo_promedio']);
          const cpp = getMetric(sale.sale_items, ['% Costo Promedio']);
          const ucprom = getMetric(sale.sale_items, ['Utilidad Costo Promedio', 'Utilidad Costo']);
          const ucpp = getMetric(sale.sale_items, ['% Utilidad Costo Promedio', '% Utilidad Costo']);

          salesCommercialRows.push([
            {
              content: '',
              colSpan: 9,
              isCommercialDetail: true,
              sale: sale,
              styles: { minCellHeight: 54, fillColor: [255, 255, 255] }
            }
          ]);
        }
      });

      (doc as any).autoTable({
        startY: currentY,
        head: [salesCommercialHeaders],
        body: salesCommercialRows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: darkGray },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'right' },
          8: { halign: 'right', fontStyle: 'bold', textColor: [15, 118, 110] }
        },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 1.5 },
        didDrawCell: (data: any) => {
          if (data.cell.raw && data.cell.raw.isCommercialDetail) {
            const cellDoc = data.doc;
            const x = data.cell.x;
            const y = data.cell.y;
            const w = data.cell.width;
            const h = data.cell.height;

            // 1. Title at top
            cellDoc.setFillColor(100, 116, 139); // #64748b
            cellDoc.setFont('helvetica', 'bold');
            cellDoc.setFontSize(6.5);
            cellDoc.text('DETALLE COMERCIAL COMPLETO DE LA VENTA', x + 9, y + 6);

            // 2. Left emerald border strip
            cellDoc.setFillColor(16, 185, 129); // #10b981
            cellDoc.rect(x + 1, y + 10, 2.5, h - 14, 'F');

            // 3. Main white container rounded box
            cellDoc.setFillColor(255, 255, 255);
            cellDoc.setDrawColor(226, 232, 240); // #e2e8f0
            cellDoc.setLineWidth(0.4);
            cellDoc.roundedRect(x + 5, y + 10, w - 8, h - 14, 3, 3, 'FD');

            // 4. Draw 5 columns inside the white rounded box
            const colW = (w - 8 - 8 - 20) / 5;
            const colH = h - 18;
            const startX = x + 9;
            const startY = y + 13;

            const sale = data.cell.raw.sale;
            const vn = getMetric(sale.sale_items, ['Venta Neta', 'venta_neta']);
            const imp = getMetric(sale.sale_items, ['Impuestos', 'impuestos']);
            const tot = getMetric(sale.sale_items, ['Venta Neta + Impuesto', 'venta_neta_mas_impuesto', 'Venta Neta + Impuestos']);
            const desc = getMetric(sale.sale_items, ['Descuento']);
            const descP = getMetric(sale.sale_items, ['% Descuento']);
            const cantP = getMetric(sale.sale_items, ['% Cantidad']);
            const ventP = getMetric(sale.sale_items, ['% Ventas']);
            const uc = getMetric(sale.sale_items, ['Ultimo Costo', 'ultimo_costo', 'Último Costo']);
            const ucp = getMetric(sale.sale_items, ['% Ultimo Costo', '% último costo']);
            const uu = getMetric(sale.sale_items, ['Utilidad Ultimo Costo', 'Utilidad Ultimo']);
            const uup = getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']);
            const cp = getMetric(sale.sale_items, ['Costo Promedio', 'costo_promedio']);
            const cpp = getMetric(sale.sale_items, ['% Costo Promedio']);
            const ucprom = getMetric(sale.sale_items, ['Utilidad Costo Promedio', 'Utilidad Costo']);
            const ucpp = getMetric(sale.sale_items, ['% Utilidad Costo Promedio', '% Utilidad Costo']);

            for (let i = 0; i < 5; i++) {
              const cx = startX + i * (colW + 5);

              // Draw card background
              cellDoc.setFillColor(248, 250, 252); // #f8fafc
              cellDoc.setDrawColor(226, 232, 240);
              cellDoc.setLineWidth(0.2);
              cellDoc.roundedRect(cx, startY, colW, colH, 2, 2, 'FD');

              cellDoc.setTextColor(100, 116, 139); // #64748b
              cellDoc.setFont('helvetica', 'bold');
              cellDoc.setFontSize(5.5);

              if (i === 0) {
                cellDoc.text('VENTA COMERCIAL', cx + 3, startY + 4);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setTextColor(71, 85, 105);
                cellDoc.setFontSize(6.5);
                cellDoc.text('Venta Neta:', cx + 3, startY + 13);
                cellDoc.text('Impuestos:', cx + 3, startY + 21);
                cellDoc.setFont('helvetica', 'bold');
                cellDoc.text('Total:', cx + 3, startY + 29);

                cellDoc.text(`$${vn.toFixed(2)}`, cx + colW - 3, startY + 13, { align: 'right' });
                cellDoc.text(`$${imp.toFixed(2)}`, cx + colW - 3, startY + 21, { align: 'right' });
                cellDoc.text(`$${tot.toFixed(2)}`, cx + colW - 3, startY + 29, { align: 'right' });
              } else if (i === 1) {
                cellDoc.text('COSTO & UTIL. (ÚLT.)', cx + 3, startY + 4);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setTextColor(71, 85, 105);
                cellDoc.setFontSize(6.5);
                cellDoc.text('Costo:', cx + 3, startY + 13);
                cellDoc.text('Utilidad:', cx + 3, startY + 21);

                // Cost value & percentage
                cellDoc.setFont('helvetica', 'bold');
                cellDoc.text(`$${uc.toFixed(2)}`, cx + colW - 22, startY + 13, { align: 'right' });
                cellDoc.setTextColor(148, 163, 184); // light gray
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setFontSize(5.5);
                cellDoc.text(`(${ucp.toFixed(1)}%)`, cx + colW - 3, startY + 13.5, { align: 'right' });

                // Utility value & percentage
                cellDoc.setTextColor(16, 185, 129); // Emerald
                cellDoc.setFont('helvetica', 'bold');
                cellDoc.setFontSize(6.5);
                cellDoc.text(`$${uu.toFixed(2)}`, cx + colW - 22, startY + 21, { align: 'right' });
                cellDoc.setFontSize(5.5);
                cellDoc.text(`(${uup.toFixed(1)}%)`, cx + colW - 3, startY + 21.5, { align: 'right' });
              } else if (i === 2) {
                cellDoc.text('COSTO & UTIL. (PROM.)', cx + 3, startY + 4);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setTextColor(71, 85, 105);
                cellDoc.setFontSize(6.5);
                cellDoc.text('Costo:', cx + 3, startY + 13);
                cellDoc.text('Utilidad:', cx + 3, startY + 21);

                // Cost value & percentage
                cellDoc.setFont('helvetica', 'bold');
                cellDoc.text(`$${cp.toFixed(2)}`, cx + colW - 22, startY + 13, { align: 'right' });
                cellDoc.setTextColor(148, 163, 184);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setFontSize(5.5);
                cellDoc.text(`(${cpp.toFixed(1)}%)`, cx + colW - 3, startY + 13.5, { align: 'right' });

                // Utility value & percentage
                cellDoc.setTextColor(13, 148, 136); // Teal
                cellDoc.setFont('helvetica', 'bold');
                cellDoc.setFontSize(6.5);
                cellDoc.text(`$${ucprom.toFixed(2)}`, cx + colW - 22, startY + 21, { align: 'right' });
                cellDoc.setFontSize(5.5);
                cellDoc.text(`(${ucpp.toFixed(1)}%)`, cx + colW - 3, startY + 21.5, { align: 'right' });
              } else if (i === 3) {
                cellDoc.text('DESCUENTOS', cx + 3, startY + 4);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setTextColor(71, 85, 105);
                cellDoc.setFontSize(6.5);
                cellDoc.text('Valor:', cx + 3, startY + 13);
                cellDoc.text('Porcentaje:', cx + 3, startY + 21);

                cellDoc.setFont('helvetica', 'bold');
                cellDoc.text(`$${desc.toFixed(2)}`, cx + colW - 3, startY + 13, { align: 'right' });
                cellDoc.text(`${descP.toFixed(2)}%`, cx + colW - 3, startY + 21, { align: 'right' });
              } else if (i === 4) {
                cellDoc.text('PARTICIPACIÓN VENTAS', cx + 3, startY + 4);
                cellDoc.setFont('helvetica', 'normal');
                cellDoc.setTextColor(71, 85, 105);
                cellDoc.setFontSize(6.5);
                cellDoc.text('% Cantidad:', cx + 3, startY + 13);
                cellDoc.text('% Ventas:', cx + 3, startY + 21);

                cellDoc.setFont('helvetica', 'bold');
                cellDoc.text(`${cantP.toFixed(2)}%`, cx + colW - 3, startY + 13, { align: 'right' });
                cellDoc.text(`${ventP.toFixed(2)}%`, cx + colW - 3, startY + 21, { align: 'right' });
              }
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      // --- SECTION 1.2: AFFECTED INGREDIENTS DETAILS ---
      if (currentY > 175) {
        doc.addPage();
        currentY = drawHeader(doc.getNumberOfPages());
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1.2. Insumos Afectados (Detalle de Salidas de Stock)', 15, currentY);
      currentY += 4;

      const salesIngredientsHeaders = [
        'Fecha',
        'Código Venta',
        'Insumo',
        'Consumido',
        'Unidad',
        'Inv. Inicial',
        'Inv. Final',
        'Receta de Origen',
        'Costo Unit.',
        'Total'
      ];

      const salesIngredientsRows = salesData.map((s) => [
        formatDate(s.movement_date),
        s.sale_code || 'Directo',
        s.inventory_name.toUpperCase(),
        `-${Number(s.quantity).toFixed(3)}`,
        s.uom.toUpperCase(),
        Number(s.previous_stock).toFixed(2),
        Number(s.current_stock).toFixed(2),
        s.recipe_name ? s.recipe_name.toUpperCase() : 'Consumo Directo',
        `$${Number(s.unit_cost).toFixed(2)}`,
        `$${Number(s.total_cost).toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: currentY,
        head: [salesIngredientsHeaders],
        body: salesIngredientsRows,
        theme: 'striped',
        headStyles: { fillColor: [100, 116, 139], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: darkGray },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 1.5 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // --- SECTION 2: SUPPLY INPUTS TABLE ---
      if (currentY > 175) {
        doc.addPage();
        currentY = drawHeader(doc.getNumberOfPages());
      }

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('2. Entradas de Abastecimiento', 15, currentY);
      currentY += 4;

      const inputsHeaders = [
        'Fecha',
        'Código',
        'Insumo',
        'Recibido',
        'Unidad',
        'Inv. Inicial',
        'Inv. Final',
        'Orden Compra',
        'Proveedor',
        'Costo Unit.',
        'Total'
      ];

      const inputsRows = inputsData.length === 0
        ? [
          [
            {
              content: 'No se registran entradas de abastecimiento ni ingresos de insumos al almacén central en el periodo especificado.',
              colSpan: 11,
              styles: { halign: 'center', fontSize: 7.5, fontStyle: 'italic', textColor: [100, 116, 139], cellPadding: 8 }
            }
          ]
        ]
        : inputsData.map((i) => [
          formatDate(i.movement_date),
          i.inventory_sku,
          i.inventory_name.toUpperCase(),
          `+${Number(i.quantity).toFixed(3)}`,
          i.uom.toUpperCase(),
          Number(i.previous_stock).toFixed(2),
          Number(i.current_stock).toFixed(2),
          i.po_number || 'Directo',
          i.supplier_name || 'Casita',
          `$${Number(i.unit_cost).toFixed(2)}`,
          `$${Number(i.total_cost).toFixed(2)}`
        ]);

      (doc as any).autoTable({
        startY: currentY,
        head: [inputsHeaders],
        body: inputsRows,
        theme: 'striped',
        headStyles: { fillColor: secondaryColor, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: darkGray },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          9: { halign: 'right' },
          10: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 1.5 }
      });



      // --- PAGE FOOTERS GENERATOR ---
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Draw elegant thin grey footer line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.line(15, 199, 282, 199);

        // Footer Metadata Text
        doc.setFontSize(7.2);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte de Auditoría de Inventario y Movimientos de Stock • ERP Restaurant', 15, 203);
        doc.text(`Página ${i} de ${totalPages}`, 282, 203, { align: 'right' });
      }

      // Download PDF directly from browser
      doc.save(`MOVIMIENTO_INVENTARIO_${startDate || 'abierto'}_${endDate || 'abierto'}.pdf`);
    } catch (err) {
      console.error('Error generating jsPDF report:', err);
      alert('Hubo un error al generar el PDF de auditoría.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadExcel = () => {
    const aoa: any[][] = [];
    const merges: any[] = [];

    const pushRow = (row: any[]) => {
      aoa.push(row);
      return aoa.length - 1;
    };

    // --- REPORT HEADER ---
    const r0 = pushRow(['REPORTE DE AUDITORÍA DE INVENTARIO Y MOVIMIENTOS DE STOCK']);
    merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: 8 } });

    const r1 = pushRow([`Periodo de Consulta: desde [ ${startDate || 'Inicio'} ] hasta [ ${endDate || 'Final'} ]`]);
    merges.push({ s: { r: r1, c: 0 }, e: { r: r1, c: 8 } });

    const r2 = pushRow([`Generado el: ${new Date().toLocaleString()} - Sistema de Alertas ERP`]);
    merges.push({ s: { r: r2, c: 0 }, e: { r: r2, c: 8 } });

    pushRow([]); // Spacing

    // --- BENTO KPI CARDS ---
    const rKpiHeader = pushRow(['RESUMEN DE MÉTRICAS (KPIs) DE AUDITORÍA']);
    merges.push({ s: { r: rKpiHeader, c: 0 }, e: { r: rKpiHeader, c: 7 } });

    pushRow([
      'VENTAS REGISTRADAS', salesData.length, '',
      'ENTRADAS COMPRAS', inputsData.length, '',
      'INSUMOS AUDITADOS', uniqueItemsAudited
    ]);
    pushRow([
      'COSTO TOTAL CONSUMO', `$${totalSalesCost.toFixed(2)}`, '',
      'COSTO TOTAL ENTRADAS', `$${totalInputsCost.toFixed(2)}`
    ]);

    pushRow([]); // Spacing
    pushRow([]); // Spacing

    // --- SECTION 1.1: SALES COMMERCIAL (RESUMEN COMERCIAL) ---
    const rSec11 = pushRow(['1.1. VENTAS REGISTRADAS (RESUMEN COMERCIAL)']);
    merges.push({ s: { r: rSec11, c: 0 }, e: { r: rSec11, c: 8 } });

    pushRow([
      'Fecha',
      'Código Venta',
      'Producto / Receta',
      'Cant. Vendida',
      'Venta Neta',
      'Impuestos',
      'Total Venta (Neta + Imp)',
      'Costo Último',
      '% Utilidad (Último)'
    ]);

    if (uniqueSales.length === 0) {
      const rNoSales = pushRow(['No se registran transacciones de venta comercial en el periodo especificado.']);
      merges.push({ s: { r: rNoSales, c: 0 }, e: { r: rNoSales, c: 8 } });
    } else {
      uniqueSales.forEach((sale) => {
        const vn = getMetric(sale.sale_items, ['Venta Neta', 'venta_neta']);
        const imp = getMetric(sale.sale_items, ['Impuestos', 'impuestos']);
        const tot = getMetric(sale.sale_items, ['Venta Neta + Impuesto', 'venta_neta_mas_impuesto', 'Venta Neta + Impuestos']);
        const uc = getMetric(sale.sale_items, ['Ultimo Costo', 'ultimo_costo', 'Último Costo']);
        const uup = getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']);

        // Main Row
        pushRow([
          formatDate(sale.movement_date),
          sale.sale_code,
          sale.recipe_name.toUpperCase(),
          `${sale.quantity} u`,
          vn,
          imp,
          tot,
          uc,
          uup / 100
        ]);

        // Detailed block mimicking the card grid layout in the PDF
        if (sale.sale_items) {
          const desc = getMetric(sale.sale_items, ['Descuento']);
          const descP = getMetric(sale.sale_items, ['% Descuento']);
          const cantP = getMetric(sale.sale_items, ['% Cantidad']);
          const ventP = getMetric(sale.sale_items, ['% Ventas']);
          const ucp = getMetric(sale.sale_items, ['% Ultimo Costo', '% último costo']);
          const uu = getMetric(sale.sale_items, ['Utilidad Ultimo Costo', 'Utilidad Ultimo']);
          const cp = getMetric(sale.sale_items, ['Costo Promedio', 'costo_promedio']);
          const cpp = getMetric(sale.sale_items, ['% Costo Promedio']);
          const ucprom = getMetric(sale.sale_items, ['Utilidad Costo Promedio', 'Utilidad Costo']);
          const ucpp = getMetric(sale.sale_items, ['% Utilidad Costo Promedio', '% Utilidad Costo']);

          pushRow([
            '   ↳ DETALLE COMERCIAL:',
            'VENTA COMERCIAL',
            'COSTO & UTIL. (ÚLT.)',
            'COSTO & UTIL. (PROM.)',
            'DESCUENTOS',
            'PARTICIPACIÓN VENTAS'
          ]);

          pushRow([
            '',
            `Venta Neta: $${vn.toFixed(2)}`,
            `Costo: $${uc.toFixed(2)} (${ucp.toFixed(1)}%)`,
            `Costo: $${cp.toFixed(2)} (${cpp.toFixed(1)}%)`,
            `Valor: $${desc.toFixed(2)}`,
            `% Cantidad: ${cantP.toFixed(2)}%`
          ]);

          pushRow([
            '',
            `Impuestos: $${imp.toFixed(2)}`,
            `Utilidad: $${uu.toFixed(2)} (${uup.toFixed(1)}%)`,
            `Utilidad: $${ucprom.toFixed(2)} (${ucpp.toFixed(1)}%)`,
            `Porcentaje: ${descP.toFixed(2)}%`,
            `% Ventas: ${ventP.toFixed(2)}%`
          ]);

          pushRow([
            '',
            `Total: $${tot.toFixed(2)}`
          ]);

          pushRow([]); // White spacing between items
        }
      });
    }

    pushRow([]); // Spacing
    pushRow([]); // Spacing

    // --- SECTION 1.2: AFFECTED INGREDIENTS (SALIDAS DE STOCK) ---
    const rSec12 = pushRow(['1.2. INSUMOS AFECTADOS POR VENTAS (DETALLE DE SALIDAS DE STOCK)']);
    merges.push({ s: { r: rSec12, c: 0 }, e: { r: rSec12, c: 10 } });

    pushRow([
      'Fecha',
      'Código Venta',
      'SKU',
      'Insumo',
      'Consumido',
      'Unidad',
      'Inv. Inicial',
      'Inv. Final',
      'Receta de Origen',
      'Costo Unit.',
      'Costo Total'
    ]);

    if (salesData.length === 0) {
      const rNoIngs = pushRow(['No se encontraron registros de salidas de insumos para el rango seleccionado.']);
      merges.push({ s: { r: rNoIngs, c: 0 }, e: { r: rNoIngs, c: 10 } });
    } else {
      salesData.forEach((s) => {
        pushRow([
          formatDate(s.movement_date),
          s.sale_code || 'Directo',
          s.inventory_sku,
          s.inventory_name.toUpperCase(),
          -Number(s.quantity),
          s.uom.toUpperCase(),
          Number(s.previous_stock),
          Number(s.current_stock),
          s.recipe_name ? s.recipe_name.toUpperCase() : 'CONSUMO DIRECTO',
          Number(s.unit_cost),
          Number(s.total_cost)
        ]);
      });
    }

    pushRow([]); // Spacing
    pushRow([]); // Spacing

    // --- SECTION 2: SUPPLY INPUTS (ENTRADAS DE ABASTECIMIENTO) ---
    const rSec2 = pushRow(['2. ENTRADAS DE INSUMOS DE ABASTECIMIENTO']);
    merges.push({ s: { r: rSec2, c: 0 }, e: { r: rSec2, c: 11 } });

    pushRow([
      'Fecha',
      'SKU',
      'Insumo',
      'Cantidad Recibida',
      'Unidad',
      'Stock Anterior',
      'Stock Nuevo',
      'Almacén Destino',
      'Orden de Compra',
      'Proveedor',
      'Costo Unit.',
      'Costo Total'
    ]);

    if (inputsData.length === 0) {
      const rNoInputs = pushRow(['No se registran entradas de abastecimiento ni ingresos de insumos al almacén central en el periodo especificado.']);
      merges.push({ s: { r: rNoInputs, c: 0 }, e: { r: rNoInputs, c: 11 } });
    } else {
      inputsData.forEach((i) => {
        pushRow([
          formatDate(i.movement_date),
          i.inventory_sku,
          i.inventory_name.toUpperCase(),
          Number(i.quantity),
          i.uom.toUpperCase(),
          Number(i.previous_stock),
          Number(i.current_stock),
          i.warehouse_name,
          i.po_number || 'Directo',
          i.supplier_name || 'N/A',
          Number(i.unit_cost),
          Number(i.total_cost)
        ]);
      });
    }

    // Generate Sheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply merges
    ws['!merges'] = merges;

    // Apply column widths to prevent clipping
    ws['!cols'] = [
      { wch: 16 }, // Fecha / Detalle Comercial label
      { wch: 22 }, // Código Venta / Venta Comercial card
      { wch: 28 }, // Insumo / Costo Último card
      { wch: 28 }, // Cantidad / Costo Promedio card
      { wch: 22 }, // Venta Neta / Descuentos card
      { wch: 22 }, // Impuestos / Participación Ventas card
      { wch: 18 }, // Total Venta
      { wch: 18 }, // Costo
      { wch: 15 }, // % Utilidad
      { wch: 15 }, // Unit Cost
      { wch: 15 }  // Total Cost
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Auditoría');

    // Save
    XLSX.writeFile(wb, `MOVIMIENTO_INVENTARIO_${startDate || 'abierto'}_a_${endDate || 'abierto'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Controles de Rango y Descarga */}
      <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-primary-600" />
              PANEL DE CONSULTA DE AUDITORÍA
            </h2>
            <p className="text-[11px] text-slate-500">
              Auditoría en tiempo real del almacén central, conciliando salidas por ventas y entradas por órdenes de compra.
            </p>
          </div>

          {/* Selectores de fecha */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar
                className="w-4 h-4 text-slate-400 cursor-pointer hover:text-primary-600 transition-colors"
                onClick={() => startInputRef.current?.showPicker?.()}
              />
              <input
                ref={startInputRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                placeholder="Fecha Inicio"
              />
              <span className="text-slate-350 text-xs font-bold">a</span>
              <input
                ref={endInputRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                placeholder="Fecha Fin"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold font-mono ml-1 px-1 cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            <button
              onClick={fetchAuditData}
              disabled={isLoading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition cursor-pointer text-slate-650 disabled:opacity-50 shrink-0"
              title="Actualizar Datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <div className="relative shrink-0 z-20">
              <button
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                disabled={isDownloading || (salesData.length === 0 && inputsData.length === 0)}
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    Descargar
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </>
                )}
              </button>

              <AnimatePresence>
                {downloadMenuOpen && (
                  <>
                    {/* Backdrop transparent to close when clicking outside */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDownloadMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-150 rounded-xl shadow-lg z-20 overflow-hidden text-xs text-slate-750 font-medium"
                    >
                      <button
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          handleDownloadPdf();
                        }}
                        className="w-full text-left py-2.5 px-4 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-red-500" />
                        Reporte en PDF
                      </button>
                      <button
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          handleDownloadExcel();
                        }}
                        className="w-full text-left py-2.5 px-4 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer transition-colors"
                      >
                        <Package className="w-3.5 h-3.5 text-emerald-600" />
                        Reporte en Excel
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid de KPIs de Auditoría */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Salidas Totales */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">Registros de Salida (Venta)</span>
            <p className="text-xl font-black text-slate-850 font-display">{salesData.length}</p>
            <span className="text-[9px] text-blue-500/80 font-medium">Salidas registradas en rango</span>
          </div>
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Entradas Totales */}
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Entradas de Insumo</span>
            <p className="text-xl font-black text-slate-850 font-display">{inputsData.length}</p>
            <span className="text-[9px] text-emerald-500/80 font-medium">Abastecimientos centralizados</span>
          </div>
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Insumos Únicos Auditados */}
        <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Insumos Auditados</span>
            <p className="text-xl font-black text-slate-850 font-display">{uniqueItemsAudited}</p>
            <span className="text-[9px] text-purple-500/80 font-medium">Ingredientes únicos auditados</span>
          </div>
          <div className="p-3 bg-purple-100 rounded-xl text-purple-600 shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Costo Consumos */}
        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">Costo Neto de Salidas</span>
            <p className="text-xl font-black text-slate-850 font-display">${totalSalesCost.toFixed(2)}</p>
            <span className="text-[9px] text-rose-500/80 font-medium">Valor total consumido</span>
          </div>
          <div className="p-3 bg-rose-100 rounded-xl text-rose-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs para visualizar la consulta */}
      <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
        {/* Encabezado e interruptor de tabla */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
          <h3 className="text-sm font-display font-bold text-slate-850">
            {activeSection === 'sales' && 'SALIDAS POR CONCEPTOS DE VENTAS'}
            {activeSection === 'inputs' && 'ENTRADAS DE INSUMOS DE ABASTECIMIENTO'}
            {activeSection === 'balance' && 'BALANCE CONSOLIDADO Y RECONCILIACIÓN NETO'}
          </h3>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto shadow-inner border border-slate-200">
            <button
              onClick={() => setActiveSection('sales')}
              className={`text-[10px] uppercase font-mono font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${activeSection === 'sales' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Salidas Ventas
            </button>
            <button
              onClick={() => setActiveSection('inputs')}
              className={`text-[10px] uppercase font-mono font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${activeSection === 'inputs' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Entradas Central
            </button>
            <button
              hidden
              onClick={() => setActiveSection('balance')}
              className={`text-[10px] uppercase font-mono font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${activeSection === 'balance' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Balance Neto
            </button>
          </div>
        </div>

        {/* Tablas de consulta */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
            <span className="text-xs font-semibold">Consultando base de datos de movimientos...</span>
          </div>
        ) : activeSection === 'sales' ? (
          /* TABLA DE SALIDAS (VENTAS) */
          <div className="space-y-6">
            {/* 1. Detallado Comercial de Ventas */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-500" />
                1.1. Detallado Comercial de Ventas (Renglón Único)
              </h4>
              <div className="overflow-x-auto">
                {uniqueSales.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No hay ventas registradas en el rango especificado.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-150">
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Código Venta</th>
                        <th className="py-2.5 px-4">Producto / Receta</th>
                        <th className="py-2.5 px-4 text-right">Platos Vendidos</th>
                        <th className="py-2.5 px-4 text-right">Venta Neta</th>
                        <th className="py-2.5 px-4 text-right">Impuestos</th>
                        <th className="py-2.5 px-4 text-right">Venta Neta + Imp.</th>
                        <th className="py-2.5 px-4 text-right">Costo Último</th>
                        <th className="py-2.5 px-4 text-right">% Utilidad</th>
                        <th className="py-2.5 px-4 text-center">Trazabilidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {uniqueSales.map((sale) => {
                        const isExpanded = !!expandedSales[sale.sale_code];
                        const vn = getMetric(sale.sale_items, ['Venta Neta', 'venta_neta']);
                        const imp = getMetric(sale.sale_items, ['Impuestos', 'impuestos']);
                        const tot = getMetric(sale.sale_items, ['Venta Neta + Impuesto', 'venta_neta_mas_impuesto', 'Venta Neta + Impuestos']);
                        const uc = getMetric(sale.sale_items, ['Ultimo Costo', 'ultimo_costo', 'Último Costo']);
                        const uup = getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']);
                        return (
                          <React.Fragment key={sale.sale_code}>
                            <tr className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-slate-500">{formatDate(sale.movement_date)}</td>
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{sale.sale_code}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-700">{sale.recipe_name}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold">{sale.quantity}</td>
                              <td className="py-2.5 px-4 text-right font-mono">${vn.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-mono text-slate-500">${imp.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${tot.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-mono text-slate-600">${uc.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">{uup.toFixed(1)}%</td>
                              <td className="py-2.5 px-4 text-center">
                                {sale.sale_items ? (
                                  <button
                                    onClick={() => toggleSale(sale.sale_code)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg font-semibold cursor-pointer border border-slate-200 text-[10px]"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    Ver
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">No disponible</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && sale.sale_items && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={10} className="p-4 border-l-4 border-emerald-500">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-450 uppercase">
                                      <ShoppingCart className="w-4 h-4 text-emerald-500" />
                                      Detalle Comercial Completo de la Venta
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 bg-white p-4 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                        <span className="text-slate-400 block font-bold mb-1 uppercase text-[9px] tracking-wider text-slate-400">Venta Comercial</span>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-slate-500">Venta Neta:</span> <span className="font-bold text-slate-800">${vn.toFixed(2)}</span></div>
                                          <div className="flex justify-between"><span className="text-slate-500">Impuestos:</span> <span className="font-semibold text-slate-700">${imp.toFixed(2)}</span></div>
                                          <div className="flex justify-between border-t border-slate-100 pt-1 mt-1 font-bold text-slate-900"><span className="text-slate-650">Total:</span> <span>${tot.toFixed(2)}</span></div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                        <span className="text-slate-400 block font-bold mb-1 uppercase text-[9px] tracking-wider text-slate-400">Costo & Utilidad (Último)</span>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-slate-500">Costo:</span> <span className="font-bold text-slate-800">${uc.toFixed(2)} <span className="text-[9px] text-slate-400 font-normal">({getMetric(sale.sale_items, ['% Ultimo Costo', '% último costo']).toFixed(1)}%)</span></span></div>
                                          <div className="flex justify-between"><span className="text-slate-500">Utilidad:</span> <span className="font-bold text-emerald-600">${getMetric(sale.sale_items, ['Utilidad Ultimo Costo', 'Utilidad Ultimo']).toFixed(2)} <span className="text-[9px] text-emerald-500 font-normal">({getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']).toFixed(1)}%)</span></span></div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                        <span className="text-slate-400 block font-bold mb-1 uppercase text-[9px] tracking-wider text-slate-400">Costo & Utilidad (Promedio)</span>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-slate-500">Costo:</span> <span className="font-bold text-slate-800">${getMetric(sale.sale_items, ['Costo Promedio', 'costo_promedio']).toFixed(2)} <span className="text-[9px] text-slate-400 font-normal">({getMetric(sale.sale_items, ['% Costo Promedio']).toFixed(1)}%)</span></span></div>
                                          <div className="flex justify-between"><span className="text-slate-500">Utilidad:</span> <span className="font-bold text-teal-600">${getMetric(sale.sale_items, ['Utilidad Costo Promedio', 'Utilidad Costo']).toFixed(2)} <span className="text-[9px] text-teal-500 font-normal">({getMetric(sale.sale_items, ['% Utilidad Costo Promedio', '% Utilidad Costo']).toFixed(1)}%)</span></span></div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                        <span className="text-slate-400 block font-bold mb-1 uppercase text-[9px] tracking-wider text-slate-400">Descuentos</span>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-slate-500">Valor:</span> <span className="font-bold text-slate-800">${getMetric(sale.sale_items, ['Descuento']).toFixed(2)}</span></div>
                                          <div className="flex justify-between"><span className="text-slate-500">Porcentaje:</span> <span className="font-semibold text-slate-700">{getMetric(sale.sale_items, ['% Descuento']).toFixed(2)}%</span></div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                        <span className="text-slate-400 block font-bold mb-1 uppercase text-[9px] tracking-wider text-slate-400">Participación Ventas</span>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-slate-500">% Cantidad:</span> <span className="font-bold text-slate-800">{getMetric(sale.sale_items, ['% Cantidad']).toFixed(2)}%</span></div>
                                          <div className="flex justify-between"><span className="text-slate-500">% Ventas:</span> <span className="font-bold text-slate-800">{getMetric(sale.sale_items, ['% Ventas']).toFixed(2)}%</span></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* 2. Insumos Afectados */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-rose-500" />
                1.2. Insumos Afectados (Detalle de Salidas de Stock)
              </h4>
              <div className="overflow-x-auto">
                {salesData.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs italic flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    No se encontraron salidas por ventas en el rango especificado.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-150">
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Insumo</th>
                        <th className="py-2.5 px-4 text-right">Cant. Consumida</th>
                        <th className="py-2.5 px-4 text-center">Inicial → Final</th>
                        <th className="py-2.5 px-4">Receta de Origen</th>
                        <th className="py-2.5 px-4 text-right">Costo Total</th>
                        <th className="py-2.5 px-4 text-center">Trazabilidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {salesData.map((row) => {
                        const isExpanded = !!expandedRows[row.history_id];
                        return (
                          <React.Fragment key={row.history_id}>
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                                {formatDate(row.movement_date)}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-semibold text-slate-800 block leading-tight">{row.inventory_name}</span>
                                <span className="font-mono text-[9px] text-slate-400">{row.inventory_sku}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                -{Number(row.quantity).toFixed(3)} {row.uom}
                              </td>
                              <td className="py-2.5 px-4 text-center font-mono font-semibold whitespace-nowrap">
                                <span className="text-slate-400">{Number(row.previous_stock).toFixed(2)}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-350 inline mx-1.5" />
                                <span className="text-slate-700 font-bold">{Number(row.current_stock).toFixed(2)}</span>
                              </td>
                              <td className="py-2.5 px-4">
                                {row.recipe_name ? (
                                  <div className="space-y-0.5">
                                    <span className="font-medium text-slate-850 block">{row.recipe_name}</span>
                                    <span className="font-mono text-[9px] bg-slate-100 border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded-lg">
                                      {row.sale_code || 'Venta'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Descuento Directo</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                ${Number(row.total_cost).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {row.movement_item_detail ? (
                                  <button
                                    onClick={() => toggleRow(row.history_id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg font-semibold cursor-pointer border border-slate-200"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    Ver
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">No disponible</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && row.movement_item_detail && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={7} className="p-4 border-l-4 border-primary-500">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-450 uppercase">
                                      <Info className="w-4 h-4 text-primary-500" />
                                      Trazabilidad de Descomp. de Receta
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3.5 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                      <div>
                                        <span className="text-slate-400 block font-medium">Nombre de Insumo</span>
                                        <span className="font-bold text-slate-800">{row.movement_item_detail.name}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block font-medium">Cantidad Consumida</span>
                                        <span className="font-bold text-rose-600 font-mono">
                                          {row.movement_item_detail.consumed_quantity} {row.movement_item_detail.uom}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block font-medium">Stock</span>
                                        <span className="font-bold text-slate-700 font-mono">
                                          Inicial: {row.movement_item_detail.previous_stock} | Final: {row.movement_item_detail.current_stock}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : activeSection === 'inputs' ? (
          /* TABLA DE ENTRADAS (ABASTECIMIENTO ALMACÉN CENTRAL) */
          <div className="overflow-x-auto">
            {inputsData.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs italic flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                No se encontraron entradas de insumos en el rango especificado.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-150">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4 text-right">Cant. Ingresada</th>
                    <th className="py-3 px-4 text-center">Stock Prev → Act</th>
                    <th className="py-3 px-4">Almacén Destino</th>
                    <th className="py-3 px-4">Orden de Compra / Proveedor</th>
                    <th className="py-3 px-4 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {inputsData.map((row) => (
                    <tr key={row.history_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                        {formatDate(row.movement_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block leading-tight">{row.inventory_name}</span>
                        <span className="font-mono text-[9px] text-slate-400">{row.inventory_sku}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                        +{Number(row.quantity).toFixed(3)} {row.uom}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold whitespace-nowrap">
                        <span className="text-slate-400">{Number(row.previous_stock).toFixed(2)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-350 inline mx-1.5" />
                        <span className="text-slate-700 font-bold">{Number(row.current_stock).toFixed(2)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-full font-semibold text-[10px]">
                          {row.warehouse_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {row.po_number ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block font-mono text-[11px]">{row.po_number}</span>
                            <span className="text-slate-500 text-[10px] block truncate max-w-[150px]">
                              {row.supplier_name || 'Proveedor Directo'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Abastecimiento Directo</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        ${Number(row.total_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* TABLA DE BALANCE CONSOLIDADO POR INSUMO */
          <div className="overflow-x-auto">
            {consolidatedBalance.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs italic flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                No hay movimientos para consolidar en este rango.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-150">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4 text-right">Total Consumo (-)</th>
                    <th className="py-3 px-4 text-right">Total Ingreso (+)</th>
                    <th className="py-3 px-4 text-center">Variación Neta</th>
                    <th className="py-3 px-4 text-right">Costo Consumo</th>
                    <th className="py-3 px-4 text-right">Valor Ingreso</th>
                    <th className="py-3 px-4 text-right">Variación Valorizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {consolidatedBalance.map((row) => {
                    const netQty = row.replenished - row.consumed;
                    const netValue = row.replenishedCost - row.consumedCost;
                    return (
                      <tr key={row.inventory_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 block leading-tight">{row.name}</span>
                          <span className="font-mono text-[9px] text-slate-400">{row.sku}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 whitespace-nowrap">
                          {row.consumed > 0 ? `-${row.consumed.toFixed(3)} ${row.uom}` : `0 ${row.uom}`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 whitespace-nowrap">
                          {row.replenished > 0 ? `+${row.replenished.toFixed(3)} ${row.uom}` : `0 ${row.uom}`}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold whitespace-nowrap">
                          {netQty > 0 ? (
                            <span className="text-emerald-600">+{netQty.toFixed(3)} {row.uom}</span>
                          ) : netQty < 0 ? (
                            <span className="text-rose-600">{netQty.toFixed(3)} {row.uom}</span>
                          ) : (
                            <span className="text-slate-400">0.000 {row.uom}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                          ${row.consumedCost.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                          ${row.replenishedCost.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {netValue > 0 ? (
                            <span className="text-emerald-600">+{netValue.toFixed(2)}</span>
                          ) : netValue < 0 ? (
                            <span className="text-rose-600">-${Math.abs(netValue).toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">$0.00</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
