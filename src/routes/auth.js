const express = require('express');
const router = express.Router();
const pool = require('../db/conexion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const resultado = await pool.query(
      `SELECT * FROM usuarios WHERE usuario = $1 AND activo = true`,
      [usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const usuarioDB = resultado.rows[0];

    const passwordValida = await bcrypt.compare(password, usuarioDB.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        usuario: usuarioDB.usuario,
        rol: usuarioDB.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        rol: usuarioDB.rol
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;