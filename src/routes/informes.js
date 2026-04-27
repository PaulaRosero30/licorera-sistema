const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Productos más vendidos
router.get('/productos-vendidos', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.nombre, p.codigo_barras, SUM(dv.cantidad) as cantidad_vendida, 
              SUM(dv.subtotal) as total_vendido, COUNT(DISTINCT dv.venta_id) as num_ventas
       FROM detalle_ventas dv
       JOIN productos p ON p.id = dv.producto_id
       GROUP BY p.id, p.nombre, p.codigo_barras
       ORDER BY cantidad_vendida DESC
       LIMIT 20`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Productos sin movimiento
router.get('/productos-sin-venta', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, codigo_barras, categoria, stock, precio_costo, precio_venta
       FROM productos
       WHERE id NOT IN (SELECT DISTINCT producto_id FROM detalle_ventas)
       AND activo = true
       ORDER BY nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ingresos por período
router.get('/ingresos', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT DATE(fecha) as fecha, COUNT(*) as num_ventas, SUM(total) as total_ingresos
       FROM ventas
       WHERE estado IN ('pagada', 'pendiente', 'abonada')
       GROUP BY DATE(fecha)
       ORDER BY fecha DESC
       LIMIT 30`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ingresos por medio de pago
router.get('/ingresos-por-medio', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT medio_pago, banco, COUNT(*) as num_ventas, SUM(total) as total
       FROM ventas
       WHERE estado IN ('pagada', 'pendiente', 'abonada')
       GROUP BY medio_pago, banco
       ORDER BY total DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ganancias
router.get('/ganancias', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        p.nombre,
        p.codigo_barras,
        SUM(dv.cantidad) as cantidad,
        AVG(p.precio_costo) as precio_costo_prom,
        AVG(dv.precio_unitario) as precio_venta_prom,
        SUM(dv.cantidad * dv.precio_unitario) as ingresos_totales,
        SUM(dv.cantidad * p.precio_costo) as costos_totales,
        SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * p.precio_costo) as ganancia_bruta,
        ROUND(((SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * p.precio_costo)) / SUM(dv.cantidad * dv.precio_unitario) * 100)::numeric, 2) as margen_porcentaje
       FROM detalle_ventas dv
       JOIN productos p ON p.id = dv.producto_id
       GROUP BY p.id, p.nombre, p.codigo_barras
       ORDER BY ganancia_bruta DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resumen general
router.get('/resumen', async (req, res) => {
  try {
    const ventas = await pool.query(`SELECT COUNT(*) as total_ventas, SUM(total) as ingresos_totales FROM ventas WHERE estado IN ('pagada', 'pendiente', 'abonada')`);
    const productos = await pool.query(`SELECT COUNT(*) as total_productos, SUM(stock * precio_costo) as valor_inventario FROM productos WHERE activo = true`);
    const clientes = await pool.query(`SELECT COUNT(*) as total_clientes, SUM(saldo_deuda) as total_deuda FROM clientes WHERE activo = true`);
    const costo = await pool.query(`SELECT SUM(dv.cantidad * p.precio_costo) as costo_total FROM detalle_ventas dv JOIN productos p ON p.id = dv.producto_id`);

    const ingresosTotales = Number(ventas.rows[0].ingresos_totales) || 0;
    const costoTotal = Number(costo.rows[0].costo_total) || 0;
    const gananciaTotal = ingresosTotales - costoTotal;

    res.json({
      ventas: ventas.rows[0],
      productos: productos.rows[0],
      clientes: clientes.rows[0],
      ganancias: {
        ingresos_totales: ingresosTotales,
        costo_total: costoTotal,
        ganancia_bruta: gananciaTotal,
        margen_porcentaje: ingresosTotales > 0 ? ((gananciaTotal / ingresosTotales) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;