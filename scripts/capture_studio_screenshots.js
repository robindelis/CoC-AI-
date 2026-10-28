import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/home/robin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const OUT_DIR = '/home/robin/Projects/CoC/docs/screenshots';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const chrome = spawn(
    CHROME_PATH,
    [
      '--headless',
      '--disable-gpu',
      '--remote-debugging-port=9240',
      '--window-size=1920,1080',
      '--no-sandbox',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await wait(1200);

  try {
    const listRes = await fetch('http://localhost:9240/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const send = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const curId = id++;
        callbacks.set(curId, { resolve, reject });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    };

    const evaluate = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      return res.result?.value;
    };

    const scrollAndSnap = async (scrollTop, filename) => {
      const actual = await evaluate(`(() => {
        const c = document.querySelector(".ai-trainer-fullscreen");
        if (c) c.scrollTop = ${scrollTop};
        return c ? c.scrollTop : -1;
      })()`);
      console.log(`Scrolled to ${scrollTop} (actual: ${actual})`);
      await wait(700);
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const p = path.join(OUT_DIR, filename);
      fs.writeFileSync(p, Buffer.from(res.data, 'base64'));
      console.log(`[Captured] ${filename} (${Math.round(Buffer.from(res.data, 'base64').length / 1024)} KB)`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1.25,
      mobile: false,
    });

    console.log('Navigating to AI Studio...');
    await send('Page.navigate', { url: 'http://localhost:5173' });
    await wait(3000);

    // 1. Trainer Overview & Controls
    console.log('1. Capturing Trainer Overview & Controls...');
    await scrollAndSnap(0, '01_ai_studio_trainer_dashboard.png');

    // 2. Neural Architecture Pipeline (3D Feature Maps & Dual Pathway)
    console.log('2. Capturing Neural Architecture Pipeline...');
    await scrollAndSnap(360, '02_neural_architecture_visualizer.png');

    // 3. Neural Architecture Blocks & PyTorch Code
    console.log('3. Capturing Neural Blocks & PyTorch Code...');
    await scrollAndSnap(950, '03_neural_blocks_and_code.png');

    // 4. Training Analytics & Attacker Improvement Curve
    console.log('4. Capturing Training Curve & KPIs...');
    await scrollAndSnap(1700, '04_training_improvement_curve.png');

    // 5. Game-Theoretic Co-Evolution Matrices & Checkpoints
    console.log('5. Capturing Co-Evolution Matrices & Checkpoints...');
    await scrollAndSnap(2018, '05_game_theoretic_coevolution.png');

    // 6. Switch to AI Model Tester & Run Rollout
    console.log('6. Switching to AI Model Tester...');
    await evaluate(`(() => {
      const testTabBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('AI Model Tester')
      );
      if (testTabBtn) testTabBtn.click();
    })()`);
    await wait(2000);

    console.log('Starting rollout simulation...');
    await evaluate(`(() => {
      const ffBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('Fast Forward')
      );
      if (ffBtn) ffBtn.click();
      const runBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('Run Trained Model')
      );
      if (runBtn) runBtn.click();
    })()`);
    await wait(4500);

    console.log('Capturing AI Village Model Tester...');
    await wait(700);
    const shot6 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '06_ai_village_model_tester.png'), Buffer.from(shot6.data, 'base64'));
    console.log(`[Captured] 06_ai_village_model_tester.png (${Math.round(Buffer.from(shot6.data, 'base64').length / 1024)} KB)`);

    // 7. Spatial Observation Tensor & Telemetry
    console.log('7. Capturing Spatial Tensor Inspector...');
    await evaluate(`(() => {
      const tensorCard = Array.from(document.querySelectorAll('.ai-card')).find(c =>
        c.innerText.includes('Spatial Tensor')
      );
      if (tensorCard) {
        tensorCard.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    })()`);
    await wait(800);
    const shot7 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '07_spatial_tensor_inspector.png'), Buffer.from(shot7.data, 'base64'));
    console.log(`[Captured] 07_spatial_tensor_inspector.png (${Math.round(Buffer.from(shot7.data, 'base64').length / 1024)} KB)`);

    console.log('All screenshots captured successfully!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
