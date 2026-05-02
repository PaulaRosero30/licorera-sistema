const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Verificar si hay caja abierta para el usuario
router.get('/estado/:usuario_id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM cajas WHERE usuario_id = $1 AND estado = 'abierta' ORDER BY abierta_en DESC LIMIT 1`,
      [req.params.usuario_id]
    );
    if (resultado.rows.length === 0) {
      return res.json({ abierta: false });
    }

    // Calcular efectivo esperado (base + ventas en efectivo)
    const caja = resultado.rows[0];
    const ventas = await pool.query(
      `SELECT COALESCE(SUM(total), 0) as total_efectivo
       FROM ventas
       WHERE medio_pago = 'efectivo'
       AND estado IN ('pagada', 'pendiente', 'abonada')
       AND fecha >= $1`,
      [caja.abierta_en]
    );

    const totalEfectivo = Number(ventas.rows[0].total_efectivo);
    const efectivoEsperado = Number(caja.base) + totalEfectivo;

    res.json({
      abierta: true,
      caja: {
        ...caja,
        total_efectivo_esperado: efectivoEsperado,
        ventas_efectivo: totalEfectivo
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Abrir caja
router.post('/abrir', async (req, res) => {
  const { usuario_id, base } = req.body;
  try {
    // Verificar que no haya caja abierta
    const existente = await pool.query(
      `SELECT id FROM cajas WHERE usuario_id = $1 AND estado = 'abierta'`,
      [usuario_id]
    );
    if (existente.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes una caja abierta' });
    }

    const resultado = await pool.query(
      `INSERT INTO cajas (usuario_id, base) VALUES ($1, $2) RETURNING *`,
      [usuario_id, base]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cerrar caja
router.post('/cerrar', async (req, res) => {
  const { usuario_id, efectivo_real } = req.body;
  try {
    // Obtener caja abierta
    const cajaRes = await pool.query(
      `SELECT * FROM cajas WHERE usuario_id = $1 AND estado = 'abierta' ORDER BY abierta_en DESC LIMIT 1`,
      [usuario_id]
    );

    if (cajaRes.rows.length === 0) {
      return res.status(400).json({ error: 'No hay caja abierta' });
    }

    const caja = cajaRes.rows[0];

    // Calcular efectivo esperado
    const ventas = await pool.query(
      `SELECT COALESCE(SUM(total), 0) as total_efectivo
       FROM ventas
       WHERE medio_pago = 'efectivo'
       AND estado IN ('pagada', 'pendiente', 'abonada')
       AND fecha >= $1`,
      [caja.abierta_en]
    );

    const totalEfectivo = Number(ventas.rows[0].total_efectivo);
    const efectivoEsperado = Number(caja.base) + totalEfectivo;
    const descuadre = Number(efectivo_real) - efectivoEsperado;

    const resultado = await pool.query(
      `UPDATE cajas SET 
        estado = 'cerrada',
        total_efectivo_esperado = $1,
        total_efectivo_real = $2,
        descuadre = $3,
        cerrada_en = NOW()
       WHERE id = $4 RETURNING *`,
      [efectivoEsperado, efectivo_real, descuadre, caja.id]
    );

    res.json({
      caja: resultado.rows[0],
      resumen: {
        base: Number(caja.base),
        ventas_efectivo: totalEfectivo,
        efectivo_esperado: efectivoEsperado,
        efectivo_real: Number(efectivo_real),
        descuadre,
        estado_descuadre: descuadre === 0 ? 'exacto' : descuadre > 0 ? 'sobrante' : 'faltante'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historial de cajas
router.get('/historial/:usuario_id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, u.nombre as cajero
       FROM cajas c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.usuario_id = $1
       ORDER BY c.abierta_en DESC
       LIMIT 30`,
      [req.params.usuario_id]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;