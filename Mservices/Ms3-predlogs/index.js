require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const predlogsRouter = require('./routes/predlogs');

const app = express();
const PORT = process.env.PORT || 8003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Swagger
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ms3 — PredLogs Service',
      version: '1.0.0',
      description: 'Microservicio de logs de predicciones ML. Node.js + Express + MongoDB.'
    },
    servers: [{ url: `/` }]
  },
  apis: ['./routes/*.js']
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/predlogs', predlogsRouter);

// Health
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const estados = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    service: 'ms3-predlogs',
    version: '1.0.0',
    mongodb: estados[dbState]
  });
});

app.get('/', (req, res) => {
  res.json({ service: 'Ms3 — PredLogs Service', docs: '/api-docs', health: '/health' });
});

// MongoDB connection con reintentos
const MONGO_HOST = process.env.PREDLOGS_DB_HOST || 'localhost';
const MONGO_PORT = process.env.PREDLOGS_DB_PORT || '27017';
const MONGO_DB   = process.env.PREDLOGS_DB_NAME || 'predlogs_db';
const MONGO_URI  = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}`;

async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log(`✅ Conectado a MongoDB: ${MONGO_URI}`);
      return;
    } catch (err) {
      console.log(`⏳ Intento ${i}/${retries} fallido: ${err.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('❌ No se pudo conectar a MongoDB');
}

connectWithRetry().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ms3-PredLogs escuchando en http://0.0.0.0:${PORT}`);
    console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error(err.message);
  process.exit(1);
});
