import React, { useState, useRef } from "react";
import { Upload, Film, Settings2, Play, Download, Loader2, FileVideo, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type AppState = "upload" | "configure" | "processing" | "download";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>("en");
  const [color, setColor] = useState<"white" | "yellow">("white");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Clean up blob URL on unmount or reset
  React.useEffect(() => {
    return () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type.startsWith("video/")) {
      setFile(selected);
      setState("configure");
    } else if (selected) {
      toast({
        title: "Invalid file",
        description: "Please upload a video file.",
        variant: "destructive"
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("video/")) {
      setFile(dropped);
      setState("configure");
    } else if (dropped) {
      toast({
        title: "Invalid file",
        description: "Please drop a video file.",
        variant: "destructive"
      });
    }
  };

  const handleProcess = () => {
    if (!file) return;
    
    setState("processing");
    setProgress(0);
    
    const formData = new FormData();
    formData.append("video", file);
    formData.append("language", language);
    formData.append("color", color);
    
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/subtitles/process", true);
    xhr.responseType = "blob";
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Upload phase takes up first 50% of progress bar
        const percentComplete = (e.loaded / e.total) * 50;
        setProgress(percentComplete);
      }
    };
    
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3) {
        // Processing phase: slowly increment from 50 to 95
        let current = 50;
        const interval = setInterval(() => {
          if (current < 95 && state === "processing") {
            current += Math.random() * 5;
            setProgress(Math.min(current, 95));
          } else {
            clearInterval(interval);
          }
        }, 1000);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        const blob = xhr.response;
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setTimeout(() => setState("download"), 500);
      } else {
        setState("configure");
        toast({
          title: "Processing Failed",
          description: "An error occurred while adding subtitles. Please try again.",
          variant: "destructive"
        });
      }
    };
    
    xhr.onerror = () => {
      setState("configure");
      toast({
        title: "Network Error",
        description: "Failed to communicate with the server. Please check your connection.",
        variant: "destructive"
      });
    };
    
    xhr.send(formData);
  };

  const handleReset = () => {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
    setFile(null);
    setProgress(0);
    setState("upload");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden text-foreground">
      {/* Background cinematic lighting effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-50"></div>
      
      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Studio Subtitles</h1>
          <p className="text-muted-foreground text-sm">Professional AI-powered closed captions</p>
        </div>

        {state === "upload" && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl">
            <CardContent className="pt-6">
              <div 
                className={`relative group cursor-pointer rounded-lg border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-16 px-4 text-center ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="video/*" 
                  onChange={handleFileChange}
                />
                <div className="bg-background/80 p-4 rounded-full mb-4 shadow-sm border border-border group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Upload Video Sequence</h3>
                <p className="text-muted-foreground text-sm max-w-[250px]">
                  Drag and drop your raw footage here, or click to browse
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {state === "configure" && file && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full -ml-2" onClick={handleReset}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1">
                  <CardTitle className="text-lg">Sequence Settings</CardTitle>
                  <CardDescription className="flex items-center gap-2 truncate">
                    <Film className="w-3 h-3" />
                    {file.name}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Spoken Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-background/50 border-border focus:ring-primary h-12">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Subtitle Style</Label>
                <RadioGroup value={color} onValueChange={(val) => setColor(val as "white" | "yellow")} className="flex gap-4">
                  <div className="flex-1">
                    <RadioGroupItem value="white" id="color-white" className="peer sr-only" />
                    <Label 
                      htmlFor="color-white" 
                      className="flex flex-col items-center justify-center p-4 border rounded-md cursor-pointer hover:bg-muted/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                    >
                      <span className="text-xl font-bold text-white drop-shadow-md mb-2 font-serif">White</span>
                      <span className="text-xs text-muted-foreground">Standard</span>
                    </Label>
                  </div>
                  <div className="flex-1">
                    <RadioGroupItem value="yellow" id="color-yellow" className="peer sr-only" />
                    <Label 
                      htmlFor="color-yellow" 
                      className="flex flex-col items-center justify-center p-4 border rounded-md cursor-pointer hover:bg-muted/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                    >
                      <span className="text-xl font-bold text-yellow-400 drop-shadow-md mb-2 font-serif">Yellow</span>
                      <span className="text-xs text-muted-foreground">Cinematic</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleProcess} className="w-full h-12 text-base font-semibold" size="lg">
                <Settings2 className="w-5 h-5 mr-2" />
                Render Subtitles
              </Button>
            </CardFooter>
          </Card>
        )}

        {state === "processing" && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <CardContent className="pt-12 pb-10 flex flex-col items-center justify-center text-center space-y-8">
              
              {/* Animated waveform effect */}
              <div className="flex items-center justify-center gap-1 h-12 w-full">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-1.5 bg-primary rounded-full animate-waveform delay-${(i % 5) * 100}`}
                    style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
                  />
                ))}
              </div>
              
              <div className="space-y-2">
                <h3 className="font-bold text-lg tracking-tight">Processing Sequence</h3>
                <p className="text-muted-foreground text-sm max-w-[250px] mx-auto animate-pulse">
                  {progress < 50 ? "Uploading footage..." : 
                   progress < 80 ? "Transcribing audio..." : 
                   "Rendering subtitles..."}
                </p>
              </div>
              
              <div className="text-3xl font-mono font-bold text-primary/80">
                {Math.round(progress)}%
              </div>
            </CardContent>
          </Card>
        )}

        {state === "download" && resultUrl && (
          <Card className="border-primary/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-green-500/10 text-green-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <CardTitle className="text-2xl">Render Complete</CardTitle>
              <CardDescription>Your sequence is ready for distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-6">
              <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border border-border w-full">
                <FileVideo className="w-8 h-8 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate">{file?.name.replace(/\.[^/.]+$/, "")}_subtitled.mp4</p>
                  <p className="text-xs text-muted-foreground">MP4 • 1080p</p>
                </div>
              </div>
              
              <Button asChild className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20" size="lg">
                <a href={resultUrl} download={`${file?.name.replace(/\.[^/.]+$/, "")}_subtitled.mp4`}>
                  <Download className="w-5 h-5 mr-2" />
                  Download Master
                </a>
              </Button>
              
              <Button variant="ghost" onClick={handleReset} className="w-full text-muted-foreground hover:text-foreground">
                Process another sequence
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}