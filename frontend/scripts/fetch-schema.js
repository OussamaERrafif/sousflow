const fs = require('fs');
const http = require('http');
const path = require('path');

const filePath = path.join(__dirname, '..', 'openapi.json');

const file = fs.createWriteStream(filePath);

const req = http.get('http://localhost:8000/openapi.json', (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to fetch schema, status:', res.statusCode);
    process.exit(1);
  }
  res.pipe(file);
  res.on('end', () => {
    file.close(() => {
      console.log('Schema fetched successfully');
    });
  });
});

req.on('error', (e) => {
  console.error('Make sure backend is running on port 8000');
  process.exit(1);
});

req.end();
