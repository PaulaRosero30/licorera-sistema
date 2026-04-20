const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Obtener todos los proveedores
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.*, COUNT(pe.id) as total_pedidos
       FROM proveedores p
       LEFT JOIN pedidos pe ON pe.proveedor_id = p.id
       WHERE p.activo = true
       GROUP BY p.id
       ORDER BY p.nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar proveedor
router.post('/', async (req, res) => {
  const { nombre, nit, telefono, correo, direccion } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO proveedores (nombre, nit, telefono, correo, direccion)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, nit, telefono, correo, direccion]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Editar proveedor
router.put('/:id', async (req, res) => {
  const { nombre, nit, telefono, correo, direccion } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE proveedores SET nombre=$1, nit=$2, telefono=$3, correo=$4, direccion=$5
       WHERE id=$6 RETURNING *`,
      [nombre, nit, telefono, correo, direccion, req.params.id]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inactivar proveedor
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE proveedores SET activo=false WHERE id=$1`, [req.params.id]);
    res.json({ mensaje: 'Proveedor inactivado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
