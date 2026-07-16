import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, CheckCircle2, RefreshCw, AlertTriangle,
  Layers, Info, ShieldCheck, ChevronRight, ClipboardList
} from 'lucide-react';

interface ProductionOrderItem {
  sku: string;
  name: string;
  uom: string;
  physicalStock: number;
  dailyDemand: number;
  daysRemaining: number;
  maximumStock: number;
  qtyToRestock: number;
}

interface ProductionOrderProps {
  apiUrl: string;
  token: string | null;
  latestRestockAudit: any;
  setLatestRestockAudit: React.Dispatch<React.SetStateAction<any>>;
  onApproveRestock: (warehouseId: number, items: { sku: string, qty: number }[]) => Promise<void>;
  isRestockingLoading: boolean;
}

// Dynamic script loader for jsPDF and AutoTable
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

export default function ProductionOrder({
  apiUrl,
  token,
  latestRestockAudit,
  setLatestRestockAudit,
  onApproveRestock,
  isRestockingLoading
}: ProductionOrderProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPdfDownloading, setIsPdfDownloading] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Helper to fetch authorization headers
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch restocking data from endpoint on mount or manual reload
  const fetchRestockingData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/alerts/restocking-data`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al obtener la propuesta de reabastecimiento crítico.');
      const data = await res.json();
      if (data && data.success) {
        setLatestRestockAudit(data);
      } else {
        throw new Error(data.message || 'No se pudo obtener información del reabastecimiento.');
      }
    } catch (err: any) {
      console.error('Error fetching restocking proposal:', err);
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!latestRestockAudit) {
      fetchRestockingData();
    }
  }, []);

  // Filter items that have 3 days or less of supply
  // Note: daysRemaining <= 3 covers all critical inventory replenishment requirements
  const criticalItems = React.useMemo(() => {
    if (!latestRestockAudit || !latestRestockAudit.items) return [];
    return (latestRestockAudit.items as ProductionOrderItem[]).filter(
      item => item.daysRemaining <= 3 || item.physicalStock === 0
    );
  }, [latestRestockAudit]);

  // Download PDF request form
  const handleDownloadPdf = async () => {
    if (criticalItems.length === 0) return;
    setIsPdfDownloading(true);
    try {
      await loadJsPDF();
      const { jsPDF } = (window as any).jspdf;

      // Portrait layout
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const primaryColor = [15, 23, 42]; // Slate 900
      const secondaryColor = [225, 29, 72]; // Rose 600
      const darkGray = [51, 65, 85];
      const lightGray = [248, 250, 252];

      // Corporate Banner Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, 12, 180, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('ORDEN DE PRODUCCIÓN', 22, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 200);
      doc.text('ADQUISICIÓN DE INSUMOS DE REABASTECIMIENTO CRÍTICO (<= 3 DÍAS)', 22, 27);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleString()}`, 22, 32);

      // Metadata Block
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(15, 40, 180, 18, 'F');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('DETALLES DEL ALMACÉN:', 22, 46);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${latestRestockAudit.warehouseName || 'Almacén Central'}`, 22, 52);
      doc.text(`Insumos Solicitados: ${criticalItems.length} items`, 120, 46);
      doc.text('Estado: Propuesta Crítica Pendiente de Surtido', 120, 52);

      // PDF Table Headers
      const tableHeaders = [
        'SKU',
        'Producto / Insumo',
        'Unidad',
        'Stock Actual',
        'Demanda Diaria',
        'Días Restantes',
        'Cantidad a Surtir'
      ];

      const tableRows = criticalItems.map(item => [
        item.sku,
        item.name.toUpperCase(),
        item.uom.toUpperCase(),
        Math.round(item.physicalStock),
        Math.round(item.dailyDemand),
        item.daysRemaining <= 0 ? 'Sin stock (0)' : `${Math.round(item.daysRemaining)} días`,
        Math.round(item.qtyToRestock)
      ]);

      (doc as any).autoTable({
        startY: 64,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: darkGray },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'right', fontStyle: 'bold', textColor: secondaryColor }
        },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 2 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 25;

      // Draw Signature Sections if space permits, otherwise add new page
      let signatureY = finalY;
      if (signatureY > 240) {
        doc.addPage();
        signatureY = 30;
      }

      // Draw elegant signature placeholders
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);

      // Preparado por
      doc.line(20, signatureY, 80, signatureY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Elaborado y Solicitado por', 20, signatureY + 4);
      doc.setFont('helvetica', 'bold');
      doc.text('Supervisor de Almacén', 20, signatureY + 8);

      // Aprobado por
      doc.line(130, signatureY, 190, signatureY);
      doc.setFont('helvetica', 'normal');
      doc.text('Aprobado y Autorizado por', 130, signatureY + 4);
      doc.setFont('helvetica', 'bold');
      doc.text('Gerente de Operaciones / Finanzas', 130, signatureY + 8);

      // Elegant Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.line(15, 282, 195, 282);

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text('Planilla de Solicitud de Reabastecimiento Crítico • ERP Restaurant', 15, 286);
        doc.text(`Página ${i} de ${totalPages}`, 195, 286, { align: 'right' });
      }

      doc.save(`SOLICITUD_REABASTECIMIENTO_${latestRestockAudit.warehouseName || 'CENTRAL'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF request form:', err);
      alert('Hubo un error al generar la planilla PDF.');
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const handleApprove = async () => {
    if (!latestRestockAudit || criticalItems.length === 0) return;
    const warehouseId = latestRestockAudit.warehouseId;
    const itemsPayload = criticalItems.map(it => ({
      sku: it.sku,
      qty: it.qtyToRestock
    }));

    await onApproveRestock(warehouseId, itemsPayload);
    // Refresh to check if any other items need restocking
    fetchRestockingData(true);
  };

  // Bento metric KPIs calculations
  const totalSuggestedQty = criticalItems.reduce((acc, item) => acc + item.qtyToRestock, 0);
  const avgDaysRemaining = criticalItems.length > 0
    ? criticalItems.reduce((acc, item) => acc + item.daysRemaining, 0) / criticalItems.length
    : 0;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-sm">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl text-slate-800 tracking-tight">
              Orden de Producción
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Planificación y abastecimiento de insumos críticos con suministro menor o igual a 3 días.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => fetchRestockingData()}
            className="flex-1 md:flex-none py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            disabled={isLoading || isRestockingLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex-1 md:flex-none py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={criticalItems.length === 0 || isPdfDownloading}
          >
            {isPdfDownloading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-slate-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Ver Solicitud
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (criticalItems.length > 0) {
                setShowConfirmModal(true);
              }
            }}
            className="flex-1 md:flex-none py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={criticalItems.length === 0 || isRestockingLoading}
          >
            {isRestockingLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Abastecer
              </>
            )}
          </button>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-start gap-3 text-xs font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div>
            <p className="font-bold">Error al cargar datos</p>
            <p className="font-medium text-rose-700/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Insumos Críticos</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-black text-slate-800 leading-none">
              {isLoading ? '...' : criticalItems.length}
            </span>
            <span className="text-xs text-slate-400 font-semibold">productos</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-medium">Con suministro ≤ 3 días</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Abastecimiento Promedio</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-black text-rose-650 leading-none">
              {isLoading ? '...' : Math.round(avgDaysRemaining)}
            </span>
            <span className="text-xs text-rose-500 font-semibold">días</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-medium">Suministro remanente medio</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Volumen Total a Surtir</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-black text-slate-800 leading-none">
              {isLoading ? '...' : Math.round(totalSuggestedQty)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">unidades</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-medium">Reposición proyectada total</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Almacén Destino</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-xl font-bold text-slate-800 leading-none truncate max-w-full">
              {isLoading ? '...' : (latestRestockAudit?.warehouseName || 'Almacén Central')}
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-2 font-medium">Reposición de existencias</span>
        </div>
      </div>

      {/* DETAILS TABLE CARD */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Propuesta Detallada de Adquisición
          </h3>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-650">
            {criticalItems.length} insumos afectados
          </span>
        </div>

        {isLoading ? (
          /* Loading skeleton */
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-xl w-full"></div>
            <div className="h-20 bg-slate-50 rounded-xl w-full"></div>
            <div className="h-20 bg-slate-50 rounded-xl w-full"></div>
            <div className="h-20 bg-slate-50 rounded-xl w-full"></div>
          </div>
        ) : criticalItems.length === 0 ? (
          /* Empty state */
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h4 className="font-display font-black text-slate-800 text-base">Almacén Equilibrado</h4>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                No hay insumos con menos de 3 días de abastecimiento en este momento. La demanda y el stock están balanceados.
              </p>
            </div>
          </div>
        ) : (
          /* Table list */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Insumo</th>
                  <th className="px-6 py-4 text-right">UOM</th>
                  <th className="px-6 py-4 text-right">Stock Físico</th>
                  <th className="px-6 py-4 text-right">Demanda Diaria</th>
                  <th className="px-6 py-4 text-center">Días Restantes</th>
                  <th className="px-6 py-4 text-right font-bold text-rose-600">Sugerido a Surtir</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {criticalItems.map((item, idx) => {
                  const days = item.daysRemaining;
                  let dayBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200/60';
                  let statusText = 'Crítico (<= 3 días)';

                  if (item.physicalStock === 0) {
                    dayBadgeColor = 'bg-red-50 text-red-700 border-red-200/60 font-black animate-pulse';
                    statusText = 'Agotado (0 días)';
                  } else if (days <= 1) {
                    dayBadgeColor = 'bg-red-50 text-red-700 border-red-200/60 font-bold';
                    statusText = 'Urgente (<= 1 día)';
                  } else if (days <= 2) {
                    dayBadgeColor = 'bg-orange-50 text-orange-700 border-orange-200/60';
                    statusText = 'Crítico (<= 2 días)';
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-mono text-slate-500 font-medium">{item.sku}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-6 py-4 text-right text-slate-400 font-medium">{item.uom}</td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-500">
                        {Math.round(item.physicalStock)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-500">
                        {Math.round(item.dailyDemand)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${dayBadgeColor}`}>
                          {item.physicalStock === 0 ? '0' : Math.round(days)} días
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-rose-600">
                        +{Math.round(item.qtyToRestock)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${item.physicalStock === 0 || days <= 1 ? 'bg-red-500' : 'bg-orange-500'}`}></span>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INFO BANNER */}
      <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2xl flex gap-3 text-xs text-slate-500 leading-relaxed font-semibold">
        <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-700">Abastecimiento Basado en Demanda</p>
          <p className="mt-0.5 text-slate-500/90">
            La cantidad sugerida a surtir calcula la diferencia entre el Stock Máximo configurado para el almacén y el Stock Físico actual. En caso de no tener configurado un Stock Máximo, se calcula la proyección necesaria para cubrir 7 días completos de demanda promedio diaria.
          </p>
        </div>
      </div>

      {/* Ventana de Confirmación de Abastecimiento */}
      <AnimatePresence>
        {showConfirmModal && criticalItems.length > 0 && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 text-left"
            >
              {/* Header */}
              <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
                <h3 className="font-display font-bold text-base flex items-center gap-2 text-white">
                  <ClipboardList className="w-5 h-5 text-rose-200" />
                  Confirmar Abastecimiento de Almacén
                </h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-rose-200 hover:text-white cursor-pointer text-lg font-bold transition"
                  aria-label="Cerrar modal"
                >
                  &times;
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6 space-y-4 text-xs text-slate-650">
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-650 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-950 font-bold block text-sm">¿Desea abastecer el almacén?</strong>
                    <span className="text-rose-800 leading-relaxed block mt-1">
                      Está a punto de autorizar la orden de reabastecimiento para el almacén <strong>{latestRestockAudit?.warehouseName || 'Central'}</strong>.
                      Esto ajustará los niveles de stock físico con el suministro sugerido.
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Resumen de Insumos a Surtir ({criticalItems.length} items):
                  </p>
                  
                  <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50">
                    {criticalItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-100 last:border-0">
                        <span className="font-semibold text-slate-700 truncate max-w-[220px]">{item.name}</span>
                        <span className="font-mono text-rose-600 font-bold shrink-0">
                          +{Math.round(item.qtyToRestock)} {item.uom.toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 leading-relaxed">
                  Total sugerido a ingresar: <strong className="text-slate-700 font-bold">{Math.round(totalSuggestedQty)} unidades</strong>.
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-650 hover:bg-slate-55 transition font-semibold cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmModal(false);
                      handleApprove();
                    }}
                    className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition font-semibold shadow-md shadow-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    Sí, abastecer almacén
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
