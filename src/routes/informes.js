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

// Ingresos por medio de pago con filtro de fecha
router.get('/ingresos-por-medio', async (req, res) => {
  const { desde, hasta } = req.query;

  let filtroFecha = '';
  const params = [];

  if (desde && hasta) {
    filtroFecha = `AND DATE(fecha) BETWEEN $1 AND $2`;
    params.push(desde, hasta);
  }

  try {
    const resultado = await pool.query(
      `SELECT 
        medio_pago,
        banco,
        COUNT(*) as num_ventas,
        SUM(total) as total
       FROM ventas
       WHERE estado IN ('pagada', 'pendiente', 'abonada')
       ${filtroFecha}
       GROUP BY medio_pago, banco
       ORDER BY total DESC`,
      params
    );

    const resumenMedios = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      total: 0
    };

    resultado.rows.forEach(r => {
      const monto = Number(r.total);
      resumenMedios.total += monto;
      if (r.medio_pago === 'efectivo') resumenMedios.efectivo += monto;
      else if (r.medio_pago === 'transferencia') resumenMedios.transferencia += monto;
      else if (r.medio_pago === 'tarjeta') resumenMedios.tarjeta += monto;
    });

    res.json({ detalle: resultado.rows, resumen: resumenMedios });
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

// Informe de inventario con valor por costo y venta
router.get('/inventario', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        nombre,
        categoria,
        codigo_barras,
        stock,
        precio_costo,
        precio_venta,
        stock * precio_costo AS valor_costo,
        stock * precio_venta AS valor_venta,
        stock * precio_venta - stock * precio_costo AS ganancia_potencial
       FROM productos
       WHERE activo = true
       ORDER BY categoria ASC, nombre ASC`
    );

    const totales = resultado.rows.reduce((acc, p) => ({
  total_costo: acc.total_costo + Number(p.valor_costo),
  total_venta: acc.total_venta + Number(p.valor_venta),
  total_ganancia: acc.total_ganancia + Number(p.ganancia_potencial),
  total_unidades: acc.total_unidades + Number(p.stock)
}), { total_costo: 0, total_venta: 0, total_ganancia: 0, total_unidades: 0 });

    res.json({ productos: resultado.rows, totales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Informe de ventas por día, mes y año
router.get('/ventas-periodo', async (req, res) => {
  const { periodo } = req.query; // 'dia', 'mes', 'año'

  let agrupacion, formato;

  if (periodo === 'dia') {
    agrupacion = `DATE(fecha)`;
    formato = `TO_CHAR(DATE(fecha), 'DD/MM/YYYY')`;
  } else if (periodo === 'mes') {
    agrupacion = `TO_CHAR(fecha, 'YYYY-MM')`;
    formato = `TO_CHAR(fecha, 'Month YYYY')`;
  } else {
    agrupacion = `EXTRACT(YEAR FROM fecha)`;
    formato = `EXTRACT(YEAR FROM fecha)::text`;
  }

  try {
    const resultado = await pool.query(
      `SELECT 
        ${formato} AS periodo,
        COUNT(*) AS num_ventas,
        SUM(v.total) AS ingresos_totales,
        SUM(dv.cantidad * p.precio_costo) AS costo_total,
        SUM(v.total) - SUM(dv.cantidad * p.precio_costo) AS ganancia_neta
       FROM ventas v
       JOIN detalle_ventas dv ON dv.venta_id = v.id
       JOIN productos p ON p.id = dv.producto_id
       WHERE v.estado IN ('pagada', 'pendiente', 'abonada')
       GROUP BY ${agrupacion}
       ORDER BY ${agrupacion} DESC
       LIMIT 50`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;