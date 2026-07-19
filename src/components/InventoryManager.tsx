import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Edit2, AlertCircle, CheckCircle2, XCircle,
  RefreshCcw, Calculator, Info, Settings, HelpCircle, Save, Trash2, ArrowUpDown,
  Upload, Download, FileSpreadsheet
} from 'lucide-react';
import { Insumo } from '../types';
import { calcularVariacion, determinarEstadoTolerancia } from '../utils/stockUtils';

interface InventoryManagerProps {
  insumos: Insumo[];
  onUpdateInsumo: (insumo: Insumo) => void;
  onAddInsumo: (insumo: Omit<Insumo, 'id'>) => void;
  onDeleteInsumo: (id: string) => void;
  filtroEstado: string; // 'todos', 'dentro', 'alerta', 'critico', 'reorden'
  setFiltroEstado: (estado: string) => void;
  apiUrl: string;
  onPhysicalCountUploaded: (message: string) => void;
}

export default function InventoryManager({
  insumos,
  onUpdateInsumo,
  onAddInsumo,
  onDeleteInsumo,
  filtroEstado,
  setFiltroEstado,
  apiUrl,
  onPhysicalCountUploaded,
}: InventoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempFisico, setTempFisico] = useState<{ [key: string]: string }>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showPhysicalCountModal, setShowPhysicalCountModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [dragActiveBulk, setDragActiveBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<{ row: number; sku: string; message: string }[]>([]);

  // States for adding a new ingredient
  const [newNombre, setNewNombre] = useState('');
  const [newUnidad, setNewUnidad] = useState('Kg');
  const [newStockSistema, setNewStockSistema] = useState(10);
  const [newStockFisico, setNewStockFisico] = useState(10);
  const [newTolerancia, setNewTolerancia] = useState(5);
  const [newReorden, setNewReorden] = useState(3);
  const [newCapacidad, setNewCapacidad] = useState(25);

  const [paramEditingInsumo, setParamEditingInsumo] = useState<Insumo | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtroEstado]);

  // Filtering list
  const filteredInsumos = insumos.filter((insumo) => {
    const matchesSearch = insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase());

    const sysQty = insumo.quantity ?? insumo.stockSistema;
    const varPct = calcularVariacion(sysQty, insumo.conteo ?? insumo.stockFisico);
    const estado = determinarEstadoTolerancia(varPct, insumo.toleranciaPct);
    const esBajoReorden = sysQty <= insumo.puntoReorden;

    if (filtroEstado === 'todos') return matchesSearch;
    if (filtroEstado === 'dentro') return matchesSearch && estado === 'dentro';
    if (filtroEstado === 'alerta') return matchesSearch && estado === 'alerta';
    if (filtroEstado === 'critico') return matchesSearch && estado === 'critico';
    if (filtroEstado === 'reorden') return matchesSearch && esBajoReorden;

  });

  const totalPages = Math.ceil(filteredInsumos.length / itemsPerPage);
  const paginatedInsumos = filteredInsumos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleUpdateFisico = (id: string) => {
    const value = tempFisico[id];
    if (value === undefined || isNaN(parseFloat(value))) {
      setEditingId(null);
      return;
    }
    const target = insumos.find(i => i.id === id);
    if (target) {
      onUpdateInsumo({
        ...target,
        conteo: Math.round(parseFloat(value)),
      });
    }
    setEditingId(null);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;

    onAddInsumo({
      nombre: newNombre.trim(),
      unidad: newUnidad,
      stockSistema: Number(newStockSistema),
      stockFisico: Number(newStockFisico),
      toleranciaPct: Number(newTolerancia),
      puntoReorden: Number(newReorden),
      capacidadMaxima: Number(newCapacidad),
    });

    // Reset values
    setNewNombre('');
    setNewUnidad('Kg');
    setNewStockSistema(10);
    setNewStockFisico(10);
    setNewTolerancia(5);
    setNewReorden(3);
    setNewCapacidad(25);
    setShowAddModal(false);
  };

  const openParamEditor = (insumo: Insumo) => {
    setParamEditingInsumo(insumo);
  };

  const saveParams = (e: React.FormEvent) => {
    e.preventDefault();
    if (paramEditingInsumo) {
      onUpdateInsumo(paramEditingInsumo);
      setParamEditingInsumo(null);
    }
  };

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
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/inventory/upload-physical-count`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      onPhysicalCountUploaded(result.message || "Se actualizó el inventario correctamente.");
      setFile(null);
      setShowPhysicalCountModal(false);
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al subir el archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragBulk = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveBulk(true);
    } else if (e.type === "dragleave") {
      setDragActiveBulk(false);
    }
  };

  const handleDropBulk = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveBulk(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setBulkFile(e.dataTransfer.files[0]);
    }
  };

  const handleChangeBulk = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setBulkFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setIsBulkUploading(true);
    setBulkErrors([]);
    const formData = new FormData();
    formData.append("file", bulkFile);

    try {
      const res = await fetch(`${apiUrl}/inventory/bulk/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok || result.success === false) {
        if (result.errors && Array.isArray(result.errors)) {
          setBulkErrors(result.errors);
        } else {
          setBulkErrors([{ row: 0, sku: "N/A", message: result.message || "Error al procesar el archivo." }]);
        }
      } else {
        onPhysicalCountUploaded(result.message || `Carga masiva procesada: ${result.insertedCount || 0} creados, ${result.updatedCount || 0} actualizados.`);
        setBulkFile(null);
        setBulkErrors([]);
        setShowBulkAddModal(false);
      }
    } catch (err) {
      console.error(err);
      setBulkErrors([{ row: 0, sku: "N/A", message: "Ocurrió un error de red o de comunicación con el servidor." }]);
    } finally {
      setIsBulkUploading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Controles de búsqueda y filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
            id="input-buscar-insumo"
          />
        </div>

        {/* Quick state filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-400 mr-1 hidden md:inline">Ver:</span>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'dentro', label: 'Dentro del Rango' },
            { key: 'alerta', label: 'Fuera de Rango (Alerta)' },
            { key: 'critico', label: 'Fuera de Rango (Crítico)' },
            { key: 'reorden', label: 'Reorden Crítico' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltroEstado(f.key)}
              id={`filtro-estado-${f.key}`}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${filtroEstado === f.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowPhysicalCountModal(true)}
            id="btn-conteo-fisico"
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            Actualizar Stock Físico
          </button>

          <button
            onClick={() => setShowBulkAddModal(true)}
            id="btn-carga-masiva-insumos"
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Insumos
          </button>
        </div>

      </div>

      {/* Tabla de Rango de Tolerancia por Producto */}
      <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">

        {/* Header de la Sección (Estilo del diagrama de usuario) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 gap-3">
          <div>
            <h2 className="text-lg font-display font-semibold tracking-tight">
              RANGOS DE TOLERANCIA POR PRODUCTO
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare el stock físico real (conteo) vs el stock lógico del sistema en tiempo real.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="text-xs bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700 hover:border-sky-500/50 transition px-3 py-1.5 rounded-lg flex items-center gap-1 font-mono"
              id="btn-ver-formula-calculo"
            >
              <Calculator className="w-3.5 h-3.5" />
              Fórmula de Cálculo
            </button>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-mono font-bold tracking-wider uppercase border-b border-slate-100">
                <th className="py-4 px-6">Producto</th>
                <th className="py-4 px-4 text-center">Unidad</th>
                <th className="py-4 px-4 text-right">Stock del Sistema (A)</th>
                <th className="py-4 px-4 text-center">Rango Tolerancia Recomendado</th>
                <th className="py-4 px-4 text-right bg-slate-50/50">Stock Físico Contado (B)</th>
                <th className="py-4 px-4 text-right">Diferencia (B - A)</th>
                <th className="py-4 px-4 text-right">% Variación</th>
                <th className="py-4 px-6 text-center">Estado</th>
                <th className="py-4 px-4 text-center">Ajustes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <AnimatePresence initial={false}>
                {filteredInsumos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <p className="font-medium text-slate-500 text-xs">No se encontraron insumos</p>
                        <p className="text-slate-400 text-xs">Prueba cambiando los filtros o agrega un insumo nuevo.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedInsumos.map((insumo) => {
                    const sysQty = insumo.quantity ?? insumo.stockSistema;
                    const varPct = calcularVariacion(sysQty, insumo.conteo ?? insumo.stockFisico);
                    const diff = (insumo.conteo ?? insumo.stockFisico) - sysQty;
                    const min = insumo.stockSistema;
                    const max = insumo.capacidadMaxima;
                    const estado = determinarEstadoTolerancia(varPct, insumo.toleranciaPct);
                    const esBajoReorden = sysQty <= insumo.puntoReorden;
                    const esSobreInventario = sysQty > insumo.capacidadMaxima;

                    return (
                      <motion.tr
                        key={insumo.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`hover:bg-slate-50/50 transition duration-150 ${esBajoReorden ? 'bg-amber-50/20' : ''
                          }`}
                        id={`fila-insumo-${insumo.id}`}
                      >
                        {/* Producto */}
                        <td className="py-3 px-6 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span className="text-sm font-sans font-semibold">{insumo.nombre}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {esBajoReorden && (
                                <span className="text-[10px] uppercase font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Punto de Reorden: &le; {Math.round(insumo.puntoReorden)}
                                </span>
                              )}
                              {esSobreInventario && (
                                <span className="text-[10px] uppercase font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                                  Exceso: Max {Math.round(insumo.capacidadMaxima)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Unidad */}
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">
                          {insumo.unidad}
                        </td>

                        {/* Stock del Sistema (A) */}
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                          {insumo.quantity}
                        </td>

                        {/* Rango de Tolerancia */}
                        <td className="py-3 px-4 text-center text-xs">
                          <div className="inline-flex items-center gap-1 font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-150">
                            <span className="font-semibold text-slate-600">{Math.round(Number(min))}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-semibold text-slate-600">{Math.round(Number(max))}</span>
                            <span className="text-[10px] text-slate-400 font-sans ml-1">(&plusmn;{insumo.toleranciaPct}%)</span>
                          </div>
                        </td>

                        {/* Stock Físico Contado (B) */}
                        <td className="py-3 px-4 text-right bg-slate-50/30">
                          {insumo.conteo}
                        </td>

                        {/* Diferencia (B - A) */}
                        <td className={`py-3 px-4 text-right font-mono font-medium ${diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                          {diff > 0 ? `+${Math.round(diff)}` : Math.round(diff)}
                        </td>

                        {/* % Variación */}
                        <td className={`py-3 px-4 text-right font-mono font-bold ${estado === 'dentro' ? 'text-emerald-600' : estado === 'alerta' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                          {varPct > 0 ? `+${varPct.toFixed(2)}%` : `${varPct.toFixed(2)}%`}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-6 text-center">
                          {estado === 'dentro' ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white border border-emerald-700 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              DENTRO DEL RANGO
                            </span>
                          ) : estado === 'alerta' ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500 text-amber-950 border border-amber-600 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-950" />
                              FUERA DEL RANGO (ALERTA)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white border border-rose-700 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                              <XCircle className="w-3.5 h-3.5 text-white" />
                              FUERA DEL RANGO (CRÍTICO)
                            </span>
                          )}
                        </td>

                        {/* Ajustes / Editar parámetros */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openParamEditor(insumo)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition cursor-pointer"
                              title="Configurar tolerancias y alertas"
                              id={`btn-configurar-insumo-${insumo.id}`}
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteInsumo(insumo.id)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Eliminar insumo"
                              id={`btn-eliminar-insumo-${insumo.id}`}
                            >
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div>
              Mostrando <span className="font-semibold text-slate-800">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredInsumos.length)}</span> de <span className="font-semibold text-slate-800">{filteredInsumos.length}</span> insumos
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition cursor-pointer ${currentPage === 1
                  ? 'bg-slate-100 text-slate-400 border-slate-150 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 hover:text-slate-900 text-slate-600 shadow-sm'
                  }`}
              >
                Anterior
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg font-bold transition cursor-pointer flex items-center justify-center ${currentPage === pageNum
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'hover:bg-slate-200 text-slate-600'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition cursor-pointer ${currentPage === totalPages
                  ? 'bg-slate-100 text-slate-400 border-slate-150 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 hover:text-slate-900 text-slate-600 shadow-sm'
                  }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Nota del pie de la tabla similar a la de la imagen */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 text-primary-500 shrink-0" />
          <span>
            <strong>Nota:</strong> Los rangos recomendados son de <strong>&plusmn;0% hasta &plusmn;5%</strong> para optimizar control, y <strong>exceder el &plusmn;10%</strong> es considerado crítico requiriendo revisión de mermas e inventario físico de inmediato.
          </span>
        </div>

      </div>

      {/* Bloque de Información Complementaria (Del diagrama) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Recomendaciones de rango */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
            RANGOS DE TOLERANCIA RECOMENDADOS
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="text-emerald-900">DENTRO DEL RANGO (&plusmn;0% hasta &plusmn;5%)</strong>
                <p className="text-slate-600 mt-0.5">La variación está dentro del rango establecido. Flujo de cocina e inventario estable.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="text-amber-900">FUERA DEL RANGO / ALERTA (&gt; &plusmn;5% hasta &plusmn;10%)</strong>
                <p className="text-slate-600 mt-0.5">La variación excede el rango tolerable. Se recomienda un pre-conteo de validación.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong className="text-rose-900">FUERA DEL RANGO / CRÍTICO (&gt; &plusmn;10%)</strong>
                <p className="text-slate-600 mt-0.5">La variación es significativa, requiere revisión inmediata de comandas, mermas o fugas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Beneficios del sistema */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
            BENEFICIOS DEL CONTROL DE TOLERANCIAS
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { title: 'Mayor precisión de inventario', desc: 'Evita descuadres entre físico y lógico.' },
              { title: 'Detección de diferencias', desc: 'Identifica robo hormiga, mermas o descuidos de porciones.' },
              { title: 'Reducción de pérdidas', desc: 'Menor caducidad de insumos al ajustar las compras.' },
              { title: 'Control de compras y costos', desc: 'Adquisición de insumos basada en consumos empíricos reales.' },
              { title: 'Toma de decisiones efectiva', desc: 'Informes exactos del valor real de los almacenes.' },
              { title: 'Control en tiempo real', desc: 'Notifica al almacén de reórdenes inmediatos por receta.' },
            ].map((b, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-900 block">{b.title}</span>
                <span className="text-slate-500 mt-0.5 block">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL: Agregar nuevo Insumo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-base">Nuevo Insumo de Cocina</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleQuickAdd} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nombre del Insumo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carne de Res, Queso Mozzarella"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="form-add-nombre"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unidad de Medida</label>
                  <select
                    value={newUnidad}
                    onChange={(e) => setNewUnidad(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white"
                    id="form-add-unidad"
                  >
                    <option value="Kg">Kilogramo (Kg)</option>
                    <option value="L">Litro (L)</option>
                    <option value="Unidades">Unidades (Pzas)</option>
                    <option value="Gramos">Gramos (g)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tolerancia recomendada (&plusmn;%)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newTolerancia}
                    onChange={(e) => setNewTolerancia(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    id="form-add-tolerancia"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Stock del Sistema Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newStockSistema}
                    onChange={(e) => {
                      setNewStockSistema(Number(e.target.value));
                      // By default, equal physical count
                      setNewStockFisico(Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    id="form-add-stock-sistema"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Stock Físico Contado Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newStockFisico}
                    onChange={(e) => setNewStockFisico(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    id="form-add-stock-fisico"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Punto Reorden Crítico (Desabasto)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newReorden}
                    onChange={(e) => setNewReorden(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    id="form-add-punto-reorden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Capacidad Almacén (Máximo)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newCapacidad}
                    onChange={(e) => setNewCapacidad(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    id="form-add-capacidad-maxima"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-confirmar-add-insumo"
                  className="w-1/2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition font-medium shadow-sm cursor-pointer"
                >
                  Guardar Insumo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Configurar Parámetros del Insumo */}
      {paramEditingInsumo && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base">Configurar Tolerancias & Reorden</h3>
                <span className="text-xs text-sky-400 font-mono mt-0.5 block">{paramEditingInsumo.nombre}</span>
              </div>
              <button onClick={() => setParamEditingInsumo(null)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <form onSubmit={saveParams} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Porcentaje de Tolerancia Recomendado (&plusmn;%)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={paramEditingInsumo.toleranciaPct}
                  onChange={(e) => setParamEditingInsumo({ ...paramEditingInsumo, toleranciaPct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="form-edit-tolerancia"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Define el límite de variación aceptable entre el conteo físico y el sistema lógico.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Punto Crítico de Reorden ({paramEditingInsumo.unidad})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={paramEditingInsumo.puntoReorden}
                  onChange={(e) => setParamEditingInsumo({ ...paramEditingInsumo, puntoReorden: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="form-edit-punto-reorden"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Cuando el stock del sistema descienda de este valor, se notificará al almacén automáticamente.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Capacidad de Almacenamiento Máxima ({paramEditingInsumo.unidad})</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={paramEditingInsumo.capacidadMaxima}
                  onChange={(e) => setParamEditingInsumo({ ...paramEditingInsumo, capacidadMaxima: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="form-edit-capacidad-maxima"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Para emitir alertas de sobreinventario y evitar compras innecesarias.
                </span>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setParamEditingInsumo(null)}
                  className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-confirmar-edit-params"
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition font-medium shadow-sm cursor-pointer"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Explicación de la Fórmula */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-sky-400" />
                FÓRMULA DE CÁLCULO DE VARIACIÓN
              </h3>
              <button onClick={() => setShowFormulaModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl text-center space-y-2">
                <span className="text-xs font-mono font-bold text-sky-900 block uppercase">Fórmula Oficial</span>
                <p className="text-lg font-display font-bold text-sky-950 tracking-wide font-mono">
                  % Variación = <span className="border-b border-sky-900 pb-0.5">B - A</span> / A &times; 100
                </p>
                <div className="text-slate-600 text-xs text-left mt-3 space-y-1">
                  <p><strong>A</strong> = Stock registrado lógicamente en el sistema.</p>
                  <p><strong>B</strong> = Stock físico contado directamente en el almacén de cocina.</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-800 block">Ejemplo Práctico de Cálculo:</span>
                <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-mono text-slate-600">
                  <p>Si el sistema dice que tienes <strong>20.00 Kg de Tomate (A)</strong></p>
                  <p>Y al contarlo físicamente hay <strong>23.00 Kg (B)</strong>:</p>
                  <p className="text-slate-900 font-bold mt-1">Diferencia: 23.00 - 20.00 = +3.00 Kg</p>
                  <p className="text-slate-900 font-bold">% Variación: (3.00 / 20.00) &times; 100 = +15.00%</p>
                  <p className="text-rose-600 font-bold mt-1">Resultado: Fuera del Rango (&gt; &plusmn;10% es Crítico)</p>
                </div>
              </div>

              <button
                onClick={() => setShowFormulaModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* MODAL: Conteo Físico por Excel */}
      {showPhysicalCountModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100"
          >
            {/* Modal Header */}
            <div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                Carga Masiva de Conteo Físico
              </h3>
              <button
                onClick={() => {
                  setFile(null);
                  setShowPhysicalCountModal(false);
                }}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-xs text-slate-600">

              {/* Paso 1: Bajar Plantilla */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs block">1. Descargar Plantilla Oficial</span>
                <p className="text-slate-500">
                  Descarga el archivo Excel precargado con el catálogo de insumos actual y sus respectivos IDs. Modifica la columna **cantidad** con el conteo físico, y opcionalmente edita **stock_minimo** y **stock_maximo** para actualizar los límites de inventario.
                </p>
                <a
                  href={`${apiUrl}/inventory/template`}
                  download="plantilla_requisicion.xlsx"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-lg transition"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Descargar Plantilla Excel
                </a>
              </div>

              {/* Paso 2: Zona de Arrastrar Archivo */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs block">2. Cargar Excel con Conteos</span>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition ${dragActive
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : file
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                    }`}
                >
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleChange}
                    className="hidden"
                    id="excel-file-upload"
                  />
                  <label htmlFor="excel-file-upload" className="cursor-pointer space-y-2 block">
                    <div className="flex justify-center">
                      <FileSpreadsheet className={`w-10 h-10 ${file ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>
                    {file ? (
                      <div>
                        <p className="font-bold text-slate-800">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        <span className="text-[10px] text-emerald-600 font-medium underline mt-1 block">Arrastra otro archivo o haz clic para cambiar</span>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-700">Arrastra tu archivo Excel aquí</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">o haz clic para explorar en tu computadora</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Acciones */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setShowPhysicalCountModal(false);
                  }}
                  className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium cursor-pointer"
                  disabled={isUploading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className={`w-1/2 py-2.5 rounded-xl transition font-medium shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${!file || isUploading
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                >
                  {isUploading ? (
                    <>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Subir y Actualizar
                    </>
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Carga Masiva de Insumos vía Excel */}
      {showBulkAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="bg-indigo-950 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                Carga Masiva de Insumos (Catálogo)
              </h3>
              <button
                onClick={() => {
                  setBulkFile(null);
                  setBulkErrors([]);
                  setShowBulkAddModal(false);
                }}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-650 overflow-y-auto flex-1">

              {/* Paso 1: Descargar Plantillas */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs block">1. Descargar Plantilla Oficial</span>
                <p className="text-slate-500">
                  Las plantillas oficiales permiten la carga masiva afectando directamente las tablas de información principal (**inventory**), costos (**inventory_costs**) y existencias por almacén (**inventory_stock**). Utiliza la plantilla de **Registro** para crear nuevos insumos masivamente o la plantilla de **Actualización** para modificar el catálogo existente.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={`${apiUrl}/inventory/bulk/template-register`}
                    download="plantilla_registro_insumos.xlsx"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-750 font-semibold rounded-lg transition"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    Plantilla Registro (Nuevos)
                  </a>
                  <a
                    href={`${apiUrl}/inventory/bulk/template-update`}
                    download="plantilla_actualizacion_insumos.xlsx"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-lg transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    Plantilla Actualización (Modificar)
                  </a>
                </div>
              </div>

              {/* Paso 2: Zona de Arrastrar Archivo */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs block">2. Seleccionar o Arrastrar Archivo Excel</span>
                <div
                  onDragEnter={handleDragBulk}
                  onDragOver={handleDragBulk}
                  onDragLeave={handleDragBulk}
                  onDrop={handleDropBulk}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition ${dragActiveBulk
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : bulkFile
                      ? 'border-indigo-300 bg-indigo-50/10'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                    }`}
                >
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleChangeBulk}
                    className="hidden"
                    id="bulk-excel-file-upload"
                  />
                  <label htmlFor="bulk-excel-file-upload" className="cursor-pointer space-y-2 block">
                    <div className="flex justify-center">
                      <FileSpreadsheet className={`w-10 h-10 ${bulkFile ? 'text-indigo-500' : 'text-slate-400'}`} />
                    </div>
                    {bulkFile ? (
                      <div>
                        <p className="font-bold text-slate-800">{bulkFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(bulkFile.size / 1024).toFixed(1)} KB</p>
                        <span className="text-[10px] text-indigo-600 font-medium underline mt-1 block">Arrastra otro archivo o haz clic para cambiar</span>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-700">Arrastra tu archivo Excel aquí</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">o haz clic para explorar en tu computadora</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Warnings and Errors List (Real-time Feedback) */}
              {bulkErrors.length > 0 && (
                <div className="space-y-2 border border-rose-100 bg-rose-50/50 p-4 rounded-xl max-h-48 overflow-y-auto">
                  <h4 className="font-bold text-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Se detectaron {bulkErrors.length} observaciones en el archivo:
                  </h4>
                  <ul className="space-y-2 divide-y divide-rose-100/50 font-mono text-[11px] text-rose-700">
                    {bulkErrors.map((err, idx) => (
                      <li key={idx} className="pt-2 first:pt-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded text-[10px]">
                            Fila {err.row}
                          </span>
                          {err.sku && err.sku !== 'N/A' && (
                            <span className="font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              SKU: {err.sku}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-slate-650 font-sans leading-normal">{err.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setBulkFile(null);
                  setBulkErrors([]);
                  setShowBulkAddModal(false);
                }}
                className="w-1/2 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium cursor-pointer"
                disabled={isBulkUploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={!bulkFile || isBulkUploading}
                className={`w-1/2 py-2.5 rounded-xl transition font-medium shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${!bulkFile || isBulkUploading
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-750 text-white shadow-md'
                  }`}
              >
                {isBulkUploading ? (
                  <>
                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    Procesando Catálogo...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Procesar y Cargar
                  </>
                )}
              </button>
            </div>

          </motion.div>
        </div>
      )}

    </div>
  );
}
