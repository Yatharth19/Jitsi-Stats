const fs = require('fs');
const http = require('http');


const metricsFile = 'metrics.prom'; // Replace with the path to your .prom file

// Read the Prometheus metrics from the file
const metricsData = fs.readFileSync(metricsFile, 'utf8');

// Create an HTTP server to serve the metrics
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end(metricsData);
});

const port = 9090; // Port number for the server, adjust as needed

server.listen(port, () => {
  console.log(`Prometheus metrics server is running on http://localhost:${port}`);
});