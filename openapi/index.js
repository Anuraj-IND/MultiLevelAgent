// Single assembled OpenAPI spec. Add new module paths here as panels are built.
const base = require('./parts/base');

module.exports = {
  ...base,
  paths: {
    ...require('./parts/lg'),
    ...require('./parts/staff'),
    ...require('./parts/utils'),
  },
};
