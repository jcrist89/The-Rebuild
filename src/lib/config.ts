export const REACHER_PRODUCT_CODE = "REACHER_BUILD";

export function requireServerEnv(name: "SUPABASE_SECRET_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}
