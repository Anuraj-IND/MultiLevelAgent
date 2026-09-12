require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const spec = require('./swagger');
const lgRoutes = require('./modules/lg/lg.routes');
const utilsRoutes = require('./modules/utils/utils.routes');

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'covermint-lc', time: new Date().toISOString() }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/openapi.json', (_req, res) => res.json(spec));

app.use('/api/lg', lgRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api', utilsRoutes); // also serves GET /api/tos

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const PORT = process.env.PORT || 10000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`covermint-lc on :${PORT} docs /api-docs`));
}
module.exports = app;
