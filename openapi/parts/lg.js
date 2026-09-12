// LG registration + dashboard paths (public + LG-authenticated)
const D = { in: 'path', name: 'draftId', required: true, schema: { type: 'string' } };

module.exports = {
  '/api/lg/register/init': {
    post: {
      tags: ['LG'], summary: 'Step 1 - name, phone, mail, PAN + trigger OTP',
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInitReq' } } } },
      responses: {
        201: { description: 'Draft created', content: { 'application/json': { example: { draft_id: '31c0feca-c777-414a-b68b-c3b9832873ec', expires_at: '2026-09-14T09:02:48Z', otp: { dev: true, hint: 'use 123456' } }, schema: { type: 'object' } } } },
        400: { description: 'Validation', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        409: { description: 'PAN/phone already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/lg/otp/send': {
    post: {
      tags: ['LG'], summary: 'Send OTP',
      requestBody: { required: true, content: { 'application/json': { example: { phone: '9876543210', purpose: 'register' }, schema: { type: 'object', required: ['phone'], properties: { phone: { type: 'string' }, purpose: { type: 'string', enum: ['register', 'login'] } } } } } },
      responses: { 200: { description: 'Sent', content: { 'application/json': { example: { dev: true, hint: 'use 123456' }, schema: { type: 'object' } } } } },
    },
  },
  '/api/lg/otp/verify': {
    post: {
      tags: ['LG'], summary: 'Verify OTP (dev bypass 123456)',
      requestBody: { required: true, content: { 'application/json': { example: { phone: '9876543210', otp: '123456', purpose: 'register' }, schema: { type: 'object', required: ['phone', 'otp'], properties: { phone: { type: 'string' }, otp: { type: 'string' }, purpose: { type: 'string' } } } } } },
      responses: { 200: { description: 'Verified', content: { 'application/json': { example: { ok: true, dev: true, phone_verified_token: 'abc123' }, schema: { type: 'object' } } } } },
    },
  },
  '/api/lg/register/{draftId}': {
    get: {
      tags: ['LG'], summary: 'Read-only echo of Step 1 + progress',
      parameters: [D],
      responses: { 200: { description: 'Draft + documents + TOS status' }, 404: { description: 'Draft not found' } },
    },
    patch: {
      tags: ['LG'], summary: 'Step 2 - address + RM + banking + aadhaar_no',
      parameters: [D],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Step2Req' } } } },
      responses: { 200: { description: 'Saved, RM auto-created/resolved' } },
    },
  },
  '/api/lg/register/{draftId}/documents': {
    post: {
      tags: ['LG'], summary: 'Upload aadhaar front/back, pan, cheque (image/pdf <=5MB each)',
      parameters: [D],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          aadhaar_front: { type: 'string', format: 'binary' }, aadhaar_back: { type: 'string', format: 'binary' },
          pan_card: { type: 'string', format: 'binary' }, cheque: { type: 'string', format: 'binary' } } } } },
      },
      responses: { 201: { description: 'Uploaded with versions' } },
    },
  },
  '/api/lg/register/{draftId}/tos-accept': {
    post: {
      tags: ['LG'], summary: 'Accept TOS after overlay scroll (stores name + timestamp + ip)',
      parameters: [D],
      requestBody: { required: true, content: { 'application/json': { example: { name: 'Ramesh Kumar', tos_version: 'v1', scrolled_complete: true }, schema: { type: 'object', required: ['name', 'tos_version', 'scrolled_complete'], properties: { name: { type: 'string' }, tos_version: { type: 'string' }, scrolled_complete: { type: 'boolean', description: 'Overlay fully scrolled' } } } } } },
      responses: { 201: { description: 'Accepted' } },
    },
  },
  '/api/lg/register/{draftId}/submit': {
    post: {
      tags: ['LG'], summary: 'Final submit (gated: OTP + address + banking + live IFSC + 4 docs + TOS)',
      parameters: [D],
      responses: {
        201: { description: 'LG created', content: { 'application/json': { example: { lg_id: 'uuid', lg_seq: 12345, verification_status: 'pending' }, schema: { type: 'object' } } } },
        400: { description: 'Gate failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/lg/login/verify': {
    post: {
      tags: ['LG'], summary: 'LG phone-OTP login -> JWT',
      requestBody: { required: true, content: { 'application/json': { example: { phone: '9876543210', otp: '123456' }, schema: { type: 'object', required: ['phone', 'otp'], properties: { phone: { type: 'string' }, otp: { type: 'string' } } } } } },
      responses: { 200: { description: 'JWT', content: { 'application/json': { example: { token: 'eyJhbG...', lg_seq: 12345, id: 'uuid' }, schema: { type: 'object' } } } } },
    },
  },
  '/api/lg/me/dashboard': {
    get: {
      tags: ['LG'], summary: 'LG dashboard (LG-ID, name, phone, aadhaar, mail, RM, ISP, PO)',
      security: [{ bearer: [] }],
      responses: { 200: { description: 'Dashboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/Dashboard' } } } } },
    },
  },
  '/api/lg/me/leads': { get: { tags: ['LG'], summary: 'My leads (stub -> full Lead module later)', security: [{ bearer: [] }], responses: { 200: { description: 'Empty shape' } } } },
  '/api/lg/me/renewals': { get: { tags: ['LG'], summary: 'My renewals (stub)', security: [{ bearer: [] }], responses: { 200: { description: 'Empty buckets' } } } },
  '/api/lg/me/performance': {
    get: {
      tags: ['LG'], summary: 'My performance (stub, feeds ISP/Accounts later)', security: [{ bearer: [] }],
      responses: { 200: { description: 'Metrics', content: { 'application/json': { example: { leads_generated: 0, conversion_pct: 0, commission_earned: 0 }, schema: { type: 'object' } } } } },
    },
  },
  '/api/lg/catalog/insurance': {
    get: {
      tags: ['LG'], summary: 'Sell-hub catalog (life/motor/health)',
      responses: { 200: { description: 'Catalog', content: { 'application/json': { example: [{ category: 'life', title: 'Life Insurance' }, { category: 'motor', title: 'Motor Insurance' }, { category: 'health', title: 'Health Insurance' }] } } } },
    },
  },
  '/api/lg/intents/policy': {
    post: {
      tags: ['LG'], summary: 'Create policy intent (sell stub)', security: [{ bearer: [] }],
      requestBody: { required: true, content: { 'application/json': { example: { category: 'health', payload: { sum_assured: 500000 } }, schema: { type: 'object', required: ['category'], properties: { category: { type: 'string', enum: ['life', 'motor', 'health'] }, payload: { type: 'object' } } } } } },
      responses: { 201: { description: 'Intent created' } },
    },
  },
};
