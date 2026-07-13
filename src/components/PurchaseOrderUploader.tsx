import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, UploadCloud, CheckCircle, AlertCircle, 
  Download, History, Trash2, ChevronDown, ChevronUp, 
  TrendingUp, RefreshCw, FileCode, Check, ArrowRight, Package
} from 'lucide-react';
import { Insumo, CompraItem, HistorialCompra } from '../types';

interface PurchaseOrderUploaderProps {
  insumos: Insumo[];
  onUploadCompra: (items: CompraItem[], fileName: string) => void;
  historialCompras: HistorialCompra[];
  onLimpiarHistorial: () => void;
}

export default function PurchaseOrderUploader({
  insumos,
  onUploadCompra,
  historialCompras,
  onLimpiarHistorial
}: PurchaseOrderUploaderProps) {
  // --- STATE ---
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<CompraItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [expandedOrders, setExpandedOrders] = useState<{ [id: string]: boolean }>({});
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DRAG & DROP HANDLERS ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // --- FILE PROCESSING ENGINE ---
  const processFile = (file: File) => {
    setError(null);
    setParsedItems([]);
    setFileName(file.name);

    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setError('El archivo está vacío o no se pudo leer.');
        return;
      }

      try {
        if (fileExtension === 'json') {
          parseJSON(text);
        } else if (fileExtension === 'csv') {
          parseCSV(text);
        } else if (fileExtension === 'txt') {
          parseTXT(text);
        } else {
          setError('Formato de archivo no soportado. Suba un archivo .csv, .json, o .txt');
        }
      } catch (err: any) {
        setError(`Error al parsear el archivo: ${err.message || err}`);
      }
    };

    reader.onerror = () => {
      setError('Error al leer el archivo físico.');
    };

    reader.readAsText(file);
  };

  // --- PARSERS ---
  const parseJSON = (text: string) => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('El JSON debe ser un arreglo de objetos.');
    }

    const items: CompraItem[] = [];
    data.forEach((row: any, idx) => {
      const lookup = resolveInsumo(row.id || row.insumoId, row.nombre || row.insumoNombre);
      if (!lookup) return; // Skip unrecognized ingredients silently or add with a warning?

      const qty = parseFloat(row.cantidad || row.qty || row.monto);
      if (isNaN(qty) || qty <= 0) return;

      items.push({
        insumoId: lookup.id,
        insumoNombre: lookup.nombre,
        cantidad: qty,
        unidad: lookup.unidad
      });
    });

    if (items.length === 0) {
      throw new Error('No se encontraron insumos válidos en el archivo JSON.');
    }
    setParsedItems(items);
  };

  const parseCSV = (text: string) => {
    // Split lines
    const lines = text.split(/\r?\n/);
    if (lines.length < 1) {
      throw new Error('El archivo CSV no contiene líneas.');
    }

    const items: CompraItem[] = [];
    let headers: string[] = [];
    let startIdx = 0;

    // Detect headers
    if (lines[0].toLowerCase().includes('id') || lines[0].toLowerCase().includes('nombre') || lines[0].toLowerCase().includes('cantidad')) {
      headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',').map(c => c.trim());
      let idOrName = '';
      let cantidadStr = '';

      if (headers.length > 0) {
        const idColIdx = headers.findIndex(h => h.includes('id') || h.includes('codigo'));
        const nameColIdx = headers.findIndex(h => h.includes('nombre') || h.includes('insumo'));
        const qtyColIdx = headers.findIndex(h => h.includes('cantidad') || h.includes('cant') || h.includes('qty'));

        if (qtyColIdx !== -1 && columns[qtyColIdx]) {
          cantidadStr = columns[qtyColIdx];
        }

        if (idColIdx !== -1 && columns[idColIdx]) {
          idOrName = columns[idColIdx];
        } else if (nameColIdx !== -1 && columns[nameColIdx]) {
          idOrName = columns[nameColIdx];
        }
      } else {
        // Fallback: simple format Column 0 = ID or Name, Column 1 = Quantity
        if (columns.length >= 2) {
          idOrName = columns[0];
          cantidadStr = columns[1];
        }
      }

      if (!idOrName || !cantidadStr) continue;

      const lookup = resolveInsumo(idOrName, idOrName);
      if (!lookup) continue;

      const qty = parseFloat(cantidadStr);
      if (isNaN(qty) || qty <= 0) continue;

      items.push({
        insumoId: lookup.id,
        insumoNombre: lookup.nombre,
        cantidad: qty,
        unidad: lookup.unidad
      });
    }

    if (items.length === 0) {
      throw new Error('No se identificó ningún insumo o cantidad válida en el archivo CSV. Asegúrese de separar por comas.');
    }
    setParsedItems(items);
  };

  const parseTXT = (text: string) => {
    const lines = text.split(/\r?\n/);
    const items: CompraItem[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Handle common delimiters like colon (:) or equal (=)
      let separator = ':';
      if (!trimmed.includes(':') && trimmed.includes('=')) {
        separator = '=';
      } else if (!trimmed.includes(':') && trimmed.includes(',')) {
        separator = ',';
      }

      if (!trimmed.includes(separator)) return;

      const parts = trimmed.split(separator).map(p => p.trim());
      if (parts.length < 2) return;

      const idOrName = parts[0];
      const cantidadStr = parts[1];

      const lookup = resolveInsumo(idOrName, idOrName);
      if (!lookup) return;

      const qty = parseFloat(cantidadStr);
      if (isNaN(qty) || qty <= 0) return;

      items.push({
        insumoId: lookup.id,
        insumoNombre: lookup.nombre,
        cantidad: qty,
        unidad: lookup.unidad
      });
    });

    if (items.length === 0) {
      throw new Error('Formato TXT irreconocible. Use el formato "NombreInsumo: Cantidad" o descargue una plantilla.');
    }
    setParsedItems(items);
  };

  // Helper to find insumo by ID or by Name (case-insensitive fuzzy match)
  const resolveInsumo = (id?: string, name?: string): Insumo | null => {
    if (id) {
      const match = insumos.find(i => i.id.trim().toLowerCase() === id.trim().toLowerCase());
      if (match) return match;
    }
    if (name) {
      const cleanName = name.trim().toLowerCase();
      const match = insumos.find(i => i.nombre.trim().toLowerCase() === cleanName);
      if (match) return match;

      // Soft match: startsWith or contains
      const softMatch = insumos.find(i => 
        i.nombre.trim().toLowerCase().includes(cleanName) || 
        cleanName.includes(i.nombre.trim().toLowerCase())
      );
      if (softMatch) return softMatch;
    }
    return null;
  };

  // --- SUBMIT COMPRA ---
  const handleConfirmAbastecimiento = () => {
    if (parsedItems.length === 0) return;
    onUploadCompra(parsedItems, fileName || 'Orden de compra manual');
    
    // Reset state
    setParsedItems([]);
    setFileName('');
    setError(null);
  };

  const handleCancel = () => {
    setParsedItems([]);
    setFileName('');
    setError(null);
  };

  // --- TEMPLATE DOWNLOAD CREATOR ---
  const downloadTemplate = (format: 'csv' | 'json') => {
    let content = '';
    let mimeType = '';
    let fileExtension = '';

    if (format === 'csv') {
      content = 'id,nombre,cantidad_solicitada,unidad\n';
      insumos.forEach((ins) => {
        // Put a default purchase suggestion of capacity - current stock, or at least some default number like 50
        const defaultQty = Math.max(10, ins.capacidadMaxima - ins.stockSistema);
        content += `${ins.id},${ins.nombre},${defaultQty},${ins.unidad}\n`;
      });
      mimeType = 'text/csv;charset=utf-8;';
      fileExtension = 'csv';
    } else {
      const jsonArr = insumos.map((ins) => {
        const defaultQty = Math.max(10, ins.capacidadMaxima - ins.stockSistema);
        return {
          id: ins.id,
          nombre: ins.nombre,
          cantidad: defaultQty,
          unidad: ins.unidad
        };
      });
      content = JSON.stringify(jsonArr, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      fileExtension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OC_PLANTILLA_ALMACEN.${fileExtension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleOrderExpand = (id: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-8" id="purchase-order-uploader-container">
      {/* EXPLANATORY HEADER & DEMO INSTRUCTIONS */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Package className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-display font-semibold text-slate-800">
              Carga de Orden de Compra (OC)
            </h2>
          </div>
          <p className="text-slate-500 text-xs">
            Alimente el inventario de insumos del almacén subiendo un archivo de orden de compra en formato CSV, JSON o TXT. El sistema sumará el stock tanto lógico (sistema) como físico de forma automática.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => downloadTemplate('csv')}
            className="px-3.5 py-2 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            id="btn-download-csv-template"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Plantilla CSV
          </button>
          <button
            onClick={() => downloadTemplate('json')}
            className="px-3.5 py-2 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            id="btn-download-json-template"
          >
            <FileCode className="w-3.5 h-3.5" />
            Plantilla JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: UPLOADER CARD */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Panel de Carga
            </h3>

            {/* DRAG AND DROP ZONE */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition relative group ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
              }`}
              id="file-dropzone-purchase"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.json,.txt"
                onChange={handleFileChange}
              />

              <div className="p-3 bg-slate-50 text-slate-400 rounded-full mb-4 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition duration-300">
                <UploadCloud className="w-8 h-8" />
              </div>

              <p className="text-slate-700 font-semibold text-xs mb-1">
                Arrastre su Orden de Compra aquí
              </p>
              <p className="text-slate-400 text-[11px] mb-3">
                o haga clic para explorar sus archivos (.csv, .json, .txt)
              </p>

              <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50 border border-slate-150 px-2 py-1 rounded-md font-mono mt-2">
                <span>CSV</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>JSON</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>TXT</span>
              </div>
            </div>

            {/* ERROR PRESENTATION */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-700 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Error al interpretar</p>
                  <p className="text-red-600 leading-normal">{error}</p>
                </div>
              </motion.div>
            )}

            {/* MINI HELP GUIDE */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 text-slate-500 text-[11px] space-y-2">
              <p className="font-semibold text-slate-700 font-mono uppercase tracking-wider text-[10px]">
                Formatos rápidos aceptados:
              </p>
              <ul className="list-disc pl-4 space-y-1 leading-normal">
                <li>
                  <strong className="text-slate-600">CSV simple:</strong> Nombre,Cantidad (ej: <code className="bg-white border px-1 rounded">Harina, 50</code>)
                </li>
                <li>
                  <strong className="text-slate-600">TXT libre:</strong> Líneas clave-valor (ej: <code className="bg-white border px-1 rounded">Azúcar: 30</code>)
                </li>
                <li>
                  <strong className="text-slate-600">JSON estructurado:</strong> Lista con <code className="bg-white border px-1 rounded">id</code> o <code className="bg-white border px-1 rounded">nombre</code> y <code className="bg-white border px-1 rounded">cantidad</code>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CENTER & RIGHT COLUMN: PREVIEW & CONFIRMATION / HISTORY */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {parsedItems.length > 0 ? (
              /* VIEW 1: INTERPRETED PREVIEW AND CONFIRMATION */
              <motion.div
                key="preview-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Previsualización de Recepción
                    </h3>
                    <p className="text-slate-800 text-sm font-semibold mt-1 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      {fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-mono font-semibold bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5" />
                    {parsedItems.length} insumos detectados
                  </div>
                </div>

                {/* THE COMPARATOR TABLE (Before vs After) */}
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 font-mono text-[10px] text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Insumo</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Carga (+ OC)</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Proyección Stock (S / F)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {parsedItems.map((item, idx) => {
                        const original = insumos.find(i => i.id === item.insumoId);
                        const stockAntSis = original ? original.stockSistema : 0;
                        const stockAntFis = original ? original.stockFisico : 0;

                        const stockNueSis = stockAntSis + item.cantidad;
                        const stockNueFis = stockAntFis + item.cantidad;

                        return (
                          <tr key={`${item.insumoId}-${idx}`} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-800 block">
                                {item.insumoNombre}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                ID: {item.insumoId}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="px-2 py-0.5 bg-green-50 text-green-700 font-mono font-bold rounded-md text-xs">
                                +{item.cantidad} {item.unidad}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <div className="text-right">
                                  <span className="text-slate-400 line-through text-[10px] block">
                                    {stockAntSis} / {stockAntFis}
                                  </span>
                                  <span className="text-slate-800 font-semibold font-mono text-xs block">
                                    {stockNueSis} / {stockNueFis} <span className="text-[10px] text-slate-500 font-normal">{item.unidad}</span>
                                  </span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                                {original && stockNueSis > original.capacidadMaxima ? (
                                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded-sm shrink-0">
                                    Máx. Excedido
                                  </span>
                                ) : original && stockNueSis <= original.puntoReorden ? (
                                  <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 text-[9px] font-bold rounded-sm shrink-0">
                                    Reorden
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[9px] font-bold rounded-sm shrink-0">
                                    Óptimo
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* CONFIRM / CANCEL BUTTONS */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
                    id="btn-cancel-purchase"
                  >
                    Descartar Archivo
                  </button>
                  <button
                    onClick={handleConfirmAbastecimiento}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-100 transition cursor-pointer"
                    id="btn-confirm-purchase"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Abastecimiento
                  </button>
                </div>
              </motion.div>
            ) : (
              /* VIEW 2: HISTORIC LOGS LIST */
              <motion.div
                key="history-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Historial de Órdenes de Compra
                      </h3>
                    </div>
                    {historialCompras.length > 0 && (
                      <button
                        onClick={onLimpiarHistorial}
                        className="text-slate-400 hover:text-red-500 text-[11px] font-semibold flex items-center gap-1 hover:bg-red-50/50 px-2 py-1 rounded-lg transition cursor-pointer"
                        id="btn-clear-purchase-history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Limpiar Historial
                      </button>
                    )}
                  </div>

                  {historialCompras.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="p-3 bg-slate-50 rounded-full text-slate-350">
                        <History className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold">No se han registrado órdenes de compra</p>
                      <p className="text-[11px] text-slate-450 max-w-xs leading-relaxed">
                        Cargue un archivo en el panel izquierdo para abastecer los almacenes y visualizar el historial de transacciones.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                      {historialCompras.map((compra) => {
                        const isExpanded = !!expandedOrders[compra.id];
                        const totalCantidadInsumos = compra.items.reduce((sum, item) => sum + item.cantidad, 0);

                        return (
                          <div 
                            key={compra.id} 
                            className="border border-slate-100 hover:border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-xs transition"
                          >
                            {/* COLLAPSED BANNER TRIGGER */}
                            <div 
                              onClick={() => toggleOrderExpand(compra.id)}
                              className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/30 text-xs select-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-mono font-bold text-[10px]">
                                  {compra.id}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {compra.nombreArchivo}
                                  </p>
                                  <p className="text-[10px] text-slate-450 font-mono">
                                    {new Date(compra.fecha).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-semibold rounded text-[10px] block">
                                    +{totalCantidadInsumos.toFixed(1)} Unidades Totales
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {compra.items.length} insumos
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* EXPANDED SYSTEM SPECIFICS */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-slate-100 bg-slate-50/40 px-4 py-3"
                                >
                                  <div className="space-y-2">
                                    <h4 className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider mb-2">
                                      Detalle de Ingresos al Almacén
                                    </h4>
                                    <div className="divide-y divide-slate-100 bg-white border border-slate-150 rounded-lg overflow-hidden">
                                      {compra.insumosAgregados.map((item, idX) => (
                                        <div key={idX} className="px-3.5 py-2.5 flex justify-between items-center text-[11px]">
                                          <div>
                                            <span className="font-bold text-slate-700 block">
                                              {item.insumoNombre}
                                            </span>
                                            <span className="text-[9px] text-slate-450 font-mono">
                                              Stock Sistema: {item.stockAnteriorSistema} &rarr; {item.stockNuevoSistema} {item.unidad}
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <span className="font-mono text-green-600 font-bold block">
                                              +{item.cantidadAgregada} {item.unidad}
                                            </span>
                                            <span className="text-[9px] text-slate-450 font-mono">
                                              Físico: {item.stockAnteriorFisico} &rarr; {item.stockNuevoFisico} {item.unidad}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
