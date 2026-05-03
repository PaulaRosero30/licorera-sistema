const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Obtener mesas abiertas
router.get('/activas', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT m.*, COUNT(dm.id) as productos, 
       COALESCE(SUM(dm.cantidad * dm.precio_unitario), 0) as total
       FROM mesas m
       LEFT JOIN detalles_mesa dm ON dm.mesa_id = m.id
       WHERE m.estado = 'abierta'
       GROUP BY m.id
       ORDER BY m.creado_en DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear mesa o cuenta
router.post('/', async (req, res) => {
  const { numero, tipo } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO mesas (numero) VALUES ($1) RETURNING *`,
      [numero]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar producto a mesa
router.post('/:id/agregar', async (req, res) => {
  const { producto_id, cantidad, precio_unitario, persona } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO detalles_mesa (mesa_id, producto_id, cantidad, precio_unitario, persona)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, producto_id, cantidad, precio_unitario, persona || 'General']
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una mesa
router.get('/:id/detalles', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT dm.*, p.nombre
       FROM detalles_mesa dm
       JOIN productos p ON p.id = dm.producto_id
       WHERE dm.mesa_id = $1
       ORDER BY dm.persona, dm.creado_en DESC`,
      [req.params.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto de mesa
router.delete('/:id/eliminar/:detalle_id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM detalles_mesa WHERE id = $1 AND mesa_id = $2`,
      [req.params.detalle_id, req.params.id]
    );
    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cerrar mesa con pagos mixtos por persona
router.post('/:id/cerrar', async (req, res) => {
  const { pagos } = req.body;
  // pagos = [{ persona, pagos: [{ medio_pago, banco, monto }] }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const detalles = await client.query(
      `SELECT dm.*, p.nombre FROM detalles_mesa dm
       JOIN productos p ON p.id = dm.producto_id
       WHERE dm.mesa_id = $1`,
      [req.params.id]
    );

    const detallesPorPersona = {};
    detalles.rows.forEach(d => {
      if (!detallesPorPersona[d.persona]) detallesPorPersona[d.persona] = [];
      detallesPorPersona[d.persona].push(d);
    });

    const ventas = [];
    for (const [persona, items] of Object.entries(detallesPorPersona)) {
      const total = items.reduce((acc, i) => acc + (i.cantidad * Number(i.precio_unitario)), 0);
      const pagoPersona = pagos.find(p => p.persona === persona);
      const pagosList = pagoPersona?.pagos || [{ medio_pago: 'efectivo', banco: null, monto: total }];

      const totalPagado = pagosList.reduce((acc, p) => acc + Number(p.monto), 0);

      // Usar el primer medio de pago como principal
      const medioprincipal = pagosList[0]?.medio_pago || 'efectivo';
      const bancoprincipal = pagosList[0]?.banco || null;

      const venta = await client.query(
        `INSERT INTO ventas (mesa, total, medio_pago, banco, estado)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, total`,
        [persona, total, medionatural, bancoprincipal, totalPagado >= total ? 'pagada' : 'pendiente']
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1,$2,$3,$4,$5)`,
          [venta.rows[0].id, item.producto_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]
        );
        await client.query(
          `UPDATE productos SET stock = stock - $1 WHERE id = $2`,
          [item.cantidad, item.producto_id]
        );
      }

      ventas.push({ persona, ventaId: venta.rows[0].id, total, totalPagado, diferencia: totalPagado - total });
    }

    await client.query(
      `UPDATE mesas SET estado = 'cerrada', cerrado_en = NOW() WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Cuenta cerrada', ventas });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;