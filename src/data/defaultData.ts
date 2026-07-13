import { Insumo, Receta } from '../types';

export const INSUMOS_INICIALES: Insumo[] = [
  {
    id: '1',
    nombre: 'Carne de Res',
    unidad: 'Kg',
    stockSistema: 50.00,
    stockFisico: 51.00,
    toleranciaPct: 5, // ±5%
    puntoReorden: 15.00, // Alerta reorden si stock <= 15
    capacidadMaxima: 80.00, // Alerta sobreinventario si stock > 80
  },
  {
    id: '2',
    nombre: 'Pechuga de Pollo',
    unidad: 'Kg',
    stockSistema: 30.00,
    stockFisico: 27.80,
    toleranciaPct: 5, // ±5%
    puntoReorden: 10.00,
    capacidadMaxima: 50.00,
  },
  {
    id: '3',
    nombre: 'Tomate',
    unidad: 'Kg',
    stockSistema: 20.00,
    stockFisico: 23.00,
    toleranciaPct: 10, // ±10%
    puntoReorden: 6.00,
    capacidadMaxima: 35.00,
  },
  {
    id: '4',
    nombre: 'Cebolla',
    unidad: 'Kg',
    stockSistema: 25.00,
    stockFisico: 24.60,
    toleranciaPct: 10, // ±10%
    puntoReorden: 8.00,
    capacidadMaxima: 40.00,
  },
  {
    id: '5',
    nombre: 'Aceite Vegetal',
    unidad: 'L',
    stockSistema: 10.00,
    stockFisico: 10.50,
    toleranciaPct: 10, // ±10%
    puntoReorden: 3.00,
    capacidadMaxima: 15.00,
  },
];

export const RECETAS_INICIALES: Receta[] = [
  {
    id: 'rec-1',
    nombre: 'Hamburguesa Especial',
    descripcion: 'Hamburguesa premium de res con rodajas de tomate y cebolla caramelizada.',
    imagen: '🍔',
    ingredientes: [
      { insumoId: '1', cantidad: 0.18 }, // 180g de Carne de Res
      { insumoId: '3', cantidad: 0.05 }, // 50g de Tomate
      { insumoId: '4', cantidad: 0.03 }, // 30g de Cebolla
    ],
  },
  {
    id: 'rec-2',
    nombre: 'Tacos de Pollo (Orden x3)',
    descripcion: 'Pechuga de pollo a la plancha picada, servida con tomate, cebolla picada y salteada en aceite.',
    imagen: '🌮',
    ingredientes: [
      { insumoId: '2', cantidad: 0.15 }, // 150g de Pechuga de Pollo
      { insumoId: '3', cantidad: 0.04 }, // 40g de Tomate
      { insumoId: '4', cantidad: 0.03 }, // 30g de Cebolla
      { insumoId: '5', cantidad: 0.01 }, // 10ml de Aceite Vegetal
    ],
  },
  {
    id: 'rec-3',
    nombre: 'Ensalada César con Pollo',
    descripcion: 'Clásica ensalada César acompañada de pechuga de pollo marinada y aderezo base aceite.',
    imagen: '🥗',
    ingredientes: [
      { insumoId: '2', cantidad: 0.12 }, // 120g de Pechuga de Pollo
      { insumoId: '3', cantidad: 0.06 }, // 60g de Tomate
      { insumoId: '5', cantidad: 0.015 }, // 15ml de Aceite Vegetal
    ],
  },
  {
    id: 'rec-4',
    nombre: 'Filete de Res de la Casa',
    descripcion: 'Filete de res de corte grueso salteado con cebollas en aceite de hierbas.',
    imagen: '🥩',
    ingredientes: [
      { insumoId: '1', cantidad: 0.25 }, // 250g de Carne de Res
      { insumoId: '4', cantidad: 0.04 }, // 40g de Cebolla
      { insumoId: '5', cantidad: 0.02 }, // 20ml de Aceite Vegetal
    ],
  },
];
