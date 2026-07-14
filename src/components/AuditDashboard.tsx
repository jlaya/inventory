import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Calendar, Download, RefreshCw, ShoppingCart,
  Truck, ArrowRight, DollarSign, Package, AlertCircle, Info, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';

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

export default function AuditDashboard({ apiUrl }: AuditDashboardProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'sales' | 'inputs' | 'balance'>('sales');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [inputsData, setInputsData] = useState<any[]>([]);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // Track which rows have expanded details
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
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

      // --- SECTION 1: SALES OUTPUTS TABLE ---
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1. Salidas por Ventas', 15, currentY);
      currentY += 4;

      const salesHeaders = [
        'Fecha',
        'Código',
        'Insumo',
        'Consumido',
        'Unidad',
        'Inv. Inicial',
        'Inv. Final',
        'Producto',
        'Costo Unit.',
        'Total'
      ];

      const salesRows = salesData.map((s) => [
        formatDate(s.movement_date),
        s.inventory_sku,
        s.inventory_name.toUpperCase(),
        `-${Number(s.quantity).toFixed(3)}`,
        s.uom.toUpperCase(),
        Number(s.previous_stock).toFixed(2),
        Number(s.current_stock).toFixed(2),
        s.recipe_name ? `${s.recipe_name.toUpperCase()} (${s.sale_code || 'Venta'})` : 'Consumo Directo',
        `$${Number(s.unit_cost).toFixed(2)}`,
        `$${Number(s.total_cost).toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: currentY,
        head: [salesHeaders],
        body: salesRows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, fontSize: 7.5, fontStyle: 'bold' },
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

      const inputsRows = inputsData.map((i) => [
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
      doc.save(`reporte_auditoria_inventario_${startDate || 'abierto'}_${endDate || 'abierto'}.pdf`);
    } catch (err) {
      console.error('Error generating jsPDF report:', err);
      alert('Hubo un error al generar el PDF de auditoría.');
    } finally {
      setIsDownloading(false);
    }
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

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading || (salesData.length === 0 && inputsData.length === 0)}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  Descargar PDF
                </>
              )}
            </button>
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
          <div className="overflow-x-auto">
            {salesData.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs italic flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                No se encontraron salidas por ventas en el rango especificado.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-150">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4 text-right">Cant. Consumida</th>
                    <th className="py-3 px-4 text-center">Stock Prev → Act</th>
                    <th className="py-3 px-4">Receta de Origen</th>
                    <th className="py-3 px-4 text-right">Costo Total</th>
                    <th className="py-3 px-4 text-center">Trazabilidad jsonb</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {salesData.map((row) => {
                    const isExpanded = !!expandedRows[row.history_id];
                    return (
                      <React.Fragment key={row.history_id}>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                            {formatDate(row.movement_date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block leading-tight">{row.inventory_name}</span>
                            <span className="font-mono text-[9px] text-slate-400">{row.inventory_sku}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            -{Number(row.quantity).toFixed(3)} {row.uom}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-semibold whitespace-nowrap">
                            <span className="text-slate-400">{Number(row.previous_stock).toFixed(2)}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-350 inline mx-1.5" />
                            <span className="text-slate-700 font-bold">{Number(row.current_stock).toFixed(2)}</span>
                          </td>
                          <td className="py-3.5 px-4">
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
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            ${Number(row.total_cost).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
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
                        {/* Expanded details row */}
                        {isExpanded && row.movement_item_detail && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-4 border-l-4 border-primary-500">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-450 uppercase">
                                  <Info className="w-4 h-4 text-primary-500" />
                                  Detalle extraído de la tabla de movimientos (inventory_movements.items)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3.5 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                  <div>
                                    <span className="text-slate-400 block font-medium">Nombre de Insumo (Json)</span>
                                    <span className="font-bold text-slate-800">{row.movement_item_detail.name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Cantidad Consumida (Json)</span>
                                    <span className="font-bold text-rose-600 font-mono">
                                      {row.movement_item_detail.consumed_quantity} {row.movement_item_detail.uom}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Stocks en Json</span>
                                    <span className="font-bold text-slate-700 font-mono">
                                      Previo: {row.movement_item_detail.previous_stock} | Actual: {row.movement_item_detail.current_stock}
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
