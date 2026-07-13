import { Insumo, AlertaAlmacen } from '../types';

export function calcularVariacion(stockSistema: number, stockFisico: number): number {
  if (stockSistema === 0) return 0;
  return ((stockFisico - stockSistema) / stockSistema) * 100;
}

export function obtenerLimitesTolerancia(stockSistema: number, toleranciaPct: number) {
  const min = stockSistema * (1 - toleranciaPct / 100);
  const max = stockSistema * (1 + toleranciaPct / 100);
  return { min, max };
}

export type EstadoTolerancia = 'dentro' | 'alerta' | 'critico';

export function determinarEstadoTolerancia(variacionPct: number, toleranciaPct: number): EstadoTolerancia {
  const absVar = Math.abs(variacionPct);
  if (absVar <= toleranciaPct) {
    return 'dentro';
  } else if (absVar > toleranciaPct && absVar <= toleranciaPct * 2) {
    return 'alerta';
  } else {
    return 'critico';
  }
}

/**
 * Recalcula las alertas para toda la lista de insumos
 */
export function generarAlertasParaInsumos(insumos: Insumo[], alertasAnteriores: AlertaAlmacen[] = []): AlertaAlmacen[] {
  const nuevasAlertas: AlertaAlmacen[] = [];
  const fechaStr = new Date().toISOString();

  insumos.forEach((insumo) => {
    // 1. Alerta de reorden (desabasto crítico)
    if (insumo.stockSistema <= insumo.puntoReorden) {
      // Evitamos duplicar si ya existe una alerta activa (no leída) del mismo tipo para este insumo
      const yaExiste = alertasAnteriores.some(
        (a) => a.insumoId === insumo.id && a.tipo === 'critico_reorden' && !a.leido
      );
      if (!yaExiste) {
        nuevasAlertas.push({
          id: `reorden-${insumo.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: fechaStr,
          insumoId: insumo.id,
          insumoNombre: insumo.nombre,
          tipo: 'critico_reorden',
          mensaje: `⚠️ Punto de reorden alcanzado. Stock de ${insumo.nombre} (${insumo.stockSistema.toFixed(2)} ${insumo.unidad}) está por debajo de ${insumo.puntoReorden.toFixed(2)} ${insumo.unidad}. ¡Reabastecer de inmediato!`,
          valorActual: insumo.stockSistema,
          leido: false,
        });
      }
    }

    // 2. Alerta de sobreinventario
    if (insumo.stockSistema > insumo.capacidadMaxima) {
      const yaExiste = alertasAnteriores.some(
        (a) => a.insumoId === insumo.id && a.tipo === 'sobreinventario' && !a.leido
      );
      if (!yaExiste) {
        nuevasAlertas.push({
          id: `sobreinv-${insumo.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: fechaStr,
          insumoId: insumo.id,
          insumoNombre: insumo.nombre,
          tipo: 'sobreinventario',
          mensaje: `📈 Exceso de inventario para ${insumo.nombre}. El stock actual (${insumo.stockSistema.toFixed(2)} ${insumo.unidad}) supera la capacidad máxima de ${insumo.capacidadMaxima.toFixed(2)} ${insumo.unidad}.`,
          valorActual: insumo.stockSistema,
          leido: false,
        });
      }
    }

    // 3. Alertas de tolerancia (comparación físico vs sistema)
    const varPct = calcularVariacion(insumo.stockSistema, insumo.stockFisico);
    const estadoTol = determinarEstadoTolerancia(varPct, insumo.toleranciaPct);

    if (estadoTol === 'alerta') {
      const yaExiste = alertasAnteriores.some(
        (a) => a.insumoId === insumo.id && a.tipo === 'fuera_tolerancia_alerta' && !a.leido
      );
      if (!yaExiste) {
        nuevasAlertas.push({
          id: `tol-alerta-${insumo.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: fechaStr,
          insumoId: insumo.id,
          insumoNombre: insumo.nombre,
          tipo: 'fuera_tolerancia_alerta',
          mensaje: `⚠️ Desviación detectada: ${insumo.nombre} está fuera del rango de tolerancia por ±${varPct.toFixed(2)}% (Físico: ${insumo.stockFisico} vs Sistema: ${insumo.stockSistema}).`,
          valorActual: varPct,
          leido: false,
        });
      }
    } else if (estadoTol === 'critico') {
      const yaExiste = alertasAnteriores.some(
        (a) => a.insumoId === insumo.id && a.tipo === 'fuera_tolerancia_critico' && !a.leido
      );
      if (!yaExiste) {
        nuevasAlertas.push({
          id: `tol-critico-${insumo.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: fechaStr,
          insumoId: insumo.id,
          insumoNombre: insumo.nombre,
          tipo: 'fuera_tolerancia_critico',
          mensaje: `🚨 Desviación CRÍTICA en ${insumo.nombre}: variación del ${varPct.toFixed(2)}% supera el límite tolerable (Límite: ±${insumo.toleranciaPct}%). Requiere auditoría inmediata.`,
          valorActual: varPct,
          leido: false,
        });
      }
    }
  });

  return [...nuevasAlertas, ...alertasAnteriores];
}
