const MAX_PASSWORD_BYTES = 72;

const isUsablePasswordInput = (value) => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;
const isStrongPassword = (value) => isUsablePasswordInput(value) && value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
const PASSWORD_REQUIREMENT = 'Password must have 10 to 72 bytes with at least one letter and one number.';

module.exports = { MAX_PASSWORD_BYTES, PASSWORD_REQUIREMENT, isUsablePasswordInput, isStrongPassword };
