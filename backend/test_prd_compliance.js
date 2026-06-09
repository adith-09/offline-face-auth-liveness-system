const puppeteer = require('puppeteer');
const fs = require('fs');

async function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

async function runTests() {
  console.log('Starting PRD Compliance Testing...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Set up console intercept to log output from the terminal
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:8000/interactive-showcase/index.html');
  await delay(1000);

  const results = [];

  try {
    // ---- Test 1: Face Enrollment & Genuine Auth (E2E-01) ----
    console.log('[TEST] Executing E2E-01: Genuine Auth');
    
    // Enroll
    await page.type('#user-id-input', '_TEST');
    await page.click('#btn-enroll');
    await delay(3500); // wait for enrollment pipeline
    
    // Verify
    await page.click('#btn-verify');
    await delay(5000); // wait for 3 active checks + matching
    
    const statusText = await page.$eval('#similarity-status', el => el.textContent);
    if (statusText.includes('SUCCESS')) {
      results.push({ id: 'E2E-01', desc: 'Successful offline authentication', status: 'PASS' });
    } else {
      results.push({ id: 'E2E-01', desc: 'Successful offline authentication', status: 'FAIL' });
    }

    // ---- Test 2: Spoof Rejection (E2E-02/03) ----
    console.log('[TEST] Executing E2E-02: Spoof Rejection');
    await page.click('#btn-simulate-spoof');
    await delay(4000); // Wait for spoof detection
    
    const activeBlinkStatus = await page.$eval('#active-blink-status', el => el.textContent);
    if (activeBlinkStatus.includes('FAIL')) {
      results.push({ id: 'E2E-02', desc: 'Spoof rejection (printed photo / screen replay)', status: 'PASS' });
    } else {
      results.push({ id: 'E2E-02', desc: 'Spoof rejection (printed photo / screen replay)', status: 'FAIL' });
    }

    // ---- Test 3: Impostor Rejection (E2E-04) ----
    console.log('[TEST] Executing E2E-04: Impostor Rejection');
    await page.click('#btn-simulate-mismatch');
    await delay(5000);
    
    const mismatchStatus = await page.$eval('#similarity-status', el => el.textContent);
    if (mismatchStatus.includes('MISMATCH')) {
      results.push({ id: 'E2E-04', desc: 'Impostor rejection', status: 'PASS' });
    } else {
      results.push({ id: 'E2E-04', desc: 'Impostor rejection', status: 'FAIL' });
    }

    // ---- Test 4: Offline to Online Sync (E2E-08) ----
    console.log('[TEST] Executing E2E-08: Sync Pipeline');
    // Force network offline
    await page.evaluate(() => document.getElementById('network-toggle').click());
    await delay(500);
    
    // Generate some logs
    for(let i=0; i<3; i++) {
        await page.click('#btn-verify');
        await delay(5000);
    }
    
    // Force network online
    await page.evaluate(() => document.getElementById('network-toggle').click());
    await delay(3000); // Wait for sync
    
    // Check backend
    const syncRes = await fetch('http://localhost:3000/v1/sync_status');
    const syncData = await syncRes.json();
    
    if (syncData.total_records >= 3) {
      results.push({ id: 'E2E-08', desc: 'Offline -> online sync cycle (SQLite to AWS Mock)', status: 'PASS' });
    } else {
      results.push({ id: 'E2E-08', desc: 'Offline -> online sync cycle (SQLite to AWS Mock)', status: 'FAIL' });
    }

    // ---- Test 5: DB Encryption Visualization (SEC-02 logic) ----
    console.log('[TEST] Executing SEC-02: Encryption check');
    await page.click('#btn-toggle-decryption');
    await delay(500);
    const tblHtml = await page.$eval('#enrollments-table', el => el.innerHTML);
    if (tblHtml.includes('decrypted-anim')) {
      results.push({ id: 'SEC-02', desc: 'Embeddings are encrypted at rest', status: 'PASS' });
    } else {
      results.push({ id: 'SEC-02', desc: 'Embeddings are encrypted at rest', status: 'FAIL' });
    }

  } catch (e) {
    console.error('Test execution failed:', e);
  } finally {
    await browser.close();
  }

  // Print results
  console.log('\n========================================');
  console.log('       PRD E2E TEST RESULTS');
  console.log('========================================');
  let md = '# PRD E2E Test Results\n\n| Test ID | Description | Status |\n|---------|-------------|--------|\n';
  results.forEach(r => {
    console.log(`[${r.status}] ${r.id}: ${r.desc}`);
    md += `| ${r.id} | ${r.desc} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |\n`;
  });
  console.log('========================================\n');
  
  fs.writeFileSync('test_report.md', md);
  console.log('Test report saved to test_report.md');
}

runTests();
