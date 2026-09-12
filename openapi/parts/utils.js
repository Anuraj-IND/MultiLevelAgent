// Utils: IFSC proxy, TOS text, health
module.exports = {
  '/api/utils/ifsc/verify': {
    post: {
      tags: ['Utils'], summary: 'Verify IFSC via free Razorpay API (proxied + cached)',
      requestBody: { required: true, content: { 'application/json': { example: { ifsc: 'HDFC0001233' }, schema: { type: 'object', required: ['ifsc'], properties: { ifsc: { type: 'string' } } } } } },
      responses: { 200: { description: 'Bank details', content: { 'application/json': { example: { bank: 'HDFC Bank', branch: '...', address: '...', verified: true }, schema: { type: 'object' } } } } },
    },
  },
  '/api/tos': {
    get: {
      tags: ['Utils'], summary: 'Get TOS overlay text',
      parameters: [{ in: 'query', name: 'version', schema: { type: 'string', default: 'latest' } }],
      responses: { 200: { description: 'TOS text', content: { 'application/json': { example: { version: 'v1', text: 'Covermint LG Terms...', text_hash: 'placeholder-v1' }, schema: { type: 'object' } } } } },
    },
  },
  '/health': { get: { tags: ['Utils'], summary: 'Health', responses: { 200: { description: 'ok' } } } },
};
