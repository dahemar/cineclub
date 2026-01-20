#!/usr/bin/env node

/**
 * Lighthouse Benchmark Script
 * 
 * Runs Lighthouse multiple times and collects metrics
 * Usage: node scripts/lighthouse-benchmark.js [url] [runs]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv[2] || 'https://cineclub-theta.vercel.app';
const NUM_RUNS = parseInt(process.argv[3]) || 10;
const OUTPUT_DIR = path.join(__dirname, '../lighthouse-reports');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`\n🚀 Running Lighthouse Benchmark`);
console.log(`📍 URL: ${TARGET_URL}`);
console.log(`🔁 Runs: ${NUM_RUNS}`);
console.log(`📂 Output: ${OUTPUT_DIR}\n`);

const results = [];

for (let i = 1; i <= NUM_RUNS; i++) {
  console.log(`\n⚡ Run ${i}/${NUM_RUNS}...`);
  
  try {
    // Clear cache between runs for cold loads (runs 1-5)
    const clearCache = i <= Math.ceil(NUM_RUNS / 2);
    const cacheFlag = clearCache ? '' : '--disable-storage-reset';
    
    const outputPath = path.join(OUTPUT_DIR, `run-${i}.json`);
    
    // Run Lighthouse with throttling (simulated 4G)
    const command = `npx lighthouse "${TARGET_URL}" \
      --output=json \
      --output-path="${outputPath}" \
      --only-categories=performance \
      --preset=desktop \
      --throttling.cpuSlowdownMultiplier=1 \
      --quiet \
      ${cacheFlag}`;
    
    execSync(command, { stdio: 'inherit' });
    
    // Read results
    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const audits = report.audits;
    
    const metrics = {
      run: i,
      type: clearCache ? 'cold' : 'warm',
      fcp: Math.round(audits['first-contentful-paint']?.numericValue || 0),
      lcp: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
      tti: Math.round(audits['interactive']?.numericValue || 0),
      si: Math.round(audits['speed-index']?.numericValue || 0),
      tbt: Math.round(audits['total-blocking-time']?.numericValue || 0),
      cls: parseFloat(audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3),
      score: Math.round((report.categories.performance?.score || 0) * 100)
    };
    
    results.push(metrics);
    
    console.log(`  FCP: ${metrics.fcp}ms | LCP: ${metrics.lcp}ms | TTI: ${metrics.tti}ms | Score: ${metrics.score}`);
    
    // Wait 2s between runs
    if (i < NUM_RUNS) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (err) {
    console.error(`❌ Run ${i} failed:`, err.message);
  }
}

// Calculate statistics
function calculateStats(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean),
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)]
  };
}

console.log(`\n\n📊 RESULTS SUMMARY`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

const coldRuns = results.filter(r => r.type === 'cold');
const warmRuns = results.filter(r => r.type === 'warm');

console.log(`\n🧊 COLD CACHE (${coldRuns.length} runs)`);
const coldFCP = calculateStats(coldRuns.map(r => r.fcp));
const coldLCP = calculateStats(coldRuns.map(r => r.lcp));
const coldTTI = calculateStats(coldRuns.map(r => r.tti));

console.log(`  FCP: min=${coldFCP.min}ms, mean=${coldFCP.mean}ms, median=${coldFCP.median}ms, p95=${coldFCP.p95}ms, max=${coldFCP.max}ms`);
console.log(`  LCP: min=${coldLCP.min}ms, mean=${coldLCP.mean}ms, median=${coldLCP.median}ms, p95=${coldLCP.p95}ms, max=${coldLCP.max}ms`);
console.log(`  TTI: min=${coldTTI.min}ms, mean=${coldTTI.mean}ms, median=${coldTTI.median}ms, p95=${coldTTI.p95}ms, max=${coldTTI.max}ms`);

console.log(`\n🔥 WARM CACHE (${warmRuns.length} runs)`);
const warmFCP = calculateStats(warmRuns.map(r => r.fcp));
const warmLCP = calculateStats(warmRuns.map(r => r.lcp));
const warmTTI = calculateStats(warmRuns.map(r => r.tti));

console.log(`  FCP: min=${warmFCP.min}ms, mean=${warmFCP.mean}ms, median=${warmFCP.median}ms, p95=${warmFCP.p95}ms, max=${warmFCP.max}ms`);
console.log(`  LCP: min=${warmLCP.min}ms, mean=${warmLCP.mean}ms, median=${warmLCP.median}ms, p95=${warmLCP.p95}ms, max=${warmLCP.max}ms`);
console.log(`  TTI: min=${warmTTI.min}ms, mean=${warmTTI.mean}ms, median=${warmTTI.median}ms, p95=${warmTTI.p95}ms, max=${warmTTI.max}ms`);

console.log(`\n📈 ALL RUNS (${results.length} total)`);
const allFCP = calculateStats(results.map(r => r.fcp));
const allLCP = calculateStats(results.map(r => r.lcp));
const allTTI = calculateStats(results.map(r => r.tti));
const allScores = calculateStats(results.map(r => r.score));

console.log(`  FCP: min=${allFCP.min}ms, mean=${allFCP.mean}ms, median=${allFCP.median}ms, p95=${allFCP.p95}ms, max=${allFCP.max}ms`);
console.log(`  LCP: min=${allLCP.min}ms, mean=${allLCP.mean}ms, median=${allLCP.median}ms, p95=${allLCP.p95}ms, max=${allLCP.max}ms`);
console.log(`  TTI: min=${allTTI.min}ms, mean=${allTTI.mean}ms, median=${allTTI.median}ms, p95=${allTTI.p95}ms, max=${allTTI.max}ms`);
console.log(`  Performance Score: min=${allScores.min}, mean=${allScores.mean}, median=${allScores.median}, p95=${allScores.p95}, max=${allScores.max}`);

// Save summary
const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
const summary = {
  url: TARGET_URL,
  timestamp: new Date().toISOString(),
  runs: NUM_RUNS,
  cold: {
    fcp: coldFCP,
    lcp: coldLCP,
    tti: coldTTI
  },
  warm: {
    fcp: warmFCP,
    lcp: warmLCP,
    tti: warmTTI
  },
  all: {
    fcp: allFCP,
    lcp: allLCP,
    tti: allTTI,
    score: allScores
  },
  detailedResults: results
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`\n✅ Summary saved to: ${summaryPath}`);

// Check if targets met
const TARGET_FCP = 500;
const TARGET_LCP = 500;

console.log(`\n🎯 TARGET VALIDATION`);
console.log(`  Target: FCP < ${TARGET_FCP}ms, LCP < ${TARGET_LCP}ms`);
console.log(`  Cold FCP p95: ${coldFCP.p95}ms ${coldFCP.p95 < TARGET_FCP ? '✅' : '❌'}`);
console.log(`  Cold LCP p95: ${coldLCP.p95}ms ${coldLCP.p95 < TARGET_LCP ? '✅' : '❌'}`);
console.log(`  Warm FCP p95: ${warmFCP.p95}ms ${warmFCP.p95 < TARGET_FCP ? '✅' : '❌'}`);
console.log(`  Warm LCP p95: ${warmLCP.p95}ms ${warmLCP.p95 < TARGET_LCP ? '✅' : '❌'}`);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
