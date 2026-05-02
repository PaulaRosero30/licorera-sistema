const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');
const bcrypt = require('bcrypt');

// Listar usuarios
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, usuario, rol, activo, creado_en
       FROM usuarios
       ORDER BY creado_en DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear usuario
router.post('/', async (req, res) => {
  const { nombre, usuario, password, rol } = req.body;
  if (!nombre || !usuario || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password, rol)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, usuario, rol, activo`,
      [nombre, usuario, hash, rol]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Editar usuario
router.put('/:id', async (req, res) => {
  const { nombre, rol, password } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE usuarios SET nombre=$1, rol=$2, password=$3 WHERE id=$4`,
        [nombre, rol, hash, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE usuarios SET nombre=$1, rol=$2 WHERE id=$3`,
        [nombre, rol, req.params.id]
      );
    }
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inactivar/activar usuario
router.patch('/:id/estado', async (req, res) => {
  const { activo } = req.body;
  try {
    await pool.query(
      `UPDATE usuarios SET activo=$1 WHERE id=$2`,
      [activo, req.params.id]
    );
    res.json({ mensaje: 'Estado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;