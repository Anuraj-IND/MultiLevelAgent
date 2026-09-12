// Staff endpoints: list, export, verify, active
module.exports = {
  '/api/lg': {
    get: {
      tags: ['LG (staff)'], summary: 'List LGs (filter/search/paginate)', security: [{ bearer: [] }],
      parameters: [
        { in: 'query', name: 'type', schema: { type: 'string' } },
        { in: 'query', name: 'verification', schema: { type: 'string' } },
        { in: 'query', name: 'search', schema: { type: 'string' } },
        { in: 'query', name: 'page', schema: { type: 'integer' } },
        { in: 'query', name: 'limit', schema: { type: 'integer' } },
      ],
      responses: { 200: { description: 'Paginated list' } },
    },
  },
  '/api/lg/export': {
    get: {
      tags: ['LG (staff)'], summary: 'Export LG list as CSV (audited)', security: [{ bearer: [] }],
      responses: { 200: { description: 'CSV file Covermint_LG_Report_<date>.csv', content: { 'text/csv': { schema: { type: 'string' } } } } },
    },
  },
  '/api/lg/{id}/verify': {
    patch: {
      tags: ['LG (staff)'], summary: 'Verify LG (approve/reject)', security: [{ bearer: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/json': { example: { decision: 'approved' }, schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['approved', 'rejected'] } } } } } },
      responses: { 200: { description: 'Verified, lg.verified emitted' } },
    },
  },
  '/api/lg/{id}/active': {
    patch: {
      tags: ['LG (staff)'], summary: 'Active toggle (separate from verification)', security: [{ bearer: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/json': { example: { is_active: true }, schema: { type: 'object', required: ['is_active'], properties: { is_active: { type: 'boolean' } } } } } },
      responses: { 200: { description: 'Toggled. 400 if activating while not approved (FR-LG-04)' } },
    },
  },
};
