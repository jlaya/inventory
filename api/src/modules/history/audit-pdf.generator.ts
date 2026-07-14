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

  // --- SECCIÓN 1: SALIDAS POR VENTAS ---
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('1. SALIDAS DE INVENTARIO POR CONCEPTOS DE VENTA (TABLA HISTORY)', 35, currentY);
  currentY += 15;

  // Definición de columnas de la tabla de salidas
  // Ancho total = 525. Columnas:
  // Fecha (50), Insumo SKU/Nombre (110), Cantidad (50), Stock Prev->Act (80), Detalle Receta (170), Costo Total (65)
  const colSales = [
    { name: 'Fecha', x: 35, w: 50 },
    { name: 'Insumo (SKU)', x: 85, w: 110 },
    { name: 'Cant.', x: 195, w: 50, align: 'right' },
    { name: 'Stock Prev->Act', x: 250, w: 80, align: 'center' },
    { name: 'Detalle Receta (Decomp. jsonb)', x: 335, w: 140 },
    { name: 'Costo Total', x: 480, w: 80, align: 'right' },
  ];

  const drawTableHeader = (cols: typeof colSales, y: number) => {
    doc.rect(35, y, 525, 18).fill(secondaryColor);
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
    cols.forEach(col => {
      doc.text(col.name, col.x, y + 5, {
        width: col.w,
        align: (col.align || 'left') as any,
      });
    });
  };

  drawTableHeader(colSales, currentY);
  currentY += 18;

  let alternateRow = false;
  if (salesCount === 0) {
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Oblique').text('No se encontraron registros de salidas de ventas para el rango seleccionado.', 45, currentY + 8);
    currentY += 25;
  } else {
    for (const sale of sales) {
      if (currentY > 730) {
        doc.addPage();
        currentY = drawPageHeader(doc.bufferedPageRange().count);
        drawTableHeader(colSales, currentY);
        currentY += 18;
      }

      // Dibujar fondo de fila
      doc.rect(35, currentY, 525, 24).fill(alternateRow ? lightGray : '#ffffff');
      doc.fillColor(darkGray).fontSize(7).font('Helvetica');

      // Fecha
      doc.text(sale.movement_date, colSales[0].x, currentY + 6);

      // Insumo (SKU)
      const insumoText = `${sale.inventory_name.toUpperCase()}\n(${sale.inventory_sku})`;
      doc.text(insumoText, colSales[1].x, currentY + 4, { width: colSales[1].w, height: 18 });

      // Cantidad con UOM
      const qtyText = `${Number(sale.quantity).toFixed(2)}\n${sale.uom.toUpperCase()}`;
      doc.text(qtyText, colSales[2].x, currentY + 4, { width: colSales[2].w, align: 'right' });

      // Stock anterior -> nuevo
      const stockText = `${Number(sale.previous_stock).toFixed(2)} →\n${Number(sale.current_stock).toFixed(2)}`;
      doc.text(stockText, colSales[3].x, currentY + 4, { width: colSales[3].w, align: 'center' });

      // Detalle Receta (Decomp jsonb)
      let recipeDetailText = 'N/A';
      if (sale.recipe_name) {
        recipeDetailText = `${sale.recipe_name.toUpperCase()}\n${sale.sale_code || 'Venta'}`;
      } else if (sale.notes) {
        recipeDetailText = sale.notes;
      }
      doc.text(recipeDetailText, colSales[4].x, currentY + 4, { width: colSales[4].w, height: 18 });

      // Costo Total
      const costText = `$${Number(sale.total_cost).toFixed(2)}`;
      doc.text(costText, colSales[5].x, currentY + 8, { width: colSales[5].w, align: 'right' });

      // Línea divisoria muy sutil
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
    doc.fillColor(darkGray).fontSize(8).font('Helvetica-Oblique').text('No se encontraron registros de entradas de abastecimiento para el almacén central.', 45, currentY + 8);
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
