-- =============================================
-- TABLAS SISTEMA LICORERA
-- =============================================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'cajero', 'bodeguero')),
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 2. PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  nit VARCHAR(20) UNIQUE,
  telefono VARCHAR(20),
  correo VARCHAR(100),
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 3. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  codigo_barras VARCHAR(50) UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  categoria VARCHAR(50),
  unidad VARCHAR(20),
  precio_costo NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER DEFAULT 5,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 4. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  documento VARCHAR(20) UNIQUE,
  telefono VARCHAR(20),
  saldo_deuda NUMERIC(12,2) DEFAULT 0,
  limite_credito NUMERIC(12,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 5. PEDIDOS (a proveedores)
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  proveedor_id INTEGER REFERENCES proveedores(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recibido', 'parcial')),
  total NUMERIC(12,2) DEFAULT 0,
  fecha TIMESTAMP DEFAULT NOW()
);

-- 6. DETALLE DE PEDIDOS
CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id),
  producto_id INTEGER REFERENCES productos(id),
  cantidad_esperada INTEGER NOT NULL,
  cantidad_recibida INTEGER DEFAULT 0,
  precio_costo NUMERIC(12,2) NOT NULL
);

-- 7. VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  mesa VARCHAR(50),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  medio_pago VARCHAR(30) CHECK (medio_pago IN ('efectivo','transferencia','tarjeta','mixto','credito')),
  banco VARCHAR(50),
  estado VARCHAR(20) DEFAULT 'pagada' CHECK (estado IN ('pagada', 'pendiente', 'abonada')),
  fecha TIMESTAMP DEFAULT NOW()
);

-- 8. DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER REFERENCES ventas(id),
  producto_id INTEGER REFERENCES productos(id),
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);
-- 9. MESAS
CREATE TABLE IF NOT EXISTS mesas (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(50) NOT NULL,
  estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  creado_en TIMESTAMP DEFAULT NOW(),
  cerrado_en TIMESTAMP
);

-- 10. DETALLES DE MESA
CREATE TABLE IF NOT EXISTS detalles_mesa (
  id SERIAL PRIMARY KEY,
  mesa_id INTEGER REFERENCES mesas(id),
  producto_id INTEGER REFERENCES productos(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  persona VARCHAR(100) DEFAULT 'Sin especificar',
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 11. ABONOS
CREATE TABLE IF NOT EXISTS abonos (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER REFERENCES ventas(id),
  monto NUMERIC(12,2) NOT NULL,
  medio_pago VARCHAR(30),
  banco VARCHAR(50),
  fecha TIMESTAMP DEFAULT NOW()
);