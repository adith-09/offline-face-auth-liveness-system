const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.resolve(__dirname, 'aws_sync.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err);
  } else {
    console.log('[DB] Connected to SQLite database acting as AWS Sync Backend.');
    db.run(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id VARCHAR(100),
        user_id VARCHAR(100),
        timestamp VARCHAR(100),
        status VARCHAR(50),
        liveness_result VARCHAR(50),
        location VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// Mock AWS API Gateway endpoint
app.post('/v1/sync', (req, res) => {
  const { logs } = req.body;
  if (!logs || !Array.isArray(logs)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  console.log(`[API] Received sync request for ${logs.length} records.`);
  
  const successfulIds = [];
  
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare('INSERT INTO sync_logs (local_id, user_id, timestamp, status, liveness_result, location) VALUES (?, ?, ?, ?, ?, ?)');
    
    logs.forEach(log => {
      stmt.run([log.id, log.userId, log.timestamp, log.status, log.livenessResult, log.location || 'Unknown']);
      successfulIds.push(log.id);
    });
    
    stmt.finalize();
    db.run("COMMIT", (err) => {
      if (err) {
        console.error('[API] Sync transaction failed:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Simulate slight network delay
      setTimeout(() => {
        res.status(202).json({
          success: true,
          message: 'Sync successful',
          synced_ids: successfulIds
        });
      }, 500);
    });
  });
});

// Endpoint to verify testing
app.get('/v1/sync_status', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM sync_logs', (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ total_records: row.count });
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[SYS] Mock AWS API Gateway listening on port ${PORT}`);
});
