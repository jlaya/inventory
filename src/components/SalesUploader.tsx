import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, ShoppingCart, TrendingDown, Clock,
  CheckCircle, AlertTriangle, Download, Trash2, ArrowRight, Sparkles, Info
} from 'lucide-react';
import { Insumo, Receta, VentaItem, HistorialVenta } from '../types';

const loadXLSX = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) {
      resolve((window as any).XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error('No se pudo cargar la librería de lectura de Excel (XLSX)'));
    document.body.appendChild(script);
  });
};

interface SalesUploaderProps {
  recetas: Receta[];
  insumos: Insumo[];
  onUploadVentas: (items: VentaItem[]) => void;
  historialVentas: HistorialVenta[];
  onLimpiarHistorial: () => void;
  apiUrl?: string;
}

export default function SalesUploader({
  recetas,
  insumos,
  onUploadVentas,
  historialVentas,
  onLimpiarHistorial,
  apiUrl,
}: SalesUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');

  // Manual counters for recipes
  const [manualQuantities, setManualQuantities] = useState<{ [key: string]: number }>({});

  const incrementManual = (recetaId: string) => {
    setManualQuantities({
      ...manualQuantities,
      [recetaId]: (manualQuantities[recetaId] || 0) + 1,
    });
  };

  const decrementManual = (recetaId: string) => {
    const current = manualQuantities[recetaId] || 0;
    if (current > 0) {
      setManualQuantities({
        ...manualQuantities,
        [recetaId]: current - 1,
      });
    }
  };

  const handleManualSubmit = () => {
    const itemsToProcess: VentaItem[] = Object.entries(manualQuantities)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([recetaId, qty]) => ({ recetaId, cantidad: qty as number }));

    if (itemsToProcess.length === 0) return;

    onUploadVentas(itemsToProcess);
    setManualQuantities({}); // Reset counters
  };

  // Drag and Drop & Simulated Upload Logic
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFileData = async (file: File) => {
    try {
      setDragError(null);
      let parsedItems: VentaItem[] = [];
      let excelHeaders: any[] = [];
      let rawRows: any[][] = [];
      let barcodeIdx = -1, productIdx = -1, qtyIdx = -1;

      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      //console.log('Processing file:', file.name, 'isExcel:', isExcel);

      if (isExcel) {
        // Dynamic load of XLSX library from CDN
        const XLSX = await loadXLSX();
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Read first sheet with rows, fallback to first sheet
        let sheet = null;
        let sheetName = '';

        const isRowEmpty = (row: any[]): boolean => {
          return !row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
        };

        for (const name of workbook.SheetNames) {
          const currentSheet = workbook.Sheets[name];
          const rowsTemp: any[][] = XLSX.utils.sheet_to_json(currentSheet, { header: 1 });
          const filledRows = rowsTemp.filter(row => !isRowEmpty(row));
          if (filledRows.length > 1) { // has headers and at least one data row
            sheet = currentSheet;
            sheetName = name;
            rawRows = filledRows;
            break;
          }
        }

        if (!sheet) {
          sheetName = workbook.SheetNames[0];
          sheet = workbook.Sheets[sheetName];
          const rowsTemp: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          rawRows = rowsTemp.filter(row => !isRowEmpty(row));
        }
        //console.log('Raw Excel rows read from sheet:', sheetName, rawRows);

        if (rawRows.length > 0) {
          excelHeaders = rawRows[0] || [];
          //console.log('Headers detected:', excelHeaders);

          // Resolve column indices based on keyword scanning
          barcodeIdx = excelHeaders.findIndex(h => {
            const hl = String(h || '').toLowerCase().trim();
            return ['código de barra', 'codigo de barra', 'código de barras', 'codigo de barras', 'barcode', 'idreceta', 'código', 'codigo', 'barra', 'id'].some(w => hl.includes(w));
          });

          productIdx = excelHeaders.findIndex(h => {
            const hl = String(h || '').toLowerCase().trim();
            return ['producto', 'product', 'nombre', 'name', 'receta', 'platillo'].some(w => hl.includes(w));
          });

          qtyIdx = excelHeaders.findIndex(h => {
            const hl = String(h || '').toLowerCase().trim();
            return ['cantidad', 'qty', 'quantity', 'cantidadvendida', 'cant'].some(w => hl.includes(w));
          });

          // Index fallback if name matching fails
          if (barcodeIdx === -1 && excelHeaders.length >= 3) {
            barcodeIdx = excelHeaders.length === 3 ? 0 : 1;
          }
          if (productIdx === -1 && excelHeaders.length >= 3) {
            productIdx = excelHeaders.length === 3 ? 1 : 2;
          }
          if (qtyIdx === -1 && excelHeaders.length >= 3) {
            qtyIdx = excelHeaders.length === 3 ? 2 : 3;
          }

          //console.log('Resolved Column Indices:', { barcodeIdx, productIdx, qtyIdx });

          // Map data rows starting from row 1 (row 0 was headers)
          parsedItems = rawRows.slice(1).map((rowArr, idx) => {
            if (!rowArr || rowArr.length === 0) return null;

            const barcode = barcodeIdx !== -1 && rowArr[barcodeIdx] !== undefined ? String(rowArr[barcodeIdx]).trim() : '';
            const productName = productIdx !== -1 && rowArr[productIdx] !== undefined ? String(rowArr[productIdx]).trim() : '';
            const rawQty = qtyIdx !== -1 && rowArr[qtyIdx] !== undefined ? rowArr[qtyIdx] : 0;

            let val = 0;
            if (typeof rawQty === 'number') {
              val = rawQty;
            } else {
              const cleaned = String(rawQty).replace(/[^0-9.-]/g, '');
              const parsed = parseFloat(cleaned);
              val = isNaN(parsed) ? 0 : Math.round(parsed);
            }

            //console.log(`Row #${idx + 2} parsed values:`, { barcode, productName, val });

            return {
              recetaId: barcode,
              cantidad: val,
            };
          }).filter((item): item is VentaItem => item !== null);
        }
      }

      //console.log('Final parsed items list:', parsedItems);

      if (parsedItems.length === 0) {
        if (isExcel) {
          const headerStr = JSON.stringify(excelHeaders);
          const firstRowsStr = JSON.stringify(rawRows.slice(0, 4));
          throw new Error(
            `No se encontraron recetas en Excel (${rawRows.length} filas leídas). ` +
            `Cabeceras detectadas: ${headerStr}. ` +
            `Índices columnas: Código=${barcodeIdx}, Producto=${productIdx}, Cantidad=${qtyIdx}. ` +
            `Primeras filas: ${firstRowsStr}`
          );
        } else {
          throw new Error('No se reconocieron recetas o cantidades válidas en el archivo.');
        }
      }

      // POST the Excel file directly to sales/upload
      const formData = new FormData();
      formData.append('file', file);

      const baseApi = apiUrl || (() => {
        const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_APP_API_URL || 'http://localhost:3000';
        if (envUrl.endsWith('/api/v1')) return envUrl;
        return `${envUrl.replace(/\/$/, '')}/api/v1`;
      })();

      const uploadRes = await fetch(`${baseApi}/sales/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Error en el servidor al subir: ${errorText || uploadRes.statusText}`);
      }

      onUploadVentas(parsedItems);
      setIsDragging(false);
    } catch (err: any) {
      setDragError(err.message || 'Error al procesar el archivo. Formato no compatible.');
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setPendingFile(file);
      setPendingFileName(file.name);
      setShowConfirmModal(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPendingFileName(file.name);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmUpload = () => {
    if (pendingFile) {
      processFileData(pendingFile);
    }
    setPendingFile(null);
    setPendingFileName('');
    setShowConfirmModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelUpload = () => {
    setPendingFile(null);
    setPendingFileName('');
    setShowConfirmModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Simulates uploading a raw POS sale file (e.g. 20 burgers, 15 tacos, 8 salads)
  const handleSimularCargaRapida = () => {
    const simulation: VentaItem[] = [
      { recetaId: 'rec-1', cantidad: 25 }, // 25 hamburguesas
      { recetaId: 'rec-2', cantidad: 35 }, // 35 tacos
      { recetaId: 'rec-3', cantidad: 12 }, // 12 ensaladas
      { recetaId: 'rec-4', cantidad: 8 },  // 8 filetes
    ];
    onUploadVentas(simulation);
  };

  // Generates a sample CSV file contents to let user copy or download
  const handleDownloadSample = () => {
    const headers = 'IdReceta,CantidadVendida\n';
    const body = recetas.map((r) => `${r.id},10`).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + body);

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'ventas_almacen_ejemplo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Panel de Ingesta de Ventas */}
      <div className="lg:col-span-2 space-y-4">

        {/* Encabezado e Ingesta */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4.5 h-4.5 text-primary-600" />
                MÓDULO DE INGESTA DE VENTAS DIARIAS
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Al subir las ventas se descontará de forma masiva los insumos del almacén de acuerdo a cada receta.
              </p>
              <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl text-sky-850 flex items-start gap-3 mt-3 text-xs leading-relaxed">
                <Info className="w-5 h-5 text-sky-650 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <span className="font-bold text-sky-950 block">Estructura de Excel Requerida</span>
                  <p className="text-sky-800 text-[11px]">
                    Para poder procesar la ingesta correctamente, es sumamente importante que tu archivo Excel contenga las siguientes columnas con sus respectivos encabezados:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Código de Barra', 'Producto', 'Cantidad'].map((col, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white border border-sky-150 rounded-lg font-mono font-bold text-[10px] text-sky-700 shadow-sm">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Selector de métodos */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                hidden
                onClick={() => setActiveTab('upload')}
                className={`text-[10px] uppercase font-mono font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Cargar Archivo
              </button>
              <button
                hidden
                onClick={() => setActiveTab('manual')}
                className={`text-[10px] uppercase font-mono font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Comanda Manual
              </button>
            </div>
          </div>

          {activeTab === 'upload' ? (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${isDragging
                  ? 'border-primary-500 bg-sky-50/50'
                  : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/50'
                  }`}
                id="area-arrastrar-ventas"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv,.json,.txt"
                  className="hidden"
                />

                <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-250">
                  <Upload className="w-6 h-6 text-primary-600" />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800">
                    Arrastra aquí tu archivo de ventas o haz clic para buscarlo
                  </p>
                </div>
              </div>

              {/* Errores */}
              {dragError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{dragError}</span>
                </div>
              )}

              {/* Botones de acción rápida */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  hidden
                  type="button"
                  onClick={handleSimularCargaRapida}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                  id="btn-simular-ventas"
                >
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Simular Carga de POS Masiva
                </button>

                <button
                  hidden
                  type="button"
                  onClick={handleDownloadSample}
                  className="py-3 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Obtener CSV de Prueba
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Manual Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {recetas.map((rec) => {
                  const cant = manualQuantities[rec.id] || 0;
                  return (
                    <div
                      key={rec.id}
                      className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between hover:bg-slate-100/50 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{rec.imagen || '🍽️'}</span>
                        <div>
                          <span className="font-semibold text-slate-800 block text-xs">{rec.nombre}</span>
                          <span className="text-[9px] font-mono text-slate-400">Receta ID: {rec.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => decrementManual(rec.id)}
                          className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-250 text-slate-700 text-sm font-bold rounded-lg flex items-center justify-center select-none cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-slate-800 w-5 text-center text-xs">
                          {cant}
                        </span>
                        <button
                          type="button"
                          onClick={() => incrementManual(rec.id)}
                          className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-250 text-slate-700 text-sm font-bold rounded-lg flex items-center justify-center select-none cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleManualSubmit}
                disabled={!Object.values(manualQuantities).some((qty) => (qty as number) > 0)}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                id="btn-descontar-manual"
              >
                <TrendingDown className="w-4 h-4" />
                Procesar Descuento Masivo en Almacén
              </button>
            </div>
          )}

        </div>

        {/* Historial de Ventas */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4" hidden>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Historial de Ingestas Procesadas
            </h3>
            {historialVentas.length > 0 && (
              <button
                onClick={onLimpiarHistorial}
                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase transition"
              >
                Limpiar Historial
              </button>
            )}
          </div>

          {historialVentas.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs italic">
              Aún no se han procesado ingestas de ventas en esta sesión.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {historialVentas.map((venta, idx) => (
                <div key={venta.id} className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">
                      Carga #{historialVentas.length - idx} • {new Date(venta.fecha).toLocaleTimeString('es-ES')}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Procesado
                    </span>
                  </div>

                  {/* Items Vendidos */}
                  <div className="flex flex-wrap gap-1.5">
                    {venta.items.map((item, idy) => (
                      <span key={idy} className="text-[10px] bg-slate-200/60 text-slate-700 px-2.5 py-1 rounded-lg font-medium border border-slate-200">
                        {item.recetaNombre} ({item.cantidad} u)
                      </span>
                    ))}
                  </div>

                  {/* Consumos de Almacen */}
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase block mb-1">
                      Descuento Consolidado de Insumos:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {venta.insumosDescontados.map((ins, idz) => (
                        <div key={idz} className="bg-white p-2 rounded-lg border border-slate-100 text-[11px] flex items-center justify-between">
                          <span className="text-slate-600 font-medium truncate">{ins.insumoNombre}</span>
                          <span className="font-mono font-bold text-rose-600 shrink-0">
                            -{ins.cantidadDescontada.toFixed(2)} {ins.unidad}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Panel Informativo Lateral: Explicación de las recetas en cascada */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-display font-bold text-sm tracking-tight text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            CONCILIACIÓN EN CASCADA
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            El sistema ejecuta un algoritmo de <strong>descuento directo en cascada</strong> sobre cada ingrediente de manera simultánea al ingresar un lote de comandas.
          </p>

          <div className="space-y-4 text-xs pt-2">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 bg-sky-900/60 text-sky-400 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] border border-sky-800">
                1
              </span>
              <div>
                <strong className="text-slate-200 font-semibold block">Lectura de Recetas</strong>
                <span className="text-slate-400 block mt-0.5">
                  Se localizan los componentes unitarios registrados de cada platillo solicitado.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 bg-sky-900/60 text-sky-400 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] border border-sky-800">
                2
              </span>
              <div>
                <strong className="text-slate-200 font-semibold block">Multiplicación Masiva</strong>
                <span className="text-slate-400 block mt-0.5">
                  Multiplica el coeficiente de cada ingrediente por el número de ventas cargadas en el archivo.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 bg-sky-900/60 text-sky-400 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] border border-sky-800">
                3
              </span>
              <div>
                <strong className="text-slate-200 font-semibold block">Deducción de Stock (A)</strong>
                <span className="text-slate-400 block mt-0.5">
                  Resta el total neto de forma atómica del <strong>Stock Teorico (A)</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 bg-sky-900/60 text-sky-400 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] border border-sky-800">
                4
              </span>
              <div>
                <strong className="text-slate-200 font-semibold block">Disparo de Alertas</strong>
                <span className="text-slate-400 block mt-0.5 text-amber-300">
                  Evalúa instantáneamente si algún insumo descendió por debajo de su punto de reorden e inicia la alerta para el almacén.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl flex items-center gap-2 text-xs" hidden>
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300">
              Prueba cargando el <strong>Simulador</strong> para ver el descuento instantáneo de Kg y Litros de todos los insumos a la vez.
            </span>
          </div>

        </div>
      </div>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-sky-400" />
                  Confirmar Carga de Ventas
                </h3>
                <button
                  onClick={handleCancelUpload}
                  className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs text-slate-650">
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-900 font-bold block">Acción Requerida</strong>
                    <span className="text-amber-800 leading-relaxed block mt-0.5">
                      ¿Está de acuerdo en procesar el archivo de ventas <strong>{pendingFileName}</strong>?
                      Esta acción realizará el descuento masivo de todos los insumos correspondientes del <strong>Stock del Sistema (A)</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-650 hover:bg-slate-50 transition font-semibold cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUpload}
                    className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl transition font-semibold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    Sí, Procesar Ventas
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
