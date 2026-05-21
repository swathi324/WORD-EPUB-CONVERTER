import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Settings, 
  Download, 
  BookOpen,
  Loader2,
  Trash2,
  Type,
  User,
  Globe,
  Info,
  Eye,
  FileCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Metadata {
  title: string;
  author: string;
  publisher: string;
  description: string;
  language: string;
  fontFamily: string;
  fontSize: string;
  textAlign: string;
  lineHeight: string;
}

interface StylePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: string;
  textAlign: string;
  lineHeight: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({
    title: "",
    author: "",
    publisher: "",
    description: "",
    language: "en",
    fontFamily: "serif",
    fontSize: "100%",
    textAlign: "justify",
    lineHeight: "1.5"
  });
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewChapters, setPreviewChapters] = useState<{ title: string; html: string }[] | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentPreviewChapter, setCurrentPreviewChapter] = useState(0);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedMetadata = localStorage.getItem("DOCUEPUB_METADATA");
    if (savedMetadata) {
      try {
        const parsed = JSON.parse(savedMetadata);
        setMetadata(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved metadata", e);
      }
    }

    const savedPresets = localStorage.getItem("DOCUEPUB_PRESETS");
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to parse saved presets", e);
      }
    }
  }, []);

  // Save metadata/presets to localStorage on change
  useEffect(() => {
    localStorage.setItem("DOCUEPUB_METADATA", JSON.stringify(metadata));
  }, [metadata]);

  useEffect(() => {
    localStorage.setItem("DOCUEPUB_PRESETS", JSON.stringify(presets));
  }, [presets]);

  const savePreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }
    const newPreset: StylePreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      fontFamily: metadata.fontFamily,
      fontSize: metadata.fontSize,
      textAlign: metadata.textAlign,
      lineHeight: metadata.lineHeight
    };
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName("");
    toast.success(`Preset "${newPresetName}" saved! 💾`);
  };

  const applyPreset = (preset: StylePreset) => {
    setMetadata(prev => ({
      ...prev,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      textAlign: preset.textAlign,
      lineHeight: preset.lineHeight
    }));
    toast.success(`Applied "${preset.name}" preset ✨`);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success("Preset removed");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".docx")) {
        setFile(selectedFile);
        setMetadata(prev => ({
          ...prev,
          title: prev.title || selectedFile.name.replace(".docx", "")
        }));
        toast.success("File uploaded successfully");
      } else {
        toast.error("Please upload a .docx file");
      }
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ["image/jpeg", "image/png", "image/jpg"];
      if (validTypes.includes(selectedFile.type)) {
        setCover(selectedFile);
        toast.success("Cover image added 🖼️");
      } else {
        toast.error("Invalid image format. Use JPG or PNG.");
      }
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.name.endsWith(".docx")) {
        setFile(selectedFile);
        setMetadata(prev => ({ ...prev, title: prev.title || selectedFile.name.replace(".docx", "") }));
        toast.success("File ready for conversion");
      } else {
        toast.error("Invalid file type. Please use .docx");
      }
    }
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    const formData = new FormData();
    formData.append("file", file);
    if (cover) {
      formData.append("cover", cover);
    }
    formData.append("title", metadata.title);
    formData.append("author", metadata.author);
    formData.append("publisher", metadata.publisher);
    formData.append("description", metadata.description);
    formData.append("language", metadata.language);
    formData.append("fontFamily", metadata.fontFamily);
    formData.append("fontSize", metadata.fontSize);
    formData.append("textAlign", metadata.textAlign);
    formData.append("lineHeight", metadata.lineHeight);

    try {
      const response = await fetch("/api/convert", { method: "POST", body: formData });
      if (!response.ok) {
        let errorMessage = "Conversion failed";
        try {
          const errData = await response.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // Fallback if not JSON
        }
        throw new Error(errorMessage);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${metadata.title.replace(/\s+/g, "_") || "book"}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("EPUB generated successfully! 📖");
    } catch (error: any) {
      toast.error(error.message || "Conversion failed. Please check the file structure.");
      console.error(error);
    } finally {
      setIsConverting(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", metadata.title);

    try {
      const response = await fetch("/api/preview", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Preview failed");
      const data = await response.json();
      setPreviewChapters(data.chapters);
      setCurrentPreviewChapter(0);
      setIsPreviewOpen(true);
    } catch (error) {
      toast.error("Failed to generate preview.");
      console.error(error);
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-xl">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-indigo-600 p-3 rounded-2xl shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">DocuEpub Converter 📚</h1>
          <p className="text-slate-500 mt-2">Professional Word to EPUB transformation made simple. ✨</p>
        </header>

        <Card className="border-slate-200 shadow-xl rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              1. Upload Word Document 📂
            </CardTitle>
            <CardDescription>Drag and drop your .docx file below</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {!file ? (
              <div 
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer bg-slate-50/50
                  ${dragActive ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}
                `}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-700">Choose a file or drag it here 📄</p>
                  <p className="text-xs text-slate-400">Microsoft Word (.docx) documents only</p>
                  <label className="mt-4">
                    <span className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md cursor-pointer">
                      Select File
                    </span>
                    <input type="file" className="hidden" accept=".docx" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-800 truncate">{file.name} ✅</p>
                    <p className="text-[10px] text-indigo-600 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white shrink-0 ml-2">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </CardContent>

          <AnimatePresence>
            {file && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="h-px bg-slate-100 w-full" />
                <CardHeader className="bg-slate-50/50 p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="w-5 h-5 text-indigo-600" />
                      2. Add Book Metadata 🏷️
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => { setFile(null); setCover(null); }} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500">
                      Reset All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-[11px] font-bold uppercase text-slate-500 ml-1">Title</Label>
                      <div className="relative">
                        <Type className="absolute left-3 top-2.5 w-4 h-4 text-slate-300" />
                        <Input id="title" value={metadata.title} onChange={e => setMetadata(prev => ({ ...prev, title: e.target.value }))} className="pl-10 rounded-xl h-10 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="author" className="text-[11px] font-bold uppercase text-slate-500 ml-1">Author</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-300" />
                        <Input id="author" value={metadata.author} onChange={e => setMetadata(prev => ({ ...prev, author: e.target.value }))} className="pl-10 rounded-xl h-10 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="publisher" className="text-[11px] font-bold uppercase text-slate-500 ml-1">Publisher</Label>
                      <Input id="publisher" value={metadata.publisher} onChange={e => setMetadata(prev => ({ ...prev, publisher: e.target.value }))} className="rounded-xl h-10 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="language" className="text-[11px] font-bold uppercase text-slate-500 ml-1">Language</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-300" />
                        <Input id="language" value={metadata.language} onChange={e => setMetadata(prev => ({ ...prev, language: e.target.value }))} className="pl-10 rounded-xl h-10 text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase text-slate-500 ml-1">EPUB Styling Options 🎨</Label>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
                        {presets.length} Saved Presets
                      </div>
                    </div>

                    {/* Presets Quick Selector */}
                    {presets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {presets.map(p => (
                          <button
                            key={p.id}
                            onClick={() => applyPreset(p)}
                            className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-2 group"
                          >
                            {p.name}
                            <Trash2 className="w-3 h-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => deletePreset(p.id, e)} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* New Preset Input */}
                    <div className="flex gap-2 mb-4">
                      <Input 
                        placeholder="Preset Name (e.g. Fiction)" 
                        value={newPresetName} 
                        onChange={e => setNewPresetName(e.target.value)}
                        className="h-8 text-xs rounded-xl flex-grow"
                      />
                      <Button size="sm" onClick={savePreset} disabled={!newPresetName} className="h-8 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold px-4">
                        Save Preset
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Font Family</p>
                        <Select value={metadata.fontFamily} onValueChange={v => setMetadata(p => ({ ...p, fontFamily: v }))}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="serif">Classic Serif</SelectItem>
                            <SelectItem value="sans-serif">Modern Sans</SelectItem>
                            <SelectItem value="monospace">Mono</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Font Size</p>
                        <Select value={metadata.fontSize} onValueChange={v => setMetadata(p => ({ ...p, fontSize: v }))}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="90%">Small</SelectItem>
                            <SelectItem value="100%">Medium</SelectItem>
                            <SelectItem value="110%">Large</SelectItem>
                            <SelectItem value="125%">Huge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Alignment</p>
                        <Select value={metadata.textAlign} onValueChange={v => setMetadata(p => ({ ...p, textAlign: v }))}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="justify">Justified</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Line Height</p>
                        <Select value={metadata.lineHeight} onValueChange={v => setMetadata(p => ({ ...p, lineHeight: v }))}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="1.2">Compact</SelectItem>
                            <SelectItem value="1.5">Standard</SelectItem>
                            <SelectItem value="1.8">Spacious</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-slate-500 ml-1">Book Cover 🎨</Label>
                    {!cover ? (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-6 h-6 text-slate-400 mb-2" />
                          <p className="text-xs text-slate-500">Click to upload cover (JPG, PNG)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={handleCoverChange} />
                      </label>
                    ) : (
                      <div className="relative group rounded-2xl overflow-hidden border border-indigo-100 aspect-[2/3] max-w-[120px] mx-auto shadow-md">
                        <img 
                          src={URL.createObjectURL(cover)} 
                          alt="Cover Preview" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="destructive" size="icon" onClick={() => setCover(null)} className="h-8 w-8 rounded-full">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-[11px] font-bold uppercase text-slate-500 ml-1">Description</Label>
                    <Textarea id="description" value={metadata.description} onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))} className="rounded-xl min-h-[80px] resize-none text-sm" placeholder="Summarize your book..." />
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 leading-tight">
                      <strong>Pro Tip:</strong> DocuEpub automatically cleans dirty Word styles and generates a semantic Table of Contents from your document's Headings.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handlePreview} 
                    disabled={isPreviewing || isConverting} 
                    className="flex-1 h-14 rounded-2xl border-slate-200 text-slate-700 font-bold tracking-tight transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isPreviewing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        <span>Generating Preview...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5 text-indigo-600" />
                        <span>Preview Content</span>
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleConvert} 
                    disabled={isConverting || isPreviewing} 
                    className="flex-[1.5] h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-tight transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Converting Document...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Generate EPUB ✨</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <footer className="mt-8 text-center text-[10px] uppercase font-bold tracking-widest text-slate-400">
          <p>© 2024 PUBLISHING ENGINE • BUILD STABLE_2.1</p>
        </footer>

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none rounded-3xl shadow-2xl">
            <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                    <FileCode className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight">EPUB Structure Preview 📖</DialogTitle>
                    <DialogDescription className="text-indigo-100/80 text-xs font-bold uppercase tracking-wider">
                      {previewChapters?.length || 0} Chapters Detected
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-grow overflow-hidden">
              {/* Chapter Navigation Sidebar */}
              <div className="w-64 border-r border-slate-100 bg-slate-50/50 overflow-y-auto hidden md:block shrink-0">
                <div className="p-4 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Table of Contents</p>
                  {previewChapters?.map((chapter, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPreviewChapter(idx)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                        currentPreviewChapter === idx 
                          ? 'bg-indigo-600 text-white shadow-md font-bold' 
                          : 'text-slate-600 hover:bg-white hover:text-indigo-600'
                      }`}
                    >
                      <span className="opacity-60 mr-2 tabular-nums">{(idx + 1).toString().padStart(2, '0')}.</span>
                      {chapter.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-grow overflow-y-auto p-8 bg-white selection:bg-indigo-100 selection:text-indigo-900 relative">
                {/* Mobile Navigation */}
                <div className="md:hidden mb-6 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <Button variant="ghost" size="sm" disabled={currentPreviewChapter === 0} onClick={() => setCurrentPreviewChapter(prev => prev - 1)}>Prev</Button>
                  <span className="text-xs font-bold text-slate-500">
                    Chapter {currentPreviewChapter + 1} of {previewChapters?.length}
                  </span>
                  <Button variant="ghost" size="sm" disabled={currentPreviewChapter === (previewChapters?.length || 0) - 1} onClick={() => setCurrentPreviewChapter(prev => prev + 1)}>Next</Button>
                </div>

                <div 
                  className="prose prose-slate max-w-none text-slate-700 font-sans leading-relaxed
                             [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:text-slate-900
                             [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:text-slate-800
                             [&>p]:mb-4 [&>p]:leading-relaxed
                             [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-4
                             [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-4
                             [&>img]:max-w-full [&>img]:h-auto [&>img]:rounded-xl [&>img]:my-8 [&>img]:shadow-lg"
                  dangerouslySetInnerHTML={{ __html: previewChapters?.[currentPreviewChapter]?.html || "" }} 
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPreviewChapter === 0} 
                  onClick={() => setCurrentPreviewChapter(prev => prev - 1)}
                  className="rounded-xl h-9"
                >
                  Previous
                </Button>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">
                  Chapter {currentPreviewChapter + 1} of {previewChapters?.length}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPreviewChapter === (previewChapters?.length || 0) - 1} 
                  onClick={() => setCurrentPreviewChapter(prev => prev + 1)}
                  className="rounded-xl h-9"
                >
                  Next
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} className="rounded-xl font-bold text-slate-500 hover:text-slate-700 h-9">
                  Close
                </Button>
                <Button onClick={() => { setIsPreviewOpen(false); handleConvert(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 h-9 shadow-sm">
                  Generate EPUB ✨
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster position="bottom-right" toastOptions={{ className: 'rounded-2xl border-slate-100 shadow-xl font-bold text-xs p-4' }} />
    </div>
  );
}
