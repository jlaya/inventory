import React from 'react';
import { motion } from 'motion/react';
import { 
  X, Bell, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, Trash2 
} from 'lucide-react';
import { AlertaAlmacen, Insumo } from '../types';

interface AlertNotificationsProps {
  alertas: AlertaAlmacen[];
  insumos: Insumo[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onRestock: (insumoId: string, cantidad: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function AlertNotifications({
  alertas,
  insumos,
  onMarkAsRead,
  onClearAll,
  onRestock,
  onClose,
  isOpen,
}: AlertNotificationsProps) {
  if (!isOpen) return null;

  const resolvedInsumo = (id: string) => {
    return insumos.find((i) => i.id === id);
  };

  const getAlertStyles = (tipo: string) => {
    switch (tipo) {
      case 'critico_reorden':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-900',
          icon: <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />,
          title: '⚠️ CRÍTICO: REORDEN REQUERIDO',
        };
      case 'fuera_tolerancia_critico':
        return {
          bg: 'bg-red-50 border-red-200 text-red-900',
          icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
          title: '🚨 MERMA CRÍTICA (FUERA DE RANGO)',
        };
      case 'fuera_tolerancia_alerta':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-900',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          title: '⚠️ DESVIACIÓN DE TOLERANCIA',
        };
      case 'sobreinventario':
        return {
          bg: 'bg-purple-50 border-purple-200 text-purple-900',
          icon: <TrendingUp className="w-5 h-5 text-purple-600 shrink-0" />,
          title: '📈 EXCESO DE STOCK',
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-900',
          icon: <Bell className="w-5 h-5 text-slate-600 shrink-0" />,
          title: 'NOTIFICACIÓN',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div 
          onClick={onClose} 
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        ></div>

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="pointer-events-auto w-screen max-w-md"
          >
            <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl border-l border-slate-100">
              
              {/* Header */}
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-sky-400" />
                  <h2 className="text-sm font-display font-bold uppercase tracking-wider" id="slide-over-title">
                    Notificaciones de Almacén
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {alertas.length > 0 && (
                    <button
                      onClick={onClearAll}
                      className="text-[10px] uppercase font-bold text-slate-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
                      title="Limpiar todas las alertas"
                      id="btn-limpiar-alertas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpiar
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none transition cursor-pointer"
                    id="btn-cerrar-drawer-notificaciones"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="flex-1 py-6 px-4 sm:px-6">
                {alertas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-10">
                    <div className="p-4 bg-emerald-50 rounded-full text-emerald-500 border border-emerald-150">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-800 text-sm">¡Almacenes Conciliados!</h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                      No hay desviaciones críticas de tolerancia, excesos de inventario ni insumos por debajo del punto de reorden. El restaurante funciona de forma óptima.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                      <span>Mostrando {alertas.length} alertas</span>
                      <span>Sesión Actual</span>
                    </div>

                    <div className="space-y-3">
                      {alertas.map((alerta) => {
                        const style = getAlertStyles(alerta.tipo);
                        const insumo = resolvedInsumo(alerta.insumoId);
                        
                        return (
                          <div
                            key={alerta.id}
                            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs shadow-xs transition duration-150 hover:shadow-sm ${style.bg} ${
                              alerta.leido ? 'opacity-60' : 'opacity-100'
                            }`}
                            id={`tarjeta-alerta-${alerta.id}`}
                          >
                            <div className="flex items-start gap-3">
                              {style.icon}
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold tracking-tight">{style.title}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {new Date(alerta.fecha).toLocaleTimeString('es-ES')}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">{alerta.mensaje}</p>
                              </div>
                            </div>

                            {/* Acciones para la alerta */}
                            <div className="flex items-center justify-end gap-2 border-t border-slate-200/55 pt-3">
                              {!alerta.leido && (
                                <button
                                  onClick={() => onMarkAsRead(alerta.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 font-medium transition cursor-pointer"
                                  id={`btn-marcar-leida-${alerta.id}`}
                                >
                                  Marcar leída
                                </button>
                              )}
                              
                              {/* Option to restock directly if it's a critical low-stock alert */}
                              {alerta.tipo === 'critico_reorden' && insumo && (
                                <button
                                  onClick={() => {
                                    // Restock up to capacity
                                    const amountNeeded = insumo.capacidadMaxima - insumo.stockSistema;
                                    onRestock(alerta.insumoId, amountNeeded);
                                    onMarkAsRead(alerta.id);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer"
                                  id={`btn-reabastecer-alerta-${alerta.id}`}
                                >
                                  Reabastecer Almacén
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
