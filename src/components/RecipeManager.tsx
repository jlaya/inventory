import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Utensils, BookOpen, Plus, Trash2, Edit2, Check, AlertTriangle, Info, Sparkles
} from 'lucide-react';
import { Insumo, Receta, RecetaIngrediente } from '../types';

interface RecipeManagerProps {
  apiUrl: string;
  recetas: Receta[];
  insumos: Insumo[];
  onRefreshRecetas: () => void;
}

export default function RecipeManager({
  apiUrl,
  recetas,
  insumos,
  onRefreshRecetas,
}: RecipeManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRecetaId, setEditingRecetaId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4;

  // List of added components for the recipe being created
  const [selectedIngredientes, setSelectedIngredientes] = useState<RecetaIngrediente[]>([]);
  const [currentInsumoId, setCurrentInsumoId] = useState('');
  const [currentCantidad, setCurrentCantidad] = useState('');

  // Helper to resolve ingredient details
  const getInsumoDetails = (id: string) => {
    return insumos.find((i) => i.id === id);
  };

  const handleAddIngredientToRecipe = () => {
    if (!currentInsumoId || !currentCantidad || isNaN(parseFloat(currentCantidad))) return;

    const qty = parseFloat(currentCantidad);
    if (qty <= 0) return;

    // Check if already exists, then update or add
    const index = selectedIngredientes.findIndex((item) => item.insumoId === currentInsumoId);
    if (index > -1) {
      const updated = [...selectedIngredientes];
      updated[index].cantidad = qty;
      setSelectedIngredientes(updated);
    } else {
      setSelectedIngredientes([...selectedIngredientes, { insumoId: currentInsumoId, cantidad: qty }]);
    }

    setCurrentInsumoId('');
    setCurrentCantidad('');
  };

  const handleRemoveIngredientFromRecipe = (id: string) => {
    setSelectedIngredientes(selectedIngredientes.filter((item) => item.insumoId !== id));
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || selectedIngredientes.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('name', nombre.trim());
      formData.append('categorie', descripcion.trim());
      // Generating code for creation, or S/C on edit
      formData.append('code', isEditMode ? 'S/C' : `REC-${Date.now().toString().slice(-4)}`);

      // Map ingredients to backend schema items JSON
      const itemsPayload = selectedIngredientes.map((ing) => {
        const details = getInsumoDetails(ing.insumoId);
        return {
          inventory_id: Number(ing.insumoId),
          quantity: Number(ing.cantidad),
          unit: details?.unidad || 'Kg',
          name: details?.nombre || ''
        };
      });
      formData.append('items', JSON.stringify(itemsPayload));

      if (imageFile) {
        formData.append('image', imageFile);
      }

      let res;
      if (isEditMode && editingRecetaId) {
        res = await fetch(`${apiUrl}/ingredients/${editingRecetaId}`, {
          method: 'PATCH',
          body: formData,
        });
      } else {
        res = await fetch(`${apiUrl}/ingredients`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al procesar la solicitud en el servidor.');
      }

      alert(isEditMode ? '¡Receta actualizada con éxito!' : '¡Receta registrada con éxito!');

      // Reset form & state
      handleCloseForm();
      onRefreshRecetas();
    } catch (err: any) {
      console.error('Error saving recipe:', err);
      alert(`Error al guardar la receta: ${err.message}`);
    }
  };

  const handleStartEdit = (receta: Receta) => {
    setNombre(receta.nombre);
    setDescripcion(receta.descripcion);
    setEditingRecetaId(receta.id);
    setIsEditMode(true);
    setSelectedIngredientes(receta.ingredientes);

    if (receta.imagen && receta.imagen.startsWith('/')) {
      setPreviewUrl(`${apiUrl.replace(/\/api\/v1$/, '')}${receta.imagen}`);
    } else {
      setPreviewUrl(null);
    }
    setImageFile(null);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setNombre('');
    setDescripcion('');
    setImageFile(null);
    setPreviewUrl(null);
    setSelectedIngredientes([]);
    setIsEditMode(false);
    setEditingRecetaId(null);
    setShowAddForm(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de eliminar la receta "${name}" del menú?`)) {
      try {
        const res = await fetch(`${apiUrl}/ingredients/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'No se pudo eliminar la receta en el servidor.');
        }

        alert('Receta eliminada con éxito.');
        onRefreshRecetas();
      } catch (err: any) {
        console.error('Error deleting recipe:', err);
        alert(err.message || 'Error al intentar eliminar la receta.');
      }
    }
  };

  // Check how many portions of a recipe can be made based on current system stock
  const calcularPorcionesDisponibles = (receta: Receta): number => {
    let minPortions = Infinity;

    if (receta.ingredientes.length === 0) return 0;

    for (const ing of receta.ingredientes) {
      const insumo = getInsumoDetails(ing.insumoId);
      if (!insumo) return 0;
      const portions = Math.floor(insumo.stockSistema / ing.cantidad);
      if (portions < minPortions) {
        minPortions = portions;
      }
    }

    return minPortions === Infinity ? 0 : minPortions;
  };

  // Pagination calculations
  const totalRecipes = recetas.length;
  const totalPages = Math.ceil(totalRecipes / pageSize);
  const activePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const currentStartIndex = (activePage - 1) * pageSize;
  const paginatedRecipes = recetas.slice(currentStartIndex, currentStartIndex + pageSize);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Listado de Recetas */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5.5 h-5.5 text-primary-600" />
            <h2 className="text-lg font-display font-black bg-gradient-to-r from-primary-600 to-amber-500 bg-clip-text text-transparent tracking-tight">
              RECETARIO DE PLATILLOS ACTIVOS
            </h2>
          </div>
          <button
            onClick={() => {
              if (showAddForm) {
                handleCloseForm();
              } else {
                setShowAddForm(true);
              }
            }}
            id="btn-toggle-formulario-receta"
            className="text-xs font-semibold px-3.5 py-2 bg-gradient-to-r from-primary-600 to-amber-500 hover:from-primary-700 hover:to-amber-600 text-white rounded-xl shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cerrar Panel' : 'Crear Receta'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedRecipes.map((receta) => {
              const porciones = calcularPorcionesDisponibles(receta);
              return (
                <motion.div
                  key={receta.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl border border-slate-150 shadow-sm hover:shadow-md hover:border-amber-200/80 transition flex flex-col overflow-hidden"
                  id={`tarjeta-receta-${receta.id}`}
                >
                  {/* Image area (Full Top Width) */}
                  <div className="relative w-full h-36 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                    {receta.imagen && receta.imagen.startsWith('/') ? (
                      <img
                        src={`${apiUrl.replace(/\/api\/v1$/, '')}${receta.imagen}`}
                        alt={receta.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-4xl select-none">
                        {receta.imagen || '🍽️'}
                      </div>
                    )}

                    {/* Floating Action buttons */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-white/80 backdrop-blur-md px-1.5 py-1 rounded-xl shadow-sm border border-slate-200/50">
                      <button
                        onClick={() => handleStartEdit(receta)}
                        className="p-1 hover:bg-sky-50 text-slate-500 hover:text-sky-650 rounded-lg transition"
                        title="Editar receta"
                        id={`btn-editar-receta-${receta.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(receta.id, receta.nombre)}
                        className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition"
                        title="Eliminar receta"
                        id={`btn-eliminar-receta-${receta.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Information area (Bottom) */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-display font-bold text-slate-900 text-sm leading-tight">
                          {receta.nombre}
                        </h3>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          ID: {receta.id}
                        </span>
                      </div>

                      {/* Descripción */}
                      <p className="text-xs text-slate-550 font-sans leading-relaxed">
                        {receta.descripcion || 'Sin descripción disponible.'}
                      </p>
                    </div>

                    {/* Componentes / Ingredientes */}
                    <div className="bg-amber-50/20 p-3 rounded-xl border border-amber-100/40 space-y-2">
                      <span className="text-[9px] font-mono font-bold text-amber-700/85 uppercase tracking-wider block">
                        Ingredientes por porción:
                      </span>
                      <div className="space-y-1 text-xs">
                        {receta.ingredientes.map((ing) => {
                          const details = getInsumoDetails(ing.insumoId);
                          const esBajo = details ? details.stockSistema <= details.puntoReorden : false;
                          const noStock = details ? details.stockSistema < ing.cantidad : true;

                          return (
                            <div key={ing.insumoId} className="flex items-center justify-between">
                              <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                                {details ? details.nombre : 'Insumo desconocido'}
                                {noStock && (
                                  <span className="text-[8px] bg-rose-100 text-rose-800 font-bold px-0.5 rounded">
                                    Agotado
                                  </span>
                                )}
                                {!noStock && esBajo && (
                                  <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-0.5 rounded">
                                    Stock Bajo
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-slate-900 font-medium text-[11px]">
                                {ing.cantidad.toFixed(3)} {details?.unidad || 'unidades'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={activePage === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Anterior
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${activePage === pageNum
                      ? 'bg-gradient-to-r from-primary-600 to-amber-500 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-750 bg-white hover:bg-slate-50 hover:border-amber-200'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={activePage === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Panel de Creación / Editor */}
      <div className="lg:col-span-1">
        {showAddForm ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:border-amber-100/50 shadow-amber-50/10 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                <Utensils className="w-4 h-4 text-primary-650" />
                {isEditMode ? 'EDITAR RECETA' : 'NUEVA RECETA'}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${isEditMode ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-800'
                }`}>
                {isEditMode ? 'Modificar' : 'Creador'}
              </span>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4 text-xs">

              {/* Platillo */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nombre del Platillo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Suprema de Pollo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="recipe-form-nombre"
                />
              </div>

              {/* Imagen del platillo (File Upload) */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold mb-1">Imagen del Platillo</label>
                <div className="flex items-center gap-3">
                  {previewUrl ? (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setPreviewUrl(null);
                        }}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center text-[10px] font-bold opacity-0 hover:opacity-100 transition"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-semibold flex-shrink-0">
                      Sin Foto
                    </div>
                  )}
                  <label className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-white text-slate-700 rounded-xl border border-slate-250 hover:border-slate-350 shadow-sm hover:shadow transition cursor-pointer text-xs font-semibold text-center hover:bg-slate-50">
                    <span>{imageFile ? 'Cambiar imagen' : 'Subir imagen'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {imageFile && (
                  <span className="text-[10px] text-slate-500 block truncate max-w-[200px] mt-1 font-mono">
                    {imageFile.name}
                  </span>
                )}
              </div>

              {/* Breve Descripcion */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Breve Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción para el recetario..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  id="recipe-form-desc"
                />
              </div>

              {/* Sección Agregar Ingredientes */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <span className="font-bold text-slate-800 block">Agregar Elementos del Platillo:</span>

                <div className="flex gap-2 items-end">
                  <div className="w-1/2">
                    <label className="block text-slate-600 mb-1">Insumo Almacén</label>
                    <select
                      value={currentInsumoId}
                      onChange={(e) => setCurrentInsumoId(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white"
                      id="recipe-form-select-insumo"
                    >
                      <option value="">-- Seleccionar --</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-1/3">
                    <label className="block text-slate-600 mb-1">Cant. por Porción</label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.15"
                      value={currentCantidad}
                      onChange={(e) => setCurrentCantidad(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      id="recipe-form-insumo-qty"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIngredientToRecipe}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer"
                    title="Vincular insumo"
                    id="btn-vincular-insumo-receta"
                  >
                    <Check className="w-4 h-4 text-slate-700" />
                  </button>
                </div>

                {/* Lista de ingredientes agregados */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 max-h-48 overflow-y-auto">
                  {selectedIngredientes.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic block text-center py-2">
                      No hay ingredientes seleccionados aún.
                    </span>
                  ) : (
                    selectedIngredientes.map((item) => {
                      const insumo = getInsumoDetails(item.insumoId);
                      return (
                        <div key={item.insumoId} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <span className="font-medium text-slate-800 font-sans">
                            {insumo?.nombre || 'Desconocido'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-600">
                              {item.cantidad.toFixed(3)} {insumo?.unidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientFromRecipe(item.insumoId)}
                              className="text-rose-500 hover:text-rose-700 transition cursor-pointer text-sm font-bold"
                              title="Retirar"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botón de Guardar / Actualizar */}
              <div className="flex gap-2">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="w-1/3 py-2.5 border border-slate-250 hover:bg-slate-50 hover:border-amber-200 hover:text-amber-700 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={selectedIngredientes.length === 0}
                  className={`py-2.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm hover:shadow transition cursor-pointer ${isEditMode ? 'w-2/3 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600' : 'w-full bg-gradient-to-r from-primary-600 to-amber-500 hover:from-primary-700 hover:to-amber-600'
                    }`}
                  id="btn-confirmar-guardar-receta"
                >
                  {isEditMode ? 'Actualizar Receta' : 'Guardar e Integrar'}
                </button>
              </div>

            </form>
          </motion.div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-350 rounded-2xl p-6 text-center space-y-4" hidden>
            <Sparkles className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-display font-semibold text-slate-700 text-sm">¿Deseas agregar una nueva receta?</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Crea combinaciones de insumos precisas para que al simular o subir las ventas, el descuento masivo en el almacén sea instantáneo.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Comenzar a Crear
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
