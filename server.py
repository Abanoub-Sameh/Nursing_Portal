# -*- coding: utf-8 -*-
"""
Intensive Nursing Portal - Local Admin Web Server
Provides a local web API for:
- Serving files and pages
- Receiving file uploads and placing them in correct subject/term folders
- Rewriting curriculum.js on add/edit/delete actions
Uses only Python Standard Library (no pip dependencies required)
"""
import os
import sys
import json
import http.server
import socketserver
import urllib.parse
import re

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_PATH = os.path.join(DIRECTORY, "curriculum.js")

# Fix console encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class AdminRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        # Route API requests
        if self.path == "/api/save_curriculum":
            self.handle_save_curriculum()
        elif self.path == "/api/upload":
            self.handle_upload()
        elif self.path == "/api/delete_file":
            self.handle_delete_file()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_save_curriculum(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            # Format and save curriculum.js
            with open(CURRICULUM_PATH, "w", encoding="utf-8") as f:
                f.write("const curriculumData = ")
                json.dump(payload, f, indent=2, ensure_ascii=False)
                f.write(";\n")
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "تم تحديث البيانات بنجاح"}).encode('utf-8'))
            print("🚀 Saved curriculumData to curriculum.js successfully.")
        except Exception as e:
            self.send_error_response(500, f"Error saving curriculum: {str(e)}")

    def handle_upload(self):
        try:
            # Parse multipart/form-data manually to avoid external libraries
            content_type = self.headers['Content-Type']
            if not content_type.startswith('multipart/form-data'):
                self.send_error_response(400, "Content-Type must be multipart/form-data")
                return

            boundary = content_type.split("boundary=")[1].strip().encode('utf-8')
            content_length = int(self.headers['Content-Length'])
            
            # Read post body
            body_bytes = self.rfile.read(content_length)
            
            # Split sections by boundary
            parts = body_bytes.split(b'--' + boundary)
            
            form_fields = {}
            file_data = None
            filename = None

            for part in parts:
                if not part.strip() or b'\r\n\r\n' not in part:
                    continue
                # Split headers and content
                header_part, content_part = part.split(b'\r\n\r\n', 1)
                content_part = content_part[:-2] # Strip trailing \r\n
                
                header_text = header_part.decode('utf-8', errors='ignore')
                
                # Check if file upload
                fn_match = re.search(r'filename="([^"]+)"', header_text)
                name_match = re.search(r'name="([^"]+)"', header_text)
                
                if name_match:
                    field_name = name_match.group(1)
                    if fn_match:
                        filename = fn_match.group(1)
                        # Fix encoding if filename is sent in utf-8 byte sequence
                        try:
                            # Standard browsers send encoded filenames
                            filename = filename.encode('latin1').decode('utf-8')
                        except Exception:
                            pass
                        file_data = content_part
                    else:
                        form_fields[field_name] = content_part.decode('utf-8', errors='ignore')

            # Extract fields
            term = form_fields.get("term")
            subject = form_fields.get("subject")
            file_type = form_fields.get("file_type")

            if not all([term, subject, file_type, filename, file_data]):
                self.send_error_response(400, "Missing required upload parameters")
                return

            # Determine save directory
            folder_map = {
                "original_ppt": "original",
                "translated_ppt": "guides",
                "my_quiz": "quizzes",
                "doctor_quiz": "quizzes"
            }
            subfolder = folder_map.get(file_type, "original")
            
            # Clean filename from path injections
            clean_filename = os.path.basename(filename)
            
            # Destination path: terms/term_{term}/{subject}/{subfolder}/{clean_filename}
            dest_dir = os.path.join(DIRECTORY, "terms", f"term_{term}", subject, subfolder)
            os.makedirs(dest_dir, exist_ok=True)
            
            dest_path = os.path.join(dest_dir, clean_filename)
            
            # Save file to disk
            with open(dest_path, "wb") as f:
                f.write(file_data)
                
            # Create relative path to return to client
            rel_path = f"terms/term_{term}/{subject}/{subfolder}/{clean_filename}"
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True, 
                "path": rel_path,
                "message": f"تم رفع الملف بنجاح: {clean_filename}"
            }).encode('utf-8'))
            print(f"📁 Uploaded: {clean_filename} -> {rel_path}")
        except Exception as e:
            self.send_error_response(500, f"Upload error: {str(e)}")

    def handle_delete_file(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            rel_path = payload.get('path', '')
            if not rel_path or not rel_path.startswith('terms/'):
                self.send_error_response(400, "مسار الملف غير صالح")
                return
            
            full_path = os.path.join(DIRECTORY, rel_path)
            
            if os.path.exists(full_path):
                os.remove(full_path)
                print(f"🗑️ Deleted file: {rel_path}")
                success = True
                message = f"تم حذف الملف: {os.path.basename(rel_path)}"
            else:
                success = False
                message = "الملف غير موجود"
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": success,
                "message": message
            }).encode('utf-8'))
        except Exception as e:
            self.send_error_response(500, f"Delete error: {str(e)}")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "message": message}).encode('utf-8'))
        print(f"⚠️ Server error ({code}): {message}")

# Set up socket reusing to prevent "Address already in use" errors during quick restarts
class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True

def main():
    print("=" * 60)
    print("🏥 خادم منصة التمريض المكثف المحلي (Nursing Portal Server)")
    print(f"📂 المجلد النشط: {DIRECTORY}")
    print(f"🔗 لوحة الأدمن: http://localhost:{PORT}/admin.html")
    print(f"🔗 موقع الطلاب: http://localhost:{PORT}/index.html")
    print("=" * 60)
    
    server = ThreadingHTTPServer(("", PORT), AdminRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 تم إيقاف الخادم.")
        server.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main()
