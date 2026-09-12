const { query } = require('../config/db');

async function audit({ actorId, actorType, action, entity, entityId, oldValue, newValue }) {
  try {
    await query(
      `INSERT INTO audit_logs(actor_id,actor_type,action,entity,entity_id,old_value,new_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actorId || null, actorType || null, action, entity, entityId || null, oldValue || null, newValue || null]
    );
  } catch (e) {
    console.error('audit failed', e.message);
  }
}

async function emitEvent(type, payload) {
  try {
    await query(`INSERT INTO events_outbox(type,payload) VALUES ($1,$2)`, [type, payload]);
  } catch (e) {
    console.error('event failed', e.message);
  }
}

module.exports = { audit, emitEvent };
