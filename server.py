#!/usr/bin/env python3
"""
Simple HTTP server for local development
Run: python serve.py
Server will be available at http://localhost:5566
"""

import http.server
import socketserver
import re
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo

PORT = 5566

def kill_process_on_port(port):
    """Kill any process using the specified port."""
    try:
        # Find process using the port (works on macOS/Linux)
        result = subprocess.run(
            ['lsof', '-ti', f':{port}'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    print(f"Killing process {pid} on port {port}...")
                    subprocess.run(['kill', '-9', pid], check=False)
                    print(f"Process {pid} killed.")
            return True
        else:
            print(f"No process found on port {port}.")
            return False
    except FileNotFoundError:
        # lsof not available (Windows or unusual system)
        print("Warning: 'lsof' command not found. Cannot check for processes on port.")
        return False
    except Exception as e:
        print(f"Warning: Could not kill process on port {port}: {e}")
        return False

# Generate build timestamp in NYC timezone when server starts
nyc_tz = ZoneInfo('America/New_York')
build_timestamp = datetime.now(nyc_tz).strftime('%Y-%m-%d %H:%M:%S (NYC)')

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Intercept index.html requests to inject build timestamp
        if self.path == '/' or self.path == '/index.html':
            try:
                with open('index.html', 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace the build timestamp placeholder
                content = re.sub(
                    r'<p id="build-timestamp">Build Time: -</p>',
                    f'<p id="build-timestamp">Build Time: {build_timestamp}</p>',
                    content
                )
                
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
                return
            except Exception as e:
                self.send_error(500, f"Error processing index.html: {str(e)}")
                return
        
        # For all other files, use default behavior
        super().do_GET()

# Kill any existing process on the port before starting
print(f"Checking for processes on port {PORT}...")
kill_process_on_port(PORT)

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    print(f"Server started at: {build_timestamp}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()

