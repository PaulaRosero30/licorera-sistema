const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Obtener todas las ventas
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT v.*, c.nombre as cliente_nombre
       FROM ventas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       ORDER BY v.fecha DESC
       LIMIT 100`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear venta
router.post('/', async (req, res) => {
  const { cliente_id, usuario_id, mesa, items, medio_pago, banco, estado } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calcular total
    let total = 0;
    for (const item of items) {
      total += item.precio_unitario * item.cantidad;
    }

    // Insertar venta
    const venta = await client.query(
      `INSERT INTO ventas (cliente_id, usuario_id, mesa, total, medio_pago, banco, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cliente_id || null, usuario_id || null, mesa || null, total, medio_pago, banco || null, estado || 'pagada']
    );
    const ventaId = venta.rows[0].id;

    // Insertar detalle y descontar stock
    for (const item of items) {
      await client.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );
      await client.query(
        `UPDATE productos SET stock = stock - $1 WHERE id = $2`,
        [item.cantidad, item.producto_id]
      );
    }

    await client.query('COMMIT');
    res.json(venta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Detalle de una venta
router.get('/:id/detalle', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT dv.*, p.nombre as producto_nombre
       FROM detalle_ventas dv
       JOIN productos p ON p.id = dv.producto_id
       WHERE dv.venta_id = $1`,
      [req.params.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Anular venta
router.post('/:id/anular', async (req, res) => {
  const { motivo } = req.body;
  if (!motivo || motivo.trim() === '') {
    return res.status(400).json({ error: 'El motivo de anulación es requerido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que la venta existe y no está ya anulada
    const ventaRes = await client.query(
      `SELECT * FROM ventas WHERE id = $1`,
      [req.params.id]
    );

    if (ventaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const venta = ventaRes.rows[0];

    if (venta.estado === 'anulada') {
      return res.status(400).json({ error: 'La venta ya está anulada' });
    }

    // Obtener detalle de la venta
    const detalles = await client.query(
      `SELECT * FROM detalle_ventas WHERE venta_id = $1`,
      [req.params.id]
    );

    // Devolver stock
    for (const item of detalles.rows) {
      await client.query(
        `UPDATE productos SET stock = stock + $1 WHERE id = $2`,
        [item.cantidad, item.producto_id]
      );
    }

    // Anular venta
    await client.query(
      `UPDATE ventas SET estado = 'anulada', motivo_anulacion = $1 WHERE id = $2`,
      [motivo, req.params.id]
    );

    // Si tenía cliente con deuda, revertir saldo
    if (venta.cliente_id && venta.estado === 'pendiente') {
      await client.query(
        `UPDATE clientes SET saldo_deuda = saldo_deuda - $1 WHERE id = $2`,
        [venta.total, venta.cliente_id]
      );
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Venta anulada correctamente', venta_id: req.params.id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});


module.exports = router;