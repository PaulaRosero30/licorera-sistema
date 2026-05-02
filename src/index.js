const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./db/conexion');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Rutas públicas (no requieren token)
const auth = require('./routes/auth');
app.use('/api/auth', auth);

// Middleware de autenticación
const { verificarToken } = require('./middleware/auth');
app.use(verificarToken);

// Rutas protegidas
const productos = require('./routes/productos');
const proveedores = require('./routes/proveedores');
const ventas = require('./routes/ventas');
const clientes = require('./routes/clientes');
const mesas = require('./routes/mesas');
const informes = require('./routes/informes');
const caja = require('./routes/caja');


app.use('/api/productos', productos);
app.use('/api/proveedores', proveedores);
app.use('/api/ventas', ventas);
app.use('/api/clientes', clientes);
app.use('/api/mesas', mesas);
app.use('/api/informes', informes);
app.use('/api/caja', caja);

app.get('/', (req, res) => {
  res.json({ mensaje: '🍺 Sistema Licorera funcionando correctamente' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});