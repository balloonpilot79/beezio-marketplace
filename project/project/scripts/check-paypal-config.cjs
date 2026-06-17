#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const cwd = process.cwd();
const envFiles = ['.env.local', '.env'];

for (const file of envFiles) {
  const full = path.join(cwd, file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: false });
  }
}

const requiredCheckout = [
  'PAYPAL_ENV',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'VITE_PAYPAL_CLIENT_ID',
];

const requiredConnect = [
  'PAYPAL_CONNECT_CLIENT_ID',
  'PAYPAL_CONNECT_CLIENT_SECRET',
  'PAYPAL_CONNECT_REDIRECT_URI',
];

const optionalButImportant = [
  'PAYPAL_WEBHOOK_ID',
];

const asBool = (v) => String(v || '').trim().length > 0;
const mask = (v) => {
  const s = String(v || '');
  if (!s) return '(missing)';
  if (s.length <= 10) return '********';
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

const missing = (keys) => keys.filter((k) => !asBool(process.env[k]));

const checkoutMissing = missing(requiredCheckout);
const connectMissing = missing(requiredConnect);
const optionalMissing = missing(optionalButImportant);

console.log('PayPal Config Check');
console.log('-------------------');
console.log(`PAYPAL_ENV: ${process.env.PAYPAL_ENV || '(missing)'}`);
console.log(`PAYPAL_CLIENT_ID: ${mask(process.env.PAYPAL_CLIENT_ID)}`);
console.log(`PAYPAL_CLIENT_SECRET: ${mask(process.env.PAYPAL_CLIENT_SECRET)}`);
console.log(`VITE_PAYPAL_CLIENT_ID: ${mask(process.env.VITE_PAYPAL_CLIENT_ID)}`);
console.log(`PAYPAL_CONNECT_CLIENT_ID: ${mask(process.env.PAYPAL_CONNECT_CLIENT_ID)}`);
console.log(`PAYPAL_CONNECT_CLIENT_SECRET: ${mask(process.env.PAYPAL_CONNECT_CLIENT_SECRET)}`);
console.log(`PAYPAL_CONNECT_REDIRECT_URI: ${process.env.PAYPAL_CONNECT_REDIRECT_URI || '(missing)'}`);
console.log(`PAYPAL_WEBHOOK_ID: ${mask(process.env.PAYPAL_WEBHOOK_ID)}`);

if (checkoutMissing.length) {
  console.log('\nMissing required checkout vars:');
  checkoutMissing.forEach((k) => console.log(`- ${k}`));
}

if (connectMissing.length) {
  console.log('\nMissing required connect vars:');
  connectMissing.forEach((k) => console.log(`- ${k}`));
}

if (optionalMissing.length) {
  console.log('\nOptional but recommended vars missing:');
  optionalMissing.forEach((k) => console.log(`- ${k}`));
}

if (!checkoutMissing.length && !connectMissing.length) {
  console.log('\nResult: required PayPal vars are present.');
  if (optionalMissing.length) {
    console.log('Note: set PAYPAL_WEBHOOK_ID to enable webhook signature verification.');
  }
  process.exit(0);
}

console.log('\nResult: configuration is incomplete.');
process.exit(1);
