const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, codigo_barras, nombre, categoria, 
       precio_costo, precio_venta, stock, stock_minimo,
       CASE WHEN stock <= stock_minimo THEN true ELSE false END AS stock_bajo
       FROM productos 
       WHERE activo = true 
       ORDER BY nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar producto
router.post('/', async (req, res) => {
  const { codigo_barras, nombre, categoria, unidad, precio_costo, precio_venta, stock, stock_minimo } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO productos (codigo_barras, nombre, categoria, unidad, precio_costo, precio_venta, stock, stock_minimo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [codigo_barras, nombre, categoria, unidad, precio_costo, precio_venta, stock, stock_minimo]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar por código de barras
router.get('/barras/:codigo', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM productos WHERE codigo_barras = $1 AND activo = true`,
      [req.params.codigo]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Editar producto
router.put('/:id', async (req, res) => {
  const { nombre, categoria, precio_costo, precio_venta, stock, stock_minimo } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE productos SET nombre=$1, categoria=$2, precio_costo=$3, 
       precio_venta=$4, stock=$5, stock_minimo=$6 
       WHERE id=$7 RETURNING *`,
      [nombre, categoria, precio_costo, precio_venta, stock, stock_minimo, req.params.id]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;