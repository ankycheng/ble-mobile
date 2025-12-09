#!/usr/bin/env python3
"""
Simple HTTP server for local development
Run: python serve.py
Server will be available at http://localhost:5566
"""

import http.server
import socketserver

PORT = 5566

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()

