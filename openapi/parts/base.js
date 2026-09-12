// Shared OpenAPI base: info, tags, reusable schemas. Paths live in parts/*.js
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'Covermint LC API',
    version: '1.0.0',
    description: 'Lead Generator backend - bottom-up phase 1. Dev OTP is 123456 (OTP_MODE=dev).',
  },
  tags: [{ name: 'LG' }, { name: 'LG (staff)' }, { name: 'Utils' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      RegisterInitReq: {
        type: 'object',
        required: ['name', 'phone', 'email', 'pan_no'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string', description: '10-digit India mobile', example: '9876543210' },
          email: { type: 'string' },
          pan_no: { type: 'string', description: '5 letters, 4 digits, 1 letter, uppercase', example: 'ABCDE1234F' },
        },
        example: { name: 'Ramesh Kumar', phone: '9876543210', email: 'ramesh@test.com', pan_no: 'ABCDE1234F' },
      },
      Banking: {
        type: 'object',
        required: ['bank_name', 'ifsc', 'account_number'],
        properties: {
          bank_name: { type: 'string', example: 'HDFC Bank' },
          branch: { type: 'string' },
          ifsc: { type: 'string', example: 'HDFC0001233' },
          account_number: { type: 'string', example: '50100123456789' },
          bank_address: { type: 'string' },
        },
      },
      Step2Req: {
        type: 'object',
        properties: {
          address_aadhaar: { type: 'string' },
          pincode: { type: 'string', example: '560001' },
          current_address: { type: 'string' },
          rm_name: { type: 'string' },
          rm_number: { type: 'string' },
          aadhaar_no: { type: 'string' },
          banking: { $ref: '#/components/schemas/Banking' },
        },
        example: {
          address_aadhaar: '12 MG Road, Bengaluru', pincode: '560001', current_address: '12 MG Road, Bengaluru',
          rm_name: 'Ravi RM', rm_number: '9811111111', aadhaar_no: '123412341234',
          banking: { bank_name: 'HDFC Bank', branch: 'MG Road', ifsc: 'HDFC0001233', account_number: '50100123456789' },
        },
      },
      Dashboard: {
        type: 'object',
        properties: {
          lg_id: { type: 'integer' }, lg_uuid: { type: 'string' }, name: { type: 'string' },
          phone: { type: 'string' }, email: { type: 'string' }, aadhaar_masked: { type: 'string' },
          rm_name: { type: 'string' }, rm_phone: { type: 'string' }, isp_name: { type: 'string' },
          po_name: { type: 'string' }, verification_status: { type: 'string' }, is_active: { type: 'boolean' },
        },
      },
    },
  },
};
