import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import mammoth from "mammoth";
import epub from "epub-gen-memory";
// Some environments might require this for ESM interop
const epubConverter = (epub as any).default || epub;
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Configure multer for file uploads in memory
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // API route for DOCX to EPUB conversion
  app.post("/api/convert", upload.fields([
    { name: "file", maxCount: 1 },
    { name: "cover", maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const files = req.files as any;
      const docxFile = files?.["file"]?.[0] || null;
      const coverFile = files?.["cover"]?.[0] || null;

      if (!docxFile) {
        return res.status(400).json({ error: "No Word file uploaded" });
      }

      const { title, author, description, publisher, language, fontFamily, fontSize, textAlign, lineHeight } = req.body;

      // Convert DOCX to clean HTML using mammoth
      const result = await mammoth.convertToHtml({ buffer: docxFile.buffer });
      let html = result.value;

      // --- DOCUMENT CLEANING PIPELINE ---
      // 1. Remove empty paragraphs and tabs
      html = html.replace(/<p>\s*<\/p>/g, "");
      html = html.replace(/\t/g, " ");
      // 2. Normalize whitespace
      html = html.replace(/\s+/g, " ");
      // 3. Remove dirty mammoth markers if any (mammoth is quiet clean but let's be sure)
      html = html.replace(/class="[^"]*"/g, ""); // strip all classes for a truly "clean" look
      // ----------------------------------

      // Chapter generation logic (default to H1 split for clean structure)
      let chapters = [];
      const splitTag = "h1";
      // Split by the start of the tag, keeping the tag in the chunk
      const parts = html.split(new RegExp(`(?=<${splitTag}[^>]*>)`, "i")).filter(p => p.trim());

      if (parts.length > 0) {
        chapters = parts.map((part, index) => {
          let chapterTitle = "";
          const titleMatch = part.match(new RegExp(`<${splitTag}[^>]*>(.*?)<\/${splitTag}>`, "i"));
          chapterTitle = titleMatch 
            ? titleMatch[1].replace(/<[^>]*>/g, "").trim() 
            : (index === 0 ? "Introduction" : `Chapter ${index + 1}`);
          
          return {
            title: chapterTitle || `Chapter ${index + 1}`,
            data: part,
          };
        });
      } else {
        chapters = [{ title: title || "Main Content", data: html }];
      }

      // Generate CSS based on user preferences
      const epubCss = `
        body {
          font-family: ${fontFamily || 'serif'};
          font-size: ${fontSize || '100%'};
          text-align: ${textAlign || 'justify'};
          line-height: ${lineHeight || '1.5'};
          margin: 5%;
          color: #333;
        }
        h1 { text-align: center; margin-top: 2em; margin-bottom: 1em; color: #000; }
        h2 { border-bottom: 1px solid #eee; padding-bottom: 0.5em; margin-top: 1.5em; }
        p { margin-bottom: 1em; text-indent: 1em; }
        img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
      `;

      // EPUB options
      const options: any = {
        title: title || "Untitled Document",
        author: author || "Auto Converter",
        publisher: publisher || "Digital Publisher",
        description: description || "Converted from Word document",
        language: language || "en",
        css: epubCss,
      };

      // Add cover if provided
      if (coverFile) {
        try {
          const base64Cover = coverFile.buffer.toString("base64");
          options.cover = `data:${coverFile.mimetype};base64,${base64Cover}`;
        } catch (e) {
          console.error("Error processing cover image:", e);
        }
      }

      // Generate EPUB in memory
      let epubBuffer;
      try {
        epubBuffer = await epubConverter(options, chapters.map(c => ({ ...c, content: c.data })));
      } catch (e: any) {
        console.error("EPUB Generation Error:", e);
        return res.status(500).json({ error: `EPUB Generation failed: ${e.message}` });
      }

      // Set headers for file download
      const safeTitle = (title || "converted").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "converted";
      const encodedTitle = encodeURIComponent(title || "converted").replace(/\s+/g, "_");
      
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.epub"; filename*=UTF-8''${encodedTitle}.epub`
      );

      return res.send(epubBuffer);
    } catch (error) {
      console.error("Conversion error:", error);
      return res.status(500).json({ error: "Failed to convert document" });
    }
  });

  // API route for DOCX preview (HTML)
  app.post("/api/preview", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { title } = req.body;
      const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
      const html = result.value;

      let chapters = [];
      const splitTag = "h1";
      const parts = html.split(new RegExp(`(?=<${splitTag}[^>]*>)`, "i")).filter(p => p.trim());

      if (parts.length > 0) {
        chapters = parts.map((part, index) => {
          let chapterTitle = "";
          const titleMatch = part.match(new RegExp(`<${splitTag}[^>]*>(.*?)<\/${splitTag}>`, "i"));
          chapterTitle = titleMatch 
            ? titleMatch[1].replace(/<[^>]*>/g, "").trim() 
            : (index === 0 ? "Introduction" : `Chapter ${index + 1}`);
          
          return {
            title: chapterTitle || `Chapter ${index + 1}`,
            html: part,
          };
        });
      } else {
        chapters = [{ title: title || "Main Content", html: html }];
      }

      return res.json({ chapters });
    } catch (error) {
      console.error("Preview error:", error);
      return res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
