import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ClipboardCheck, Utensils, ShoppingBag, Bell,
  Layers, Package, AlertTriangle, ChevronRight, HelpCircle,
  Truck, CheckCircle2, Download, X, FileText
} from 'lucide-react';
import { io } from 'socket.io-client';


import { Insumo, Receta, VentaItem, HistorialVenta, AlertaAlmacen, CompraItem, HistorialCompra } from './types';
import { INSUMOS_INICIALES, RECETAS_INICIALES } from './data/defaultData';
import { calcularVariacion, determinarEstadoTolerancia, generarAlertasParaInsumos } from './utils/stockUtils';

// Components
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import InventoryManager from './components/InventoryManager';
import RecipeManager from './components/RecipeManager';
import SalesUploader from './components/SalesUploader';
import PurchaseOrderUploader from './components/PurchaseOrderUploader';
import AlertNotifications from './components/AlertNotifications';
import LandingPage from './components/LandingPage';
import AuditDashboard from './components/AuditDashboard';
import Login from './components/Login';
import ProductionOrder from './components/ProductionOrder';

export default function App() {
  // --- VIEW STATE ---
  const [view, setView] = useState<'landing' | 'admin'>('landing');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('rango_tolerancia_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('rango_tolerancia_token');
  });

  // --- SOCKET AUDIT STATE ---
  const [latestAudit, setLatestAudit] = useState<any>(null);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [latestRestockAudit, setLatestRestockAudit] = useState<any>(null);
  const [showRestockModal, setShowRestockModal] = useState<boolean>(false);
  const [isRestockingLoading, setIsRestockingLoading] = useState<boolean>(false);
  const socketRef = useRef<any>(null);



  // --- CORE STATE ---
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);

  const [recetas, setRecetas] = useState<Receta[]>([]);

  const [alertas, setAlertas] = useState<AlertaAlmacen[]>(() => {
    const saved = localStorage.getItem('rango_tolerancia_alertas');
    return saved ? JSON.parse(saved) : [];
  });

  const [historialVentas, setHistorialVentas] = useState<HistorialVenta[]>(() => {
    const saved = localStorage.getItem('rango_tolerancia_historial');
    return saved ? JSON.parse(saved) : [];
  });

  const [historialCompras, setHistorialCompras] = useState<HistorialCompra[]>(() => {
    const saved = localStorage.getItem('rango_tolerancia_compras');
    return saved ? JSON.parse(saved) : [];
  });

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<'tolerancia' | 'recetas' | 'ventas' | 'compras' | 'auditoria' | 'orden_produccion'>('tolerancia');
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // --- TOAST NOTIFICATIONS ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handlePhysicalCountUploaded = (message: string) => {
    showToast(message, 'success');
    fetchInsumos();
  };

  // --- API base URL logic ---
  const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_APP_API_URL || 'http://localhost:3000';
    if (envUrl.endsWith('/api/v1')) {
      return envUrl;
    }
    return `${envUrl.replace(/\/$/, '')}/api/v1`;
  };

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch recipes (ingredients) from backend
  const fetchRecetas = async () => {
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/ingredients`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch recipes');
      const data = await res.json();

      const mapped: Receta[] = data.map((item: any) => ({
        id: String(item.id),
        nombre: item.name,
        descripcion: item.categorie || 'General',
        imagen: item.image || '',
        ingredientes: (item.items || []).map((it: any) => ({
          insumoId: String(it.inventory_id),
          cantidad: Number(it.quantity)
        }))
      }));

      setRecetas(mapped);
    } catch (err) {
      console.error('Failed to load recipes from DB:', err);
    }
  };

  // Fetch insumos from backend
  const fetchInsumos = async () => {
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/inventory`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();

      const mapped: Insumo[] = data.map((item: any) => {
        const stock = item.inventory_stock;

        let defaultTol = 5;
        const nameLower = item.name.toLowerCase();
        if (nameLower.includes('tomate') || nameLower.includes('cebolla') || nameLower.includes('aceite')) {
          defaultTol = 10;
        }

        const overridesSaved = localStorage.getItem(`insumo_overrides_${item.id}`);
        const overrides = overridesSaved ? JSON.parse(overridesSaved) : null;

        const minStock = stock ? Number(stock.minimum_stock) : 0;
        const qty = stock ? Number(stock.quantity) : 0;
        const maxStock = stock ? Number(stock.maximum_stock) : 80;

        return {
          id: String(item.id),
          nombre: item.name,
          unidad: item.uom?.abbreviation || 'Kg',
          stockSistema: minStock,
          stockFisico: qty,
          toleranciaPct: overrides?.toleranciaPct ?? defaultTol,
          puntoReorden: overrides?.puntoReorden ?? (minStock * 0.3),
          capacidadMaxima: maxStock
        };
      });

      setInsumos(mapped);

      // Calculate/refresh alerts based on new data
      const recalculadas = generarAlertasParaInsumos(mapped, alertas);
      setAlertas(recalculadas);
    } catch (err) {
      console.error('Failed to load insumos from DB:', err);
    }
  };

  // Load backend categories and UOMs
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const base = getApiUrl();
        const [catsRes, uomsRes] = await Promise.all([
          fetch(`${base}/categories`, { headers: getAuthHeaders() }),
          fetch(`${base}/units-of-measure`, { headers: getAuthHeaders() })
        ]);
        if (catsRes.ok) {
          const cats = await catsRes.json();
          setCategories(cats);
        }
        if (uomsRes.ok) {
          const u = await uomsRes.json();
          setUoms(u);
        }
      } catch (err) {
        console.error('Failed to load metadata from backend:', err);
      }
    };

    loadMetadata();
    fetchInsumos();
    fetchRecetas();
  }, [token]);

  // Socket.io integration to listen for consolidated audits and restocking requests in real-time
  useEffect(() => {
    const socketUrl = getApiUrl().replace(/\/api\/v1$/, '') + '/inventory';
    console.log('Connecting to Socket.io namespace /inventory at:', socketUrl);
    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: token ? { token } : undefined
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🟢 Connected to Inventory Socket.io gateway.');
    });

    socket.on('cron_audit_completed', (data: any) => {
      console.log('📢 Nueva auditoría consolidada recibida vía socket:', data);
      if (data && data.success) {
        setLatestAudit(data);
        if (data.criticalCount > 0) {
          showToast('📋 Nueva auditoría consolidada disponible.', 'success');
        }
      }
    });

    socket.on('restocking_needed', (data: any) => {
      console.log('📢 Nueva propuesta de reabastecimiento crítico recibida:', data);
      if (data && data.success && data.items && data.items.length > 0) {
        setLatestRestockAudit(data);
        showToast('⚠️ Alerta de abastecimiento crítico recibida.', 'error');
      }
    });

    socket.on('restocking_completed', (data: any) => {
      console.log('✅ Reabastecimiento completado con éxito:', data);
      showToast('✅ Almacén reabastecido con éxito.', 'success');
      setLatestRestockAudit(null);
      setShowRestockModal(false);
      setIsRestockingLoading(false);
      fetchInsumos();
    });

    socket.on('restocking_error', (data: any) => {
      console.error('❌ Error de reabastecimiento:', data);
      showToast(`❌ Error: ${data.message || 'No se pudo completar el reabastecimiento.'}`, 'error');
      setIsRestockingLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('🔴 Disconnected from Inventory Socket.io gateway.');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleApproveRestock = async (warehouseId: number, items: { sku: string, qty: number }[]) => {
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/alerts/replenish`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ warehouseId, items }),
      });

      if (!res.ok) throw new Error('Error al reabastecer el inventario.');
      showToast('✅ Almacén reabastecido con éxito.', 'success');
      setLatestRestockAudit(null);
      setShowRestockModal(false);
      setIsRestockingLoading(false);
      fetchInsumos();
    } catch (err) {
      console.error('Error in handleApproveRestock:', err);
      showToast('❌ Error al reabastecer el inventario.', 'error');
      setIsRestockingLoading(false);
    }
  };

  const handleDownloadExcel = (base64Data: string, fileName: string) => {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📥 Reporte Excel descargado con éxito.', 'success');
    } catch (err) {
      console.error('Error al descargar archivo Excel:', err);
      showToast('❌ Error al descargar el archivo Excel.', 'error');
    }
  };


  // --- LOCAL PERSISTENCE ---
  useEffect(() => {
    if (insumos.length > 0) {
      localStorage.setItem('rango_tolerancia_insumos', JSON.stringify(insumos));
    }
  }, [insumos]);

  useEffect(() => {
    localStorage.setItem('rango_tolerancia_recetas', JSON.stringify(recetas));
  }, [recetas]);

  useEffect(() => {
    localStorage.setItem('rango_tolerancia_alertas', JSON.stringify(alertas));
  }, [alertas]);

  useEffect(() => {
    localStorage.setItem('rango_tolerancia_historial', JSON.stringify(historialVentas));
  }, [historialVentas]);

  useEffect(() => {
    localStorage.setItem('rango_tolerancia_compras', JSON.stringify(historialCompras));
  }, [historialCompras]);

  // --- HANDLERS ---

  // Reset all simulation data to default values
  const handleResetData = () => {
    if (window.confirm('¿Está seguro de restablecer todos los datos del inventario y recetas a los valores de fábrica? Se borrará el historial de ventas y compras.')) {
      setInsumos(INSUMOS_INICIALES);
      setRecetas(RECETAS_INICIALES);
      setAlertas([]);
      setHistorialVentas([]);
      setHistorialCompras([]);
      setFiltroEstado('todos');
    }
  };

  // Update a single ingredient (insumo)
  const handleUpdateInsumo = async (updated: Insumo) => {
    // Optimistic UI update
    const nuevoInsumos = insumos.map((i) => (i.id === updated.id ? updated : i));
    setInsumos(nuevoInsumos);

    const nuevasAlertas = generarAlertasParaInsumos(nuevoInsumos, alertas);
    setAlertas(nuevasAlertas);

    // Save custom fields locally
    localStorage.setItem(`insumo_overrides_${updated.id}`, JSON.stringify({
      toleranciaPct: updated.toleranciaPct,
      puntoReorden: updated.puntoReorden
    }));

    // Update in backend DB
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/inventory/${updated.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: updated.nombre,
          inventory_stock: {
            warehouse_id: 1,
            quantity: updated.stockFisico,
            minimum_stock: updated.stockSistema,
            maximum_stock: updated.capacidadMaxima
          }
        }),
      });
      if (!res.ok) throw new Error('DB Update failed');
    } catch (err) {
      console.error('Error updating DB:', err);
    }
  };

  // Add a new ingredient
  const handleAddInsumo = async (newInsumoRaw: Omit<Insumo, 'id'>) => {
    try {
      const base = getApiUrl();

      let uomId = uoms.find(
        u => u.abbreviation?.toLowerCase() === newInsumoRaw.unidad.toLowerCase() ||
          u.name?.toLowerCase() === newInsumoRaw.unidad.toLowerCase()
      )?.id;

      if (!uomId) {
        uomId = uoms[0]?.id || 1;
      }

      const categoryId = categories[0]?.id || 1;
      const sku = `INS-${Date.now().toString().slice(-6)}`;

      const payload = {
        sku,
        name: newInsumoRaw.nombre,
        category_id: Number(categoryId),
        uom_id: Number(uomId),
        product_type: 'MP',
        operational_destination: 'Cocina',
        is_active: true,
        inventory_stock: {
          warehouse_id: 1,
          quantity: newInsumoRaw.stockFisico,
          minimum_stock: newInsumoRaw.stockSistema,
          maximum_stock: newInsumoRaw.capacidadMaxima
        }
      };

      const res = await fetch(`${base}/inventory`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('DB Insert failed');
      const created = await res.json();

      localStorage.setItem(`insumo_overrides_${created.id}`, JSON.stringify({
        toleranciaPct: newInsumoRaw.toleranciaPct,
        puntoReorden: newInsumoRaw.puntoReorden
      }));

      await fetchInsumos();
    } catch (err) {
      console.error('Error inserting to DB:', err);
      // Fallback
      const nuevo: Insumo = {
        ...newInsumoRaw,
        id: `ins-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      };
      const nuevosInsumos = [...insumos, nuevo];
      setInsumos(nuevosInsumos);
      const nuevasAlertas = generarAlertasParaInsumos(nuevosInsumos, alertas);
      setAlertas(nuevasAlertas);
    }
  };

  // Delete an ingredient
  const handleDeleteInsumo = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este insumo? Se desvinculará de las recetas que lo utilicen.')) {
      const nuevosInsumos = insumos.filter((i) => i.id !== id);
      setInsumos(nuevosInsumos);

      const nuevasRecetas = recetas.map((r) => ({
        ...r,
        ingredientes: r.ingredientes.filter((ing) => ing.insumoId !== id),
      })).filter((r) => r.ingredientes.length > 0);

      setRecetas(nuevasRecetas);

      const nuevasAlertas = generarAlertasParaInsumos(nuevosInsumos, alertas);
      setAlertas(nuevasAlertas);

      localStorage.removeItem(`insumo_overrides_${id}`);

      try {
        const base = getApiUrl();
        const res = await fetch(`${base}/inventory/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('DB Delete failed');
      } catch (err) {
        console.error('Error deleting from DB:', err);
      }
    }
  };

  // Add a new recipe
  const handleAddReceta = (newRecetaRaw: Omit<Receta, 'id'>) => {
    const nuevo: Receta = {
      ...newRecetaRaw,
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };
    setRecetas([...recetas, nuevo]);
  };

  // Delete a recipe
  const handleDeleteReceta = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta receta del menú?')) {
      setRecetas(recetas.filter((r) => r.id !== id));
    }
  };

  // --- CORE SYSTEM: MASS SALES DEDUCTION ---
  const handleUploadVentas = (items: VentaItem[]) => {
    // 1. Calculate consolidated consumptions of all sales in batch
    const consumosConsolidados: { [insumoId: string]: number } = {};

    items.forEach((venta) => {
      const receta = recetas.find((r) => r.id === venta.recetaId);
      if (!receta) return;

      receta.ingredientes.forEach((ing) => {
        const totalUsado = ing.cantidad * venta.cantidad;
        consumosConsolidados[ing.insumoId] = (consumosConsolidados[ing.insumoId] || 0) + totalUsado;
      });
    });

    // 2. Map deductions to build the history log entry
    const insumosDescontadosReporte: HistorialVenta['insumosDescontados'] = [];

    const nuevosInsumos = insumos.map((insumo) => {
      const descontado = consumosConsolidados[insumo.id] || 0;
      if (descontado > 0) {
        const stockAnterior = insumo.stockSistema;
        const stockNuevo = Math.max(0, insumo.stockSistema - descontado); // we let it reach 0 to trigger severe alarms

        insumosDescontadosReporte.push({
          insumoNombre: insumo.nombre,
          cantidadDescontada: descontado,
          unidad: insumo.unidad,
          stockAnterior,
          stockNuevo,
        });

        return {
          ...insumo,
          stockSistema: stockNuevo,
        };
      }
      return insumo;
    });

    // 3. Build sale history item
    const itemsVendidosReporte = items.map((item) => {
      const receta = recetas.find((r) => r.id === item.recetaId);
      return {
        recetaNombre: receta?.nombre || 'Platillo desconocido',
        cantidad: item.cantidad,
      };
    });

    const nuevoHistorial: HistorialVenta = {
      id: `vnt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fecha: new Date().toISOString(),
      items: itemsVendidosReporte,
      insumosDescontados: insumosDescontadosReporte,
    };

    // 4. Update core state
    setInsumos(nuevosInsumos);
    setHistorialVentas([nuevoHistorial, ...historialVentas]);

    // 5. Trigger automated notifications instantly!
    const nuevasAlertas = generarAlertasParaInsumos(nuevosInsumos, alertas);

    // Add custom bulk alert
    const totalPlatillos = items.reduce((acc, curr) => acc + curr.cantidad, 0);
    const alertId = `bulk-vnt-${Date.now()}`;
    const bulkAlert: AlertaAlmacen = {
      id: alertId,
      fecha: new Date().toISOString(),
      insumoId: 'sistema',
      insumoNombre: 'Consolidado POS',
      tipo: 'sobreinventario', // Uses purple styling as transaction notification
      mensaje: `📋 Carga masiva de ventas procesada: se descontaron insumos para ${totalPlatillos} platillos en cascada de forma exitosa.`,
      valorActual: totalPlatillos,
      leido: false,
    };

    setAlertas([bulkAlert, ...nuevasAlertas]);

    // Open the alert drawer automatically so the warehouse sees the real-time notification!
    setAlertDrawerOpen(true);
  };

  // --- ALERTS HANDLERS ---
  const handleMarkAsRead = (id: string) => {
    setAlertas(alertas.map((a) => (a.id === id ? { ...a, leido: true } : a)));
  };

  const handleClearAllAlerts = () => {
    setAlertas([]);
  };

  const handleRestockInsumo = (insumoId: string, cantidad: number) => {
    const nuevosInsumos = insumos.map((ins) => {
      if (ins.id === insumoId) {
        const nuevoSistema = ins.stockSistema + cantidad;
        // Also increase physical stock to match reality of stock arrival
        const nuevoFisico = ins.stockFisico + cantidad;
        return {
          ...ins,
          stockSistema: nuevoSistema,
          stockFisico: nuevoFisico,
        };
      }
      return ins;
    });

    setInsumos(nuevosInsumos);

    // Clear the critical reorder alerts related to this item automatically
    const limpiadas = alertas.map((a) =>
      a.insumoId === insumoId && a.tipo === 'critico_reorden' ? { ...a, leido: true } : a
    );
    setAlertas(limpiadas);
  };

  const handleLimpiarHistorialVentas = () => {
    if (window.confirm('¿Desea limpiar el registro de ventas históricas? Esto no afectará los niveles de stock actuales.')) {
      setHistorialVentas([]);
    }
  };

  const handleUploadCompra = (items: CompraItem[], fileName: string) => {
    const insumosAgregadosReporte: HistorialCompra['insumosAgregados'] = [];

    const nuevosInsumos = insumos.map((insumo) => {
      const itemAgregado = items.find((it) => it.insumoId === insumo.id);
      if (itemAgregado) {
        const cant = itemAgregado.cantidad;
        const stockAnteriorSistema = insumo.stockSistema;
        const stockNuevoSistema = insumo.stockSistema + cant;
        const stockAnteriorFisico = insumo.stockFisico;
        const stockNuevoFisico = insumo.stockFisico + cant;

        insumosAgregadosReporte.push({
          insumoNombre: insumo.nombre,
          cantidadAgregada: cant,
          unidad: insumo.unidad,
          stockAnteriorSistema,
          stockNuevoSistema,
          stockAnteriorFisico,
          stockNuevoFisico,
        });

        return {
          ...insumo,
          stockSistema: stockNuevoSistema,
          stockFisico: stockNuevoFisico,
        };
      }
      return insumo;
    });

    const ocCounter = (historialCompras.length + 1001).toString();
    const nuevaCompra: HistorialCompra = {
      id: `OC-${ocCounter}`,
      fecha: new Date().toISOString(),
      nombreArchivo: fileName,
      items,
      insumosAgregados: insumosAgregadosReporte,
    };

    setInsumos(nuevosInsumos);
    setHistorialCompras([nuevaCompra, ...historialCompras]);

    // Recalculate alerts
    const nuevasAlertas = generarAlertasParaInsumos(nuevosInsumos, alertas);

    // Clear critical reorder alerts for restocked items
    const itemsIdsAgregados = items.map((it) => it.insumoId);
    const alertasLimpia = nuevasAlertas.map((a) =>
      itemsIdsAgregados.includes(a.insumoId) && a.tipo === 'critico_reorden' ? { ...a, leido: true } : a
    );

    // Add global alert
    const totalCargado = items.reduce((acc, curr) => acc + curr.cantidad, 0);
    const alertId = `bulk-oc-${Date.now()}`;
    const bulkAlert: AlertaAlmacen = {
      id: alertId,
      fecha: new Date().toISOString(),
      insumoId: 'sistema',
      insumoNombre: `Recepción OC-${ocCounter}`,
      tipo: 'sobreinventario', // Shows purple transactional styling
      mensaje: `📦 Abastecimiento de almacén exitoso: se cargó la Orden de Compra OC-${ocCounter} (${totalCargado.toFixed(1)} uds totales).`,
      valorActual: totalCargado,
      leido: false,
    };

    setAlertas([bulkAlert, ...alertasLimpia]);
    setAlertDrawerOpen(true);
  };

  const handleLimpiarHistorialCompras = () => {
    if (window.confirm('¿Desea limpiar el historial de órdenes de compra recibidas? Esto no afectará los niveles de stock actuales.')) {
      setHistorialCompras([]);
    }
  };

  // --- STATS COMPUTATION FOR KPI CARDS ---
  const totalInsumos = insumos.length;

  const fueraDeRangoCount = insumos.filter((ins) => {
    const varPct = calcularVariacion(ins.stockSistema, ins.stockFisico);
    return determinarEstadoTolerancia(varPct, ins.toleranciaPct) !== 'dentro';
  }).length;

  const reordenCriticoCount = insumos.filter((ins) => ins.stockSistema <= ins.puntoReorden).length;

  const sobreinventarioCount = insumos.filter((ins) => ins.stockSistema > ins.capacidadMaxima).length;

  const handleLoginSuccess = (userPayload: any, tokenPayload: string) => {
    setUser(userPayload);
    setToken(tokenPayload);
    localStorage.setItem('rango_tolerancia_user', JSON.stringify(userPayload));
    localStorage.setItem('rango_tolerancia_token', tokenPayload);
    setShowLoginModal(false);
    setView('admin');
    showToast(`¡Bienvenido, ${userPayload.name || userPayload.userName}!`, 'success');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('rango_tolerancia_user');
    localStorage.removeItem('rango_tolerancia_token');
    setView('landing');
    showToast('Sesión cerrada correctamente.', 'success');
  };

  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onGoToAdmin={() => {
            if (user && token) {
              setView('admin');
            } else {
              setShowLoginModal(true);
            }
          }}
        />
        <AnimatePresence>
          {showLoginModal && (
            <Login
              onLoginSuccess={handleLoginSuccess}
              onClose={() => setShowLoginModal(false)}
              apiUrl={getApiUrl()}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf6] flex flex-col font-sans">

      {/* HEADER BAR */}
      <Header
        alertas={alertas}
        onOpenAlerts={() => setAlertDrawerOpen(true)}
        onResetData={handleResetData}
        onGoBack={() => setView('landing')}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* KPI METRIC CARDS (Bento Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            titulo="Insumos Registrados"
            valor={totalInsumos}
            subtitulo="Total de ingredientes en cocina"
            color="blue"
            icono={Package}
            activo={filtroEstado === 'todos' && activeTab === 'tolerancia'}
            onClick={() => {
              setActiveTab('tolerancia');
              setFiltroEstado('todos');
            }}
            id="kpi-total-insumos"
          />
          <MetricCard
            titulo="Desviaciones de Tolerancia"
            valor={fueraDeRangoCount}
            subtitulo={`${fueraDeRangoCount} insumos fuera del límite admisible`}
            color="red"
            icono={AlertTriangle}
            activo={(filtroEstado === 'alerta' || filtroEstado === 'critico') && activeTab === 'tolerancia'}
            onClick={() => {
              setActiveTab('tolerancia');
              setFiltroEstado('alerta'); // Displays warnings and errors
            }}
            id="kpi-fuera-rango"
          />
          <MetricCard
            titulo="Reórdenes Pendientes"
            valor={reordenCriticoCount}
            subtitulo="Insumos bajo el punto crítico"
            color="yellow"
            icono={Layers}
            activo={filtroEstado === 'reorden' && activeTab === 'tolerancia'}
            onClick={() => {
              setActiveTab('tolerancia');
              setFiltroEstado('reorden');
            }}
            id="kpi-reordenes-criticas"
          />
          <MetricCard
            titulo="Sobreinventario detectado"
            valor={sobreinventarioCount}
            subtitulo="Exceso de stock máximo"
            color="purple"
            icono={ShoppingBag}
            activo={filtroEstado === 'todos' && activeTab === 'tolerancia' && insumos.some(i => i.stockSistema > i.capacidadMaxima)}
            onClick={() => {
              setActiveTab('tolerancia');
              setFiltroEstado('todos');
            }}
            id="kpi-sobreinventario"
          />
        </div>

        {/* NAVIGATION TABS WITH GLIDE EFFECT */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'tolerancia', label: 'Inventario', icon: ClipboardCheck },
              { id: 'ventas', label: 'Ventas', icon: ShoppingBag },
              { id: 'orden_produccion', label: 'Orden de Producción', icon: FileText },
              { id: 'recetas', label: 'Recetas', icon: Utensils },
              { id: 'auditoria', label: 'Reportes', icon: ClipboardCheck },
              //{ id: 'compras', label: 'Órdenes de Compra', icon: Truck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  id={`tab-navegacion-${tab.id}`}
                  className={`py-4 px-1 border-b-2 font-display font-semibold text-sm flex items-center gap-2.5 transition relative cursor-pointer ${isActive
                    ? 'border-primary-600 text-primary-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                  {tab.label}

                  {/* Active tab glider pill */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* DYNAMIC TAB COMPONENT VIEWPORT */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'tolerancia' && (
                <InventoryManager
                  insumos={insumos}
                  onUpdateInsumo={handleUpdateInsumo}
                  onAddInsumo={handleAddInsumo}
                  onDeleteInsumo={handleDeleteInsumo}
                  filtroEstado={filtroEstado}
                  setFiltroEstado={setFiltroEstado}
                  apiUrl={getApiUrl()}
                  onPhysicalCountUploaded={handlePhysicalCountUploaded}
                />
              )}

              {activeTab === 'recetas' && (
                <RecipeManager
                  apiUrl={getApiUrl()}
                  recetas={recetas}
                  insumos={insumos}
                  onRefreshRecetas={fetchRecetas}
                />
              )}

              {activeTab === 'ventas' && (
                <SalesUploader
                  recetas={recetas}
                  insumos={insumos}
                  onUploadVentas={handleUploadVentas}
                  historialVentas={historialVentas}
                  onLimpiarHistorial={handleLimpiarHistorialVentas}
                  apiUrl={getApiUrl()}
                />
              )}

              {activeTab === 'compras' && (
                <PurchaseOrderUploader
                  insumos={insumos}
                  onUploadCompra={handleUploadCompra}
                  historialCompras={historialCompras}
                  onLimpiarHistorial={handleLimpiarHistorialCompras}
                />
              )}

              {activeTab === 'auditoria' && (
                <AuditDashboard
                  apiUrl={getApiUrl()}
                />
              )}

              {activeTab === 'orden_produccion' && (
                <ProductionOrder
                  apiUrl={getApiUrl()}
                  token={token}
                  latestRestockAudit={latestRestockAudit}
                  setLatestRestockAudit={setLatestRestockAudit}
                  onApproveRestock={handleApproveRestock}
                  isRestockingLoading={isRestockingLoading}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* RE-USABLE SIDE NOTIFICATION DRAWER */}
      <AnimatePresence>
        {alertDrawerOpen && (
          <AlertNotifications
            alertas={alertas}
            insumos={insumos}
            onMarkAsRead={handleMarkAsRead}
            onClearAll={handleClearAllAlerts}
            onRestock={handleRestockInsumo}
            onClose={() => setAlertDrawerOpen(false)}
            isOpen={alertDrawerOpen}
          />
        )}
      </AnimatePresence>

      {/* REAL-TIME SOCKET AUDIT NOTIFICATION BANNER */}
      <AnimatePresence>
        {latestAudit && !showAuditModal && latestAudit.criticalCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-45 max-w-md w-full bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4),_0_0_20px_rgba(234,88,12,0.3)] border-2 border-primary-500 p-5 flex flex-col gap-3 text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="p-2.5 bg-primary-600 rounded-xl text-white flex-shrink-0 animate-bounce shadow-[0_0_10px_rgba(234,88,12,0.5)]">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display font-black text-sm text-white tracking-wide">
                    🚨 ¡AUDITORÍA CENTRAL RECIBIDA!
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-semibold">
                    Se detectaron desviaciones fuera del rango de tolerancia en tiempo real.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLatestAudit(null)}
                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/50 rounded-xl p-3 border border-slate-800 text-center">
              <div>
                <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Críticos</div>
                <div className="text-sm font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{latestAudit.criticalCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Alertas</div>
                <div className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">{latestAudit.preventiveCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Normales</div>
                <div className="text-sm font-black text-emerald-400">{latestAudit.normalCount}</div>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowAuditModal(true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(234,88,12,0.2)]"
              >
                Ver Detalles
              </button>
              {latestAudit.excelFileBase64 && (
                <button
                  onClick={() => handleDownloadExcel(latestAudit.excelFileBase64, 'reporte_alertas_inventario.xlsx')}
                  className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Excel
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAILED AUDIT MODAL */}
      <AnimatePresence>
        {showAuditModal && latestAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuditModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                    <ClipboardCheck className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900">
                      Reporte de Auditoría Central - Tolerancias de Stock
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Recibido vía Socket.io • Última actualización: {latestAudit.lastAuditTime ? new Date(latestAudit.lastAuditTime).toLocaleTimeString() : new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Stats Summary Bento-Style */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Evaluados</span>
                    <p className="text-2xl font-black text-slate-800 mt-1">{latestAudit.totalEvaluados}</p>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Desviación Crítica (&gt; ±10%)</span>
                    <p className="text-2xl font-black text-rose-600 mt-1">{latestAudit.criticalCount}</p>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Desviación Alerta (&gt; ±5% a 10%)</span>
                    <p className="text-2xl font-black text-amber-600 mt-1">{latestAudit.preventiveCount}</p>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Dentro de Tolerancia</span>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{latestAudit.normalCount}</p>
                  </div>
                </div>

                {/* Audit Items Table */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Detalle de Variación por Insumo
                  </h4>

                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Insumo</th>
                          <th className="px-4 py-3 text-right">UOM</th>
                          <th className="px-4 py-3 text-right">Stock Sistema (Mín.)</th>
                          <th className="px-4 py-3 text-right">Stock Físico (Cant.)</th>
                          <th className="px-4 py-3 text-right">Variación</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Inconveniente / Explicación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {latestAudit.allItems && latestAudit.allItems.map((item: any, idx: number) => {
                          const isCritical = item.alertType === 'CRITICAL';
                          const isAlert = item.alertType === 'PREVENTIVE';

                          let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                          let badgeText = 'Dentro de Rango';
                          if (isCritical) {
                            badgeClass = 'bg-rose-50 text-rose-700 border-rose-200/60';
                            badgeText = 'Crítico';
                          } else if (isAlert) {
                            badgeClass = 'bg-amber-50 text-amber-700 border-amber-200/60';
                            badgeText = 'Alerta';
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition">
                              <td className="px-4 py-3 font-mono text-slate-500 font-medium">{item.sku}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                              <td className="px-4 py-3 text-right text-slate-400 font-medium">{item.uom}</td>
                              <td className="px-4 py-3 text-right font-mono font-medium text-slate-500">{item.systemStock?.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{item.physicalStock?.toFixed(2)}</td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${isCritical ? 'text-rose-600' : isAlert ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {item.variationPct > 0 ? '+' : ''}{item.variationPct?.toFixed(2)}%
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 leading-normal max-w-xs truncate hover:text-clip hover:whitespace-normal" title={item.justification}>
                                {item.justification}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>
                {latestAudit.excelFileBase64 && (
                  <button
                    onClick={() => handleDownloadExcel(latestAudit.excelFileBase64, 'reporte_alertas_inventario.xlsx')}
                    className="py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Excel
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REAL-TIME SOCKET RESTOCKING NOTIFICATION BANNER */}
      <AnimatePresence>
        {latestRestockAudit && latestRestockAudit.items && latestRestockAudit.items.length > 0 && !showRestockModal && activeTab !== 'orden_produccion' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-45 max-w-md w-full bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4),_0_0_20px_rgba(239,68,68,0.3)] border-2 border-rose-500 p-5 flex flex-col gap-3 text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="p-2.5 bg-rose-600 rounded-xl text-white flex-shrink-0 animate-bounce shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display font-black text-sm text-white tracking-wide">
                    ⚠️ ¡REABASTECIMIENTO CRÍTICO!
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-semibold">
                    Hay {latestRestockAudit.items.length} insumos con menos de 3 días de abastecimiento.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLatestRestockAudit(null)}
                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  setActiveTab('orden_produccion');
                  setLatestRestockAudit(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
              >
                Ver
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INFORMATIONAL RESTOCKING MODAL */}
      <AnimatePresence>
        {showRestockModal && latestRestockAudit && latestRestockAudit.items && latestRestockAudit.items.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500 rounded-2xl text-white shadow-md shadow-rose-500/20 animate-pulse">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-slate-800">
                      Propuesta de Reabastecimiento Crítico
                    </h3>
                    <p className="text-xs text-rose-700 font-bold mt-0.5">
                      Almacén: {latestRestockAudit.warehouseName} &bull; Menos de 3 días de suministro
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRestockModal(false)}
                  className="text-slate-400 hover:text-slate-650 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 flex flex-col items-center text-center gap-6">
                {/* Giant Glowing Numeric Indicator */}
                <div className="relative">
                  <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-xl scale-125 animate-pulse"></div>
                  <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-rose-50 border-4 border-rose-500/30 text-rose-600 shadow-inner">
                    <span className="text-5xl font-display font-black tracking-tight leading-none">
                      {latestRestockAudit.items.length}
                    </span>
                  </div>
                </div>

                <div className="max-w-md flex flex-col gap-2">
                  <h4 className="font-display font-black text-slate-800 text-lg">
                    Insumos Críticos Detectados
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                    El sistema detectó <strong className="text-rose-600 font-black">{latestRestockAudit.items.length} productos</strong> en el Almacén Central con menos de 3 días de suministro o por debajo del stock mínimo.
                  </p>
                  <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                    Se recomienda descargar la propuesta detallada en formato Excel para auditar individualmente o hacer clic en <strong>Aprobar y Surtir Almacén</strong> para reponer todos los insumos automáticamente.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {latestRestockAudit.excelFileBase64 && (
                    <button
                      onClick={() => handleDownloadExcel(latestRestockAudit.excelFileBase64, 'propuesta_reabastecimiento_critico.xlsx')}
                      className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar Propuesta Excel
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowRestockModal(false)}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                    disabled={isRestockingLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setIsRestockingLoading(true);
                      handleApproveRestock(latestRestockAudit.warehouseId, latestRestockAudit.items.map((it: any) => ({ sku: it.sku, qty: it.qtyToRestock })));
                    }}
                    className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-500/20 disabled:opacity-60"
                    disabled={isRestockingLoading}
                  >
                    {isRestockingLoading ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Surtiendo...
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprobar y Surtir Almacén
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${toast.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="bg-[#fcfaf6] border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-12 font-mono font-bold">
        <div className="max-w-7xl mx-auto px-4">
          <p>Rango de Tolerancia de Inventario &bull; Sistema Automatizado de Alertas de Almacén</p>
          <p className="mt-1 text-slate-350">Diseño Suizo de Alta Precisión &bull; React & Tailwind CSS</p>
        </div>
      </footer>

    </div>
  );
}
