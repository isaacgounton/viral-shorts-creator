import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import generateShorts from "./shorts.js";

// Create readline interface
const rl = readline.createInterface({ input, output });

async function main() {
  try {
    const url = await rl.question("URL: ");
    let context = await rl.question("Context: ");
    if (context.trim().length > 0) {
      context = "context: " + context;
    }
    await generateShorts(url, context);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
  }
}

main();
