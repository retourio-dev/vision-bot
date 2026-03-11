function typeOf(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}

function validateAgainstSchema(obj, schema) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['config is not an object'] };
  }
  const req = Array.isArray(schema?.required) ? schema.required : [];
  for (const k of req) {
    if (!(k in obj)) errors.push(`missing required property: ${k}`);
  }
  const props = schema?.properties || {};
  for (const [key, def] of Object.entries(props)) {
    if (!(key in obj)) continue;
    const t = typeOf(obj[key]);
    const expected = def?.type;
    if (expected) {
      if (expected === 'number' && t === 'string') {
        if (isNaN(Number(obj[key]))) errors.push(`property ${key} should be number`);
      } else if (t !== expected) {
        errors.push(`property ${key} should be ${expected}`);
      }
    }
    if (def?.properties && t === 'object') {
      const nested = validateAgainstSchema(obj[key], { required: def.required, properties: def.properties });
      if (!nested.valid) {
        for (const e of nested.errors) errors.push(`${key}.${e}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateAgainstSchema };

