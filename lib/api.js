import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function assert(condition, message, status = 400) { if (!condition) throw new ApiError(status, message); }
export async function body(request) {
  try {
    const value = await request.json();
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected a JSON object');
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid JSON body');
  }
}
export function id(value, label = 'game_id') {
  assert((typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '', `Invalid ${label}`);
  const number = Number(value);
  assert(Number.isSafeInteger(number) && number > 0 && number <= 2147483647, `Invalid ${label}`);
  return number;
}
export function textField(value, name, max, min = 1) {
  assert(typeof value === 'string' && value.trim().length >= min && value.length <= max, `${name} must be ${min}–${max} characters`);
  return value.trim();
}
export function route(handler) {
  return async (...args) => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY' || error.code === 11000) return NextResponse.json({ error: 'This record already exists' }, { status: 409 });
      if (error.sqlState === '45000') return NextResponse.json({ error: error.sqlMessage || 'Database rejected this action' }, { status: 400 });
      if ([3819, 1452, 4025].includes(error.errno) || ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_NO_REFERENCED_ROW_2'].includes(error.code) || error.code === 121) return NextResponse.json({ error: 'Data violates a database constraint' }, { status: 400 });
      // Avoid logging SQL parameter values, connection URLs or password hashes.
      console.error('API error', { name: error.name, code: error.code, errno: error.errno });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  };
}
