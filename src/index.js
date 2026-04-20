const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./db/conexion');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
const productos = require('./routes/productos');
const proveedores = require('./routes/proveedores');
const ventas = require('./routes/ventas');

app.use('/api/productos', productos);
app.use('/api/proveedores', proveedores);
app.use('/api/ventas', ventas);

app.get('/', (req, res) => {
  res.json({ mensaje: '🍺 Sistema Licorera funcionando correctamente' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});