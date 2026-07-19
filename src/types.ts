export interface Insumo {
  id: string;
  nombre: string;
  unidad: string; // e.g., "Kg", "L", "Unidades"
  stockSistema: number; // Stock del sistema (A)
  stockFisico: number; // Stock físico contado (B)
  toleranciaPct: number; // Rango de tolerancia recomendado (e.g., 5 para ±5%, 10 para ±10%)
  puntoReorden: number; // Punto crítico de reorden (Notificación de desabasto)
  capacidadMaxima: number; // Capacidad para detectar sobreinventario
  quantity?: number; // Cantidad actual de stock en base de datos
  conteo?: number; // Cantidad física contada
}

export interface RecetaIngrediente {
  insumoId: string;
  cantidad: number; // Cantidad consumida por receta
}

export interface Receta {
  id: string;
  nombre: string;
  descripcion: string;
  imagen?: string;
  ingredientes: RecetaIngrediente[];
}

export interface VentaItem {
  recetaId: string;
  cantidad: number;
}

export interface HistorialVenta {
  id: string;
  fecha: string;
  items: {
    recetaNombre: string;
    cantidad: number;
  }[];
  insumosDescontados: {
    insumoNombre: string;
    cantidadDescontada: number;
    unidad: string;
    stockAnterior: number;
    stockNuevo: number;
  }[];
}

export interface AlertaAlmacen {
  id: string;
  fecha: string;
  insumoId: string;
  insumoNombre: string;
  tipo: 'critico_reorden' | 'fuera_tolerancia_alerta' | 'fuera_tolerancia_critico' | 'sobreinventario';
  mensaje: string;
  valorActual: number;
  leido: boolean;
}

export interface CompraItem {
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
  unidad: string;
}

export interface HistorialCompra {
  id: string; // OC-XXXX
  fecha: string;
  nombreArchivo: string;
  items: CompraItem[];
  insumosAgregados: {
    insumoNombre: string;
    cantidadAgregada: number;
    unidad: string;
    stockAnteriorSistema: number;
    stockNuevoSistema: number;
    stockAnteriorFisico: number;
    stockNuevoFisico: number;
  }[];
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  isActive?: boolean;
}

export interface User {
  id: number;
  name: string;
  userName: string;
  charge: string;
  avatar: string;
  status: boolean;
  roleId: number | null;
  warehouseId: number | null;
  warehouse?: Warehouse | null;
}


