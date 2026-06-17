// Integrations Configuration
//
// NOTE: For now we keep Printful in code but hide it from the dashboard UI by default.
// Set VITE_ENABLE_PRINTFUL=true to show Printful in the Integrations dashboard.

const toBoolean = (value: string | boolean | undefined, defaultValue: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
  return defaultValue;
};

export const INTEGRATIONS_CONFIG = {
  ENABLE_PRINTFUL: toBoolean(import.meta.env.VITE_ENABLE_PRINTFUL, false),
};

export const isPrintfulEnabled = () => INTEGRATIONS_CONFIG.ENABLE_PRINTFUL;

export default INTEGRATIONS_CONFIG;
