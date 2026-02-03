
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/VITE_GEMINI_API_KEY=(.*)/);
const key = keyMatch ? keyMatch[1].trim() : null;

async function test(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
  });
  const data = await response.json();
  console.log(`${model.padEnd(25)} | ${response.status} | ${data.error?.message?.substring(0, 50) || "OK"}`);
}

async function run() {
  await test('gemini-2.0-flash');
  await test('gemini-flash-latest');
  await test('gemini-pro-latest');
}

run();
