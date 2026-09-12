const swaggerJSDoc = require('swagger-jsdoc');

const spec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Covermint LC API', version: '1.0.0', description: 'Lead Generator backend - bottom-up phase 1' },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: ['src/modules/**/*.js', 'src/app.js'],
});

module.exports = spec;
