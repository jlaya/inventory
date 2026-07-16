import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface AuditRowSale {
  history_id: string;
  movement_date: string;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  unit_cost: number;
  total_cost: number;
  notes: string;
  inventory_id: number;
  inventory_name: string;
  inventory_sku: string;
  uom: string;
  warehouse_name: string;
  sale_code: string;
  sale_recipe_quantity: number;
  recipe_name: string;
  recipe_code: string;
  sale_items?: Record<string, any>;
  movement_item_detail?: {
    uom?: string;
    name?: string;
    inventory_id?: number;
    current_stock?: number;
    previous_stock?: number;
    consumed_quantity?: number;
  };
}

export interface AuditRowInput {
  history_id: string;
  movement_date: string;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  unit_cost: number;
  total_cost: number;
  notes: string;
  reference_type: string;
  reference_id: string;
  inventory_name: string;
  inventory_sku: string;
  uom: string;
  warehouse_name: string;
  po_number: string;
  supplier_name: string;
}

export function generateAuditPdfReport(
  res: Response,
  sales: AuditRowSale[],
  inputs: AuditRowInput[],
  startDate?: string,
  endDate?: string,
) {
  const doc = new PDFDocument({
    margin: 35,
    size: 'A4',
    bufferPages: true, // Habilita la numeración dinámica al final
  });

  // Pipe directly to the response stream
  doc.pipe(res);

  // --- GENERAL CONFIG ---
  const primaryColor = '#0f172a'; // Navy/Slate Oscuro
  const secondaryColor = '#0f766e'; // Teal/Esmeralda
  const accentColor = '#3b82f6'; // Azul
  const darkGray = '#334155'; // Charcoal
  const lightGray = '#f8fafc'; // Off-White
  const borderGray = '#cbd5e1'; // Gris para bordes

  // --- PAGE HEADER DRAWING ---
  const drawPageHeader = (pageNumber: number) => {
    // Si es la primera página, dibuja el gran banner superior corporativo
    if (pageNumber === 1) {
      doc.rect(35, 35, 525, 60).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text('ERP RESTAURANT - AUDITORÍA GENERAL DE INVENTARIO', 48, 48);
      doc.fontSize(8).font('Helvetica').text('REPORTE Y TRAZABILIDAD DE MOVIMIENTOS - FORMATO COMPLETO PARA ANALISTAS DE DATOS', 48, 65);
      doc.fillColor('#94a3b8').fontSize(7).text(`FECHA DE EMISIÓN: ${new Date().toLocaleString()}`, 48, 77);

      // Bloque de parámetros
      doc.rect(35, 105, 525, 45).fill(lightGray);
      doc.fillColor(darkGray).fontSize(8).font('Helvetica-Bold').text('PARÁMETROS DEL REPORTE:', 45, 112);
      doc.font('Helvetica').fontSize(8).text(`Rango de fecha: ${startDate || 'Abierto / Historial Completo'} - ${endDate || 'Abierto / Historial Completo'}`, 45, 125);
      doc.text(`Almacén evaluado: WH-CENTRAL (Almacén Central y Estaciones Relacionadas)`, 45, 135);
      doc.text(`Estatus del Reporte: LISTO PARA AUDITORÍA`, 320, 125);
      doc.text(`Formato: Estructura de Última Gama (Auditoría Corporativa)`, 320, 135);
      return 165; // Retorna la altura que ocupa el encabezado inicial
    } else {
      // Cabecera simplificada para páginas siguientes
      doc.rect(35, 35, 525, 25).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text('ERP RESTAURANT • REPORTE CONTINUO DE AUDITORÍA', 45, 43);
      doc.fillColor('#94a3b8').fontSize(7).text(`EMISIÓN: ${new Date().toLocaleDateString()}`, 450, 43);
      return 70;
    }
  };

  // --- DIBUJAR KPIs ---
  const salesCount = sales.length;
  const inputsCount = inputs.length;
  const totalSalesVal = sales.reduce((acc, curr) => acc + Number(curr.total_cost), 0);
  const totalInputsVal = inputs.reduce((acc, curr) => acc + Number(curr.total_cost), 0);

  let currentY = drawPageHeader(1);

  // Dibuja 3 bloques Bento de KPIs
  const cardWidth = 165;
  const cardHeight = 45;
  const gap = 15;

  // Tarjeta 1: Salidas por Ventas
  doc.rect(35, currentY, cardWidth, cardHeight).fill('#eff6ff');
  doc.fillColor('#1e40af').fontSize(7).font('Helvetica-Bold').text('SALIDAS POR VENTAS (AUDITADAS)', 45, currentY + 10);
  doc.fontSize(11).text(`${salesCount} registros`, 45, currentY + 22);

  // Tarjeta 2: Entradas
  doc.rect(35 + cardWidth + gap, currentY, cardWidth, cardHeight).fill('#ecfdf5');
  doc.fillColor('#065f46').fontSize(7).font('Helvetica-Bold').text('ENTRADAS A ALMACÉN CENTRAL', 35 + cardWidth + gap + 10, currentY + 10);
  doc.fontSize(11).text(`${inputsCount} registros`, 35 + cardWidth + gap + 10, currentY + 22);

  // Tarjeta 3: Costo de Insumos
  doc.rect(35 + 2 * (cardWidth + gap), currentY, cardWidth, cardHeight).fill('#faf5ff');
  doc.fillColor('#6b21a8').fontSize(7).font('Helvetica-Bold').text('VALOR DE ABASTECIMIENTO NETO', 35 + 2 * (cardWidth + gap) + 10, currentY + 10);
  doc.fontSize(11).text(`$${totalInputsVal.toFixed(2)}`, 35 + 2 * (cardWidth + gap) + 10, currentY + 22);

  currentY += cardHeight + 20;

  // --- SECCIÓN 1.1: VENTAS REGISTRADAS (RESUMEN COMERCIAL) ---
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('1.1. VENTAS REGISTRADAS (RESUMEN COMERCIAL)', 35, currentY);
  currentY += 15;

  const uniqueSalesMap = new Map<string, any>();
  sales.forEach((s) => {
    if (s.sale_code && !uniqueSalesMap.has(s.sale_code)) {
      uniqueSalesMap.set(s.sale_code, {
        sale_code: s.sale_code,
        movement_date: s.movement_date,
        recipe_name: s.recipe_name || 'Descuento Directo',
        quantity: Number(s.sale_recipe_quantity || s.quantity),
        sale_items: s.sale_items,
      });
    }
  });
  const uniqueSales = Array.from(uniqueSalesMap.values());

  const colSalesCommercial = [
    { name: 'Fecha', x: 35, w: 50 },
    { name: 'Código Venta', x: 85, w: 80 },
    { name: 'Producto / Receta', x: 165, w: 135 },
    { name: 'Cant.', x: 300, w: 35, align: 'right' },
    { name: 'Venta Neta', x: 335, w: 50, align: 'right' },
    { name: 'Impuestos', x: 385, w: 45, align: 'right' },
    { name: 'Total', x: 430, w: 50, align: 'right' },
    { name: 'Costo', x: 480, w: 45, align: 'right' },
    { name: '% Util.', x: 525, w: 35, align: 'right' },
  ];

  const drawTableHeaderCommercial = (cols: typeof colSalesCommercial, y: number) => {
    doc.rect(35, y, 525, 18).fill(secondaryColor);
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
    cols.forEach(col => {
      doc.text(col.name, col.x, y + 5, {
        width: col.w,
        align: (col.align || 'left') as any,
      });
    });
  };

  drawTableHeaderCommercial(colSalesCommercial, currentY);
  currentY += 18;

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

  let alternateRow = false;
  if (uniqueSales.length === 0) {
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Oblique').text('No se encontraron ventas registradas en el rango seleccionado.', 45, currentY + 8);
    currentY += 25;
  } else {
    for (const sale of uniqueSales) {
      const rowHeight = sale.sale_items ? 90 : 20;
      if (currentY + rowHeight > 730) {
        doc.addPage();
        currentY = drawPageHeader(doc.bufferedPageRange().count);
        drawTableHeaderCommercial(colSalesCommercial, currentY);
        currentY += 18;
      }

      doc.rect(35, currentY, 525, rowHeight).fill(alternateRow ? lightGray : '#ffffff');
      doc.fillColor(darkGray).fontSize(7).font('Helvetica');

      const vn = getMetric(sale.sale_items, ['Venta Neta', 'venta_neta']);
      const imp = getMetric(sale.sale_items, ['Impuestos', 'impuestos']);
      const tot = getMetric(sale.sale_items, ['Venta Neta + Impuesto', 'venta_neta_mas_impuesto', 'Venta Neta + Impuestos']);
      const uc = getMetric(sale.sale_items, ['Ultimo Costo', 'ultimo_costo', 'Último Costo']);
      const uup = getMetric(sale.sale_items, ['% Utilidad Ultimo Costo', '% Utilidad Ultimo']);

      // Fecha
      doc.text(sale.movement_date, colSalesCommercial[0].x, currentY + 6);
      // Código Venta
      doc.font('Helvetica-Bold').text(sale.sale_code, colSalesCommercial[1].x, currentY + 6);
      doc.font('Helvetica');
      // Producto/Receta
      doc.text(sale.recipe_name.toUpperCase(), colSalesCommercial[2].x, currentY + 6, { width: colSalesCommercial[2].w, height: 12 });
      // Cantidad
      doc.text(`${sale.quantity} u`, colSalesCommercial[3].x, currentY + 6, { width: colSalesCommercial[3].w, align: 'right' });
      // Venta Neta
      doc.text(`$${vn.toFixed(2)}`, colSalesCommercial[4].x, currentY + 6, { width: colSalesCommercial[4].w, align: 'right' });
      // Impuestos
      doc.text(`$${imp.toFixed(2)}`, colSalesCommercial[5].x, currentY + 6, { width: colSalesCommercial[5].w, align: 'right' });
      // Total
      doc.font('Helvetica-Bold').text(`$${tot.toFixed(2)}`, colSalesCommercial[6].x, currentY + 6, { width: colSalesCommercial[6].w, align: 'right' });
      doc.font('Helvetica');
      // Costo
      doc.text(`$${uc.toFixed(2)}`, colSalesCommercial[7].x, currentY + 6, { width: colSalesCommercial[7].w, align: 'right' });
      // % Util
      doc.fillColor('#0f766e').font('Helvetica-Bold').text(`${uup.toFixed(1)}%`, colSalesCommercial[8].x, currentY + 6, { width: colSalesCommercial[8].w, align: 'right' });
      doc.fillColor(darkGray).font('Helvetica');

      // Draw detail cards if sale_items exists
      if (sale.sale_items) {
        const desc = getMetric(sale.sale_items, ['Descuento']);
        const descP = getMetric(sale.sale_items, ['% Descuento']);
        const cantP = getMetric(sale.sale_items, ['% Cantidad']);
        const ventP = getMetric(sale.sale_items, ['% Ventas']);
        const cp = getMetric(sale.sale_items, ['Costo Promedio', 'costo_promedio']);
        const cpp = getMetric(sale.sale_items, ['% Costo Promedio']);
        const ucprom = getMetric(sale.sale_items, ['Utilidad Costo Promedio', 'Utilidad Costo']);
        const ucpp = getMetric(sale.sale_items, ['% Utilidad Costo Promedio', '% Utilidad Costo']);
        const ucp = getMetric(sale.sale_items, ['% Ultimo Costo', '% último costo']);
        const uu = getMetric(sale.sale_items, ['Utilidad Ultimo Costo', 'Utilidad Ultimo']);

        // Draw Title
        doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold').text('DETALLE COMERCIAL COMPLETO DE LA VENTA', 43, currentY + 23);

        // Draw left emerald border strip
        doc.rect(35, currentY + 32, 3, 52).fill('#10b981');

        // Draw main white rounded box container
        doc.roundedRect(43, currentY + 32, 517, 52, 4).fill('#ffffff');
        doc.roundedRect(43, currentY + 32, 517, 52, 4).strokeColor('#e2e8f0').lineWidth(0.4).stroke();

        const cardY = currentY + 36;
        const cardW = 97;
        const cardH = 44;
        const cardGap = 6.25;

        for (let i = 0; i < 5; i++) {
          const cardX = 47 + i * (cardW + cardGap);
          // Draw card background
          doc.roundedRect(cardX, cardY, cardW, cardH, 2).fill('#f8fafc');
          doc.roundedRect(cardX, cardY, cardW, cardH, 2).strokeColor('#e2e8f0').lineWidth(0.25).stroke();

          // Card Title
          doc.fillColor('#64748b').fontSize(5.5).font('Helvetica-Bold');
          if (i === 0) {
            doc.text('VENTA COMERCIAL', cardX + 4, cardY + 4);
            doc.fillColor('#475569').fontSize(6.5).font('Helvetica');
            doc.text('Venta Neta:', cardX + 4, cardY + 14);
            doc.text('Impuestos:', cardX + 4, cardY + 23);
            doc.font('Helvetica-Bold').text('Total:', cardX + 4, cardY + 32);

            doc.text(`$${vn.toFixed(2)}`, cardX + cardW - 4, cardY + 14, { width: 50, align: 'right' });
            doc.text(`$${imp.toFixed(2)}`, cardX + cardW - 4, cardY + 23, { width: 50, align: 'right' });
            doc.text(`$${tot.toFixed(2)}`, cardX + cardW - 4, cardY + 32, { width: 50, align: 'right' });
          } else if (i === 1) {
            doc.text('COSTO & UTIL. (ÚLT.)', cardX + 4, cardY + 4);
            doc.fillColor('#475569').fontSize(6.5).font('Helvetica');
            doc.text('Costo:', cardX + 4, cardY + 14);
            doc.text('Utilidad:', cardX + 4, cardY + 23);

            // Cost value & percentage
            doc.font('Helvetica-Bold').text(`$${uc.toFixed(2)}`, cardX + cardW - 28, cardY + 14, { width: 40, align: 'right' });
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(5.5).text(`(${ucp.toFixed(1)}%)`, cardX + cardW - 4, cardY + 14.5, { width: 25, align: 'right' });

            // Utility value & percentage
            doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(6.5).text(`$${uu.toFixed(2)}`, cardX + cardW - 28, cardY + 23, { width: 40, align: 'right' });
            doc.fontSize(5.5).text(`(${uup.toFixed(1)}%)`, cardX + cardW - 4, cardY + 23.5, { width: 25, align: 'right' });
          } else if (i === 2) {
            doc.text('COSTO & UTIL. (PROM.)', cardX + 4, cardY + 4);
            doc.fillColor('#475569').fontSize(6.5).font('Helvetica');
            doc.text('Costo:', cardX + 4, cardY + 14);
            doc.text('Utilidad:', cardX + 4, cardY + 23);

            // Cost value & percentage
            doc.font('Helvetica-Bold').text(`$${cp.toFixed(2)}`, cardX + cardW - 28, cardY + 14, { width: 40, align: 'right' });
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(5.5).text(`(${cpp.toFixed(1)}%)`, cardX + cardW - 4, cardY + 14.5, { width: 25, align: 'right' });

            // Utility value & percentage
            doc.fillColor('#0d9488').font('Helvetica-Bold').fontSize(6.5).text(`$${ucprom.toFixed(2)}`, cardX + cardW - 28, cardY + 23, { width: 40, align: 'right' });
            doc.fontSize(5.5).text(`(${ucpp.toFixed(1)}%)`, cardX + cardW - 4, cardY + 23.5, { width: 25, align: 'right' });
          } else if (i === 3) {
            doc.text('DESCUENTOS', cardX + 4, cardY + 4);
            doc.fillColor('#475569').fontSize(6.5).font('Helvetica');
            doc.text('Valor:', cardX + 4, cardY + 14);
            doc.text('Porcentaje:', cardX + 4, cardY + 23);

            doc.font('Helvetica-Bold').text(`$${desc.toFixed(2)}`, cardX + cardW - 4, cardY + 14, { width: 50, align: 'right' });
            doc.text(`${descP.toFixed(2)}%`, cardX + cardW - 4, cardY + 23, { width: 50, align: 'right' });
          } else if (i === 4) {
            doc.text('PARTICIPACIÓN VENTAS', cardX + 4, cardY + 4);
            doc.fillColor('#475569').fontSize(6.5).font('Helvetica');
            doc.text('% Cantidad:', cardX + 4, cardY + 14);
            doc.text('% Ventas:', cardX + 4, cardY + 23);

            doc.font('Helvetica-Bold').text(`${cantP.toFixed(2)}%`, cardX + cardW - 4, cardY + 14, { width: 50, align: 'right' });
            doc.text(`${ventP.toFixed(2)}%`, cardX + cardW - 4, cardY + 23, { width: 50, align: 'right' });
          }
        }
      }

      doc.strokeColor(borderGray).lineWidth(0.3).moveTo(35, currentY + rowHeight).lineTo(560, currentY + rowHeight).stroke();

      currentY += rowHeight;
      alternateRow = !alternateRow;
    }
  }

  // --- SECCIÓN 1.2: INSUMOS AFECTADOS POR VENTAS (SALIDAS DE STOCK) ---
  currentY += 25;
  if (currentY > 680) {
    doc.addPage();
    currentY = drawPageHeader(doc.bufferedPageRange().count);
  }

  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('1.2. INSUMOS AFECTADOS POR VENTAS (SALIDAS DE STOCK)', 35, currentY);
  currentY += 15;

  const colSalesIngredients = [
    { name: 'Fecha', x: 35, w: 50 },
    { name: 'Código Venta', x: 85, w: 80 },
    { name: 'Insumo (SKU)', x: 165, w: 135 },
    { name: 'Cant. Consumida', x: 300, w: 60, align: 'right' },
    { name: 'Stock Prev->Act', x: 360, w: 90, align: 'center' },
    { name: 'Costo Total Insumo', x: 450, w: 110, align: 'right' },
  ];

  const drawTableHeaderIngredients = (cols: typeof colSalesIngredients, y: number) => {
    doc.rect(35, y, 525, 18).fill('#64748b'); // Slate gray
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
    cols.forEach(col => {
      doc.text(col.name, col.x, y + 5, {
        width: col.w,
        align: (col.align || 'left') as any,
      });
    });
  };

  drawTableHeaderIngredients(colSalesIngredients, currentY);
  currentY += 18;

  alternateRow = false;
  if (salesCount === 0) {
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Oblique').text('No se encontraron registros de salidas de insumos para el rango seleccionado.', 45, currentY + 8);
    currentY += 25;
  } else {
    for (const sale of sales) {
      if (currentY > 730) {
        doc.addPage();
        currentY = drawPageHeader(doc.bufferedPageRange().count);
        drawTableHeaderIngredients(colSalesIngredients, currentY);
        currentY += 18;
      }

      doc.rect(35, currentY, 525, 24).fill(alternateRow ? lightGray : '#ffffff');
      doc.fillColor(darkGray).fontSize(7).font('Helvetica');

      // Fecha
      doc.text(sale.movement_date, colSalesIngredients[0].x, currentY + 6);
      // Código Venta
      doc.text(sale.sale_code || 'Directo', colSalesIngredients[1].x, currentY + 6);
      // Insumo (SKU)
      const insumoText = `${sale.inventory_name.toUpperCase()}\n(${sale.inventory_sku})`;
      doc.text(insumoText, colSalesIngredients[2].x, currentY + 4, { width: colSalesIngredients[2].w, height: 18 });
      // Cant. Consumida
      doc.text(`-${Number(sale.quantity).toFixed(3)} ${sale.uom.toUpperCase()}`, colSalesIngredients[3].x, currentY + 6, { width: colSalesIngredients[3].w, align: 'right' });
      // Stock Prev->Act
      doc.text(`${Number(sale.previous_stock).toFixed(2)} → ${Number(sale.current_stock).toFixed(2)}`, colSalesIngredients[4].x, currentY + 6, { width: colSalesIngredients[4].w, align: 'center' });
      // Costo Total Insumo
      doc.text(`$${Number(sale.total_cost).toFixed(2)}`, colSalesIngredients[5].x, currentY + 6, { width: colSalesIngredients[5].w, align: 'right' });

      doc.strokeColor(borderGray).lineWidth(0.3).moveTo(35, currentY + 24).lineTo(560, currentY + 24).stroke();

      currentY += 24;
      alternateRow = !alternateRow;
    }
  }

  currentY += 25;

  // --- SECCIÓN 2: ENTRADAS DE ABASTECIMIENTO ---
  if (currentY > 680) {
    doc.addPage();
    currentY = drawPageHeader(doc.bufferedPageRange().count);
  }

  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('2. ENTRADAS DE INSUMOS PARA ABASTECER EL ALMACÉN CENTRAL (TABLA HISTORY)', 35, currentY);
  currentY += 15;

  // Columnas para entradas:
  // Fecha (50), Insumo (130), Cantidad (60), Stock Prev->Act (90), Referencia OC (120), Costo Total (75)
  const colInputs = [
    { name: 'Fecha', x: 35, w: 55 },
    { name: 'Insumo (SKU)', x: 95, w: 125 },
    { name: 'Cant. Recibida', x: 225, w: 60, align: 'right' },
    { name: 'Stock Prev->Act', x: 290, w: 85, align: 'center' },
    { name: 'Orden Compra / Proveedor', x: 380, w: 110 },
    { name: 'Costo Total', x: 495, w: 65, align: 'right' },
  ];

  const drawTableHeaderInputs = (cols: typeof colInputs, y: number) => {
    doc.rect(35, y, 525, 18).fill('#0f766e'); // Teal oscuro
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
    cols.forEach(col => {
      doc.text(col.name, col.x, y + 5, {
        width: col.w,
        align: (col.align || 'left') as any,
      });
    });
  };

  drawTableHeaderInputs(colInputs, currentY);
  currentY += 18;

  alternateRow = false;
  if (inputsCount === 0) {
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Oblique').text('No se registran entradas de abastecimiento ni ingresos de insumos al almacén central en el periodo especificado.', 45, currentY + 8);
    currentY += 25;
  } else {
    for (const input of inputs) {
      if (currentY > 730) {
        doc.addPage();
        currentY = drawPageHeader(doc.bufferedPageRange().count);
        drawTableHeaderInputs(colInputs, currentY);
        currentY += 18;
      }

      // Dibujar fondo de fila
      doc.rect(35, currentY, 525, 24).fill(alternateRow ? lightGray : '#ffffff');
      doc.fillColor(darkGray).fontSize(7).font('Helvetica');

      // Fecha
      doc.text(input.movement_date, colInputs[0].x, currentY + 6);

      // Insumo (SKU)
      const insumoText = `${input.inventory_name.toUpperCase()}\n(${input.inventory_sku})`;
      doc.text(insumoText, colInputs[1].x, currentY + 4, { width: colInputs[1].w, height: 18 });

      // Cantidad recibida con UOM
      const qtyText = `${Number(input.quantity).toFixed(2)}\n${input.uom.toUpperCase()}`;
      doc.text(qtyText, colInputs[2].x, currentY + 4, { width: colInputs[2].w, align: 'right' });

      // Stock anterior -> nuevo
      const stockText = `${Number(input.previous_stock).toFixed(2)} →\n${Number(input.current_stock).toFixed(2)}`;
      doc.text(stockText, colInputs[3].x, currentY + 4, { width: colInputs[3].w, align: 'center' });

      // Orden Compra / Proveedor
      let poProvText = 'Directo / Sistema';
      if (input.po_number) {
        const supplierNameClean = input.supplier_name ? input.supplier_name.slice(0, 15) : 'N/A';
        poProvText = `${input.po_number}\n${supplierNameClean}`;
      } else if (input.notes) {
        poProvText = input.notes.slice(0, 30);
      }
      doc.text(poProvText, colInputs[4].x, currentY + 4, { width: colInputs[4].w, height: 18 });

      // Costo Total
      const costText = `$${Number(input.total_cost).toFixed(2)}`;
      doc.text(costText, colInputs[5].x, currentY + 8, { width: colInputs[5].w, align: 'right' });

      // Línea divisoria muy sutil
      doc.strokeColor(borderGray).lineWidth(0.3).moveTo(35, currentY + 24).lineTo(560, currentY + 24).stroke();

      currentY += 24;
      alternateRow = !alternateRow;
    }
  }

  // --- FINALIZACIÓN Y NUMERACIÓN DE PÁGINAS ---
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    // Dibuja una línea fina divisoria al pie de la página
    doc.strokeColor(borderGray).lineWidth(0.5).moveTo(35, 795).lineTo(560, 795).stroke();

    doc.fillColor('#94a3b8').fontSize(7)
      .text(`Reporte de Auditoría de Inventario y Movimientos de Stock • ERP Restaurant`, 35, 802, { align: 'left', width: 400 })
      .text(`Página ${i + 1} de ${range.count}`, 450, 802, { align: 'right', width: 110 });
  }

  // End the document
  doc.end();
}
