const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Obtener todos los clientes
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, documento, telefono, saldo_deuda, limite_credito, activo, creado_en
       FROM clientes
       WHERE activo = true
       ORDER BY nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar cliente
router.post('/', async (req, res) => {
  const { nombre, documento, telefono, limite_credito } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO clientes (nombre, documento, telefono, limite_credito)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nombre, documento, telefono, limite_credito || 0]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Editar cliente
router.put('/:id', async (req, res) => {
  const { nombre, documento, telefono, limite_credito } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE clientes SET nombre=$1, documento=$2, telefono=$3, limite_credito=$4
       WHERE id=$5 RETURNING *`,
      [nombre, documento, telefono, limite_credito || 0, req.params.id]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de un cliente (deudas)
router.get('/:id/detalles', async (req, res) => {
  try {
    const cliente = await pool.query(
      `SELECT * FROM clientes WHERE id = $1`,
      [req.params.id]
    );
    const ventas = await pool.query(
      `SELECT v.id, v.total, v.fecha, v.estado
       FROM ventas v
       WHERE v.cliente_id = $1 AND v.estado IN ('pendiente', 'abonada')
       ORDER BY v.fecha DESC`,
      [req.params.id]
    );
    res.json({
      cliente: cliente.rows[0],
      deudas: ventas.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar abono a deuda
router.post('/:id/abono', async (req, res) => {
  const { venta_id, monto, medio_pago, banco } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear tabla de abonos si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS abonos (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER REFERENCES ventas(id),
        monto NUMERIC(12,2) NOT NULL,
        medio_pago VARCHAR(30),
        banco VARCHAR(50),
        fecha TIMESTAMP DEFAULT NOW()
      )
    `);

    // Registrar abono
    const abono = await client.query(
      `INSERT INTO abonos (venta_id, monto, medio_pago, banco)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [venta_id, monto, medio_pago, banco || null]
    );

    // Obtener total de abonos de la venta
    const totalAbonos = await client.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM abonos WHERE venta_id = $1`,
      [venta_id]
    );

    // Obtener total de la venta
    const venta = await client.query(
      `SELECT total FROM ventas WHERE id = $1`,
      [venta_id]
    );

    const nuevoTotal = Number(venta.rows[0].total) - Number(totalAbonos.rows[0].total);

    // Actualizar estado de la venta
    let nuevoEstado = 'abonada';
    if (nuevoTotal <= 0) {
      nuevoEstado = 'pagada';
    }

    await client.query(
      `UPDATE ventas SET estado = $1 WHERE id = $2`,
      [nuevoEstado, venta_id]
    );

    // Actualizar saldo del cliente
    const saldoCliente = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN estado='pendiente' THEN total WHEN estado='abonada' THEN 
        (SELECT total FROM ventas WHERE id = v.id) - COALESCE((SELECT SUM(monto) FROM abonos WHERE venta_id = v.id), 0)
        ELSE 0 END), 0) as saldo
       FROM ventas v WHERE cliente_id = $1`,
      [req.params.id]
    );

    await client.query(
      `UPDATE clientes SET saldo_deuda = $1 WHERE id = $2`,
      [saldoCliente.rows[0].saldo, req.params.id]
    );

    await client.query('COMMIT');
    res.json(abono.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;